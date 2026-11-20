import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEvent, scanFinvizTimestamp, scanText } from '../src/time-engine.js';

const NOW = Date.parse('2026-10-21T12:00:00Z');

function only(text, options = {}) {
  const found = scanText(text, { nowMs: NOW, ...options });
  assert.equal(found.length, 1, `expected one match in ${JSON.stringify(text)}, got ${found.length}`);
  return found[0];
}

test('recognizes explicit time-zone forms, prefix UTC, and exact source slices', () => {
  const text = 'At 18:00 UTC, then UTC 6 PM and 6 PM EST.';
  const found = scanText(text, { nowMs: NOW });
  assert.deepEqual(found.map((item) => item.original), ['18:00 UTC', 'UTC 6 PM', '6 PM EST']);
  assert.deepEqual(found.map((item) => text.slice(item.start, item.end)), found.map((item) => item.original));
  assert.equal(found[0].instantMs, Date.parse('2026-10-21T18:00:00Z'));
  assert.equal(found[1].instantMs, Date.parse('2026-10-21T18:00:00Z'));
  assert.equal(found[2].instantMs, Date.parse('2026-10-21T23:00:00Z'));
});

test('handles offsets with minute components and attached numeric offsets', () => {
  assert.equal(only('18:00 UTC+05:30').instantMs, Date.parse('2026-10-21T12:30:00Z'));
  assert.equal(only('18:00 GMT-04:00').instantMs, Date.parse('2026-10-21T22:00:00Z'));
  assert.equal(only('6:00 PM +0545').instantMs, Date.parse('2026-10-21T12:15:00Z'));
  assert.equal(only('6:00 PM +05:45').instantMs, Date.parse('2026-10-21T12:15:00Z'));
});

test('supports ISO instants and explicitly dated zoned times while preserving past dates', () => {
  assert.equal(only('2026-10-22T18:00:00+05:30').instantMs, Date.parse('2026-10-22T12:30:00Z'));
  assert.equal(only('2026-10-22 6 PM EST').instantMs, Date.parse('2026-10-22T23:00:00Z'));
  assert.equal(only('November 3, 2026 6 PM ET').instantMs, Date.parse('2026-11-03T23:00:00Z'));
  assert.equal(only('2026-10-22 18:00:30.500 UTC').instantMs, Date.parse('2026-10-22T18:00:30.500Z'));
  const past = only('2026-10-20 18:00 UTC');
  assert.equal(past.instantMs, Date.parse('2026-10-20T18:00:00Z'));
  assert.ok(past.instantMs < NOW);
});

test('uses fixed abbreviation defaults, dynamic IANA zones, and configurable overrides', () => {
  assert.equal(only('6 PM CST').instantMs, Date.parse('2026-10-22T00:00:00Z'));
  assert.equal(only('6 PM IST').instantMs, Date.parse('2026-10-21T12:30:00Z'));
  assert.equal(only('6 PM BST').instantMs, Date.parse('2026-10-21T17:00:00Z'));
  assert.equal(only('6 PM ET', { nowMs: Date.parse('2026-01-10T12:00:00Z') }).instantMs, Date.parse('2026-01-10T23:00:00Z'));
  assert.equal(only('6 PM ET', { overrides: { ET: '+02:00' } }).instantMs, Date.parse('2026-10-21T16:00:00Z'));
  assert.equal(only('6 PM PT', { overrides: { PT: 'Europe/London' } }).instantMs, Date.parse('2026-10-21T17:00:00Z'));
});

test('maps common North American, European, Asian, and Pacific abbreviations to fixed offsets', () => {
  const cases = [
    ['EDT', '2026-10-22T22:00:00Z'], ['CDT', '2026-10-22T23:00:00Z'],
    ['MST', '2026-10-23T01:00:00Z'], ['MDT', '2026-10-23T00:00:00Z'],
    ['PDT', '2026-10-23T01:00:00Z'], ['CET', '2026-10-22T17:00:00Z'],
    ['CEST', '2026-10-22T16:00:00Z'], ['EET', '2026-10-22T16:00:00Z'],
    ['EEST', '2026-10-22T15:00:00Z'], ['JST', '2026-10-22T09:00:00Z'],
    ['KST', '2026-10-22T09:00:00Z'], ['MSK', '2026-10-22T15:00:00Z'],
    ['SGT', '2026-10-22T10:00:00Z'], ['HKT', '2026-10-22T10:00:00Z'],
    ['AEST', '2026-10-22T08:00:00Z'], ['AEDT', '2026-10-22T07:00:00Z'],
    ['NZST', '2026-10-22T06:00:00Z'], ['NZDT', '2026-10-22T05:00:00Z'],
  ];
  for (const [abbr, expected] of cases) {
    assert.equal(only(`2026-10-22 6 PM ${abbr}`).instantMs, Date.parse(expected), abbr);
  }
});

test('resolves undated times to the next source-zone occurrence, including day rollover', () => {
  const early = only('6 AM UTC');
  assert.equal(early.instantMs, Date.parse('2026-10-22T06:00:00Z'));
  assert.match(early.assumedDate, /2026-10-22/);
  const late = only('6 PM UTC');
  assert.equal(late.instantMs, Date.parse('2026-10-21T18:00:00Z'));
  const yearlessPastDate = only('October 20 6 PM UTC');
  assert.equal(yearlessPastDate.instantMs, Date.parse('2027-10-20T18:00:00Z'));
  assert.match(yearlessPastDate.assumedDate, /2027/);
});

test('finds the next valid inferred leap-day year and rejects impossible month days', () => {
  assert.equal(only('Feb 29 6 PM UTC').instantMs, Date.parse('2028-02-29T18:00:00Z'));
  assert.equal(only('Feb 29 6 PM UTC', { nowMs: Date.parse('2028-03-01T12:00:00Z') }).instantMs, Date.parse('2032-02-29T18:00:00Z'));
  assert.deepEqual(scanText('April 31 6 PM UTC', { nowMs: NOW }), []);
});

test('rejects bare times, invalid dates, unresolved zones, and ambiguous dated DST times', () => {
  assert.deepEqual(scanText('At 18:00 or 6 PM; 2026-02-30 18:00 UTC; February 30, 2026 at 18:00 UTC; 2026-11-01 1:30 AM ET; 6 PM XYZ; 18:00 UTCfoo; 18:00 ESTIMATE', { nowMs: NOW }), []);
  assert.deepEqual(scanText('2026-03-08 2:30 AM ET', { nowMs: NOW }), []);
});

test('resolves undated DST gaps to the next real wall time and repeated hours to the next future occurrence', () => {
  const gapNow = Date.parse('2026-03-08T06:00:00Z');
  const gap = only('2:30 AM ET', { nowMs: gapNow });
  assert.equal(gap.instantMs, Date.parse('2026-03-09T06:30:00Z'));
  assert.match(gap.assumedDate, /2026-03-09/);

  const overlapNow = Date.parse('2026-11-01T06:00:00Z');
  const overlap = only('1:30 AM ET', { nowMs: overlapNow });
  assert.equal(overlap.instantMs, Date.parse('2026-11-01T06:30:00Z'));
  assert.match(overlap.assumedDate, /2026-11-01/);
});

test('returns non-overlapping matches, preferring the complete explicit date and time', () => {
  const text = 'Starts 2026-10-22 18:00 UTC, then 20:00 UTC.';
  const found = scanText(text, { nowMs: NOW });
  assert.deepEqual(found.map((item) => item.original), ['2026-10-22 18:00 UTC', '20:00 UTC']);
  assert.ok(found[0].end <= found[1].start);
});

test('formatEvent counts down to its fixed instant and reports future, now, and past', () => {
  const event = { ...only('18:00 UTC'), sourceLabel: 'UTC' };
  assert.equal(formatEvent(event, { nowMs: Date.parse('2026-10-21T17:00:00Z'), targetZone: 'America/Los_Angeles' }).countdown, 'in 1 hour');
  const now = formatEvent(event, { nowMs: event.instantMs, targetZone: 'UTC' });
  assert.equal(now.state, 'now');
  assert.equal(now.countdown, 'now');
  assert.equal(now.isoInstant, '2026-10-21T18:00:00Z');
  assert.equal(formatEvent(event, { nowMs: event.instantMs, targetZone: 'America/New_York', hour12: true }).localTime, '2:00 PM');
  assert.equal(formatEvent(event, { nowMs: event.instantMs + 86_400_000, targetZone: 'UTC' }).countdown, '1 day ago');
  assert.equal(formatEvent(event, { nowMs: event.instantMs + 86_400_000, targetZone: 'UTC' }).state, 'past');
});

test('recognizes Russian calendar dates with nonbreaking spaces and counts local calendar days', () => {
  const date = only('Документы подали 26\u00a0октября 2026\u00a0года.');
  assert.equal(date.original, '26\u00a0октября 2026\u00a0года');
  assert.equal(date.calendarDate, '2026-10-26');
  assert.equal(date.instantMs, undefined);
  const shown = formatEvent(date, { nowMs: Date.parse('2026-10-25T21:30:00Z'), targetZone: 'Europe/Moscow' });
  assert.equal(shown.countdown, 'today');
  assert.equal(shown.localTime, '');
  assert.equal(shown.isoInstant, null);
  assert.equal(only('29 октября 2026').calendarDate, '2026-10-29');
  assert.deepEqual(scanText('31 февраля 2026 года и 12.31.2026'), []);
});

test('reads dotted calendar dates without treating addresses and versions as dates', () => {
  assert.equal(only('Выпуск за 20:30, 10.10.2026').calendarDate, '2026-10-10');
  assert.equal(only('27.10.26', { shortDottedDates: true }).calendarDate, '2026-10-27');
  assert.deepEqual(scanText('27.10.26, 31.02.2026, IP 10.10.20.26 and v10.10.2026'), []);
});

test('uses the date in the stated zone on relative timestamps, including past Today times', () => {
  const nowMs = Date.parse('2026-11-20T02:00:00Z');
  assert.equal(only('Today, 8:07 AM ET', { nowMs }).instantMs, Date.parse('2026-11-19T13:07:00Z'));
  assert.equal(only('Tomorrow at 4 PM CET', { nowMs }).instantMs, Date.parse('2026-11-21T15:00:00Z'));
  assert.deepEqual(scanText('Today, 8:07 AM', { nowMs }), []);
  assert.deepEqual(scanText('Today at 2:30 AM ET', { nowMs: Date.parse('2026-03-08T12:00:00Z') }), []);
});

test('resolves Finviz time labels using Eastern Time and the most recent matching date', () => {
  const nowMs = Date.parse('2026-11-20T02:00:00Z');
  const today = scanFinvizTimestamp(' Today, 8:07 AM ', nowMs);
  assert.equal(today.start, 1);
  assert.equal(today.instantMs, Date.parse('2026-11-19T13:07:00Z'));
  assert.match(today.assumedDate, /Eastern Time assumed for Finviz/);
  assert.equal(scanFinvizTimestamp('Nov 19, 8:37 PM', nowMs).instantMs, Date.parse('2026-11-20T01:37:00Z'));
  assert.equal(scanFinvizTimestamp('Dec 31, 8:37 PM', Date.parse('2027-01-01T12:00:00Z')).instantMs, Date.parse('2027-01-01T01:37:00Z'));
  assert.equal(scanFinvizTimestamp('The meeting is Today, 8:07 AM', nowMs), null);
  assert.equal(scanFinvizTimestamp('Nov 31, 8:37 PM', nowMs), null);
});
