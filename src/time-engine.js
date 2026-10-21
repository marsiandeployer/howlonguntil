import { Temporal } from '@js-temporal/polyfill';

const DEFAULT_ZONES = {
  UTC: { zone: 'UTC', label: 'UTC' },
  GMT: { zone: 'UTC', label: 'GMT' },
  EST: { zone: '-05:00', label: 'EST' },
  EDT: { zone: '-04:00', label: 'EDT' },
  PST: { zone: '-08:00', label: 'PST' },
  PDT: { zone: '-07:00', label: 'PDT' },
  CST: { zone: '-06:00', label: 'CST' },
  CDT: { zone: '-05:00', label: 'CDT' },
  MST: { zone: '-07:00', label: 'MST' },
  MDT: { zone: '-06:00', label: 'MDT' },
  AST: { zone: '-04:00', label: 'AST' },
  ADT: { zone: '-03:00', label: 'ADT' },
  HST: { zone: '-10:00', label: 'HST' },
  HDT: { zone: '-09:00', label: 'HDT' },
  AKST: { zone: '-09:00', label: 'AKST' },
  AKDT: { zone: '-08:00', label: 'AKDT' },
  IST: { zone: '+05:30', label: 'IST' },
  BST: { zone: '+01:00', label: 'BST' },
  CET: { zone: '+01:00', label: 'CET' },
  CEST: { zone: '+02:00', label: 'CEST' },
  EET: { zone: '+02:00', label: 'EET' },
  EEST: { zone: '+03:00', label: 'EEST' },
  JST: { zone: '+09:00', label: 'JST' },
  KST: { zone: '+09:00', label: 'KST' },
  MSK: { zone: '+03:00', label: 'MSK' },
  SGT: { zone: '+08:00', label: 'SGT' },
  HKT: { zone: '+08:00', label: 'HKT' },
  AEST: { zone: '+10:00', label: 'AEST' },
  AEDT: { zone: '+11:00', label: 'AEDT' },
  NZST: { zone: '+12:00', label: 'NZST' },
  NZDT: { zone: '+13:00', label: 'NZDT' },
  ET: { zone: 'America/New_York', label: 'ET' },
  PT: { zone: 'America/Los_Angeles', label: 'PT' },
  CT: { zone: 'America/Chicago', label: 'CT' },
  MT: { zone: 'America/Denver', label: 'MT' },
};

const MONTHS = 'January February March April May June July August September October November December';
const MONTH_NAMES = MONTHS.split(' ');
const MONTH_PATTERN = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
const TIME_PATTERN = '(?:0?[1-9]|1[0-2])(?::[0-5]\\d)?\\s*[AP]\\.?M\\.?|(?:[01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?';
const ABBREVIATION_PATTERN = Object.keys(DEFAULT_ZONES).sort((a, b) => b.length - a.length).join('|');
const ZONE_PATTERN = `(?:(?:UTC|GMT)(?:\\s*[+-]\\s*\\d{1,2}(?::?\\d{2})?)?|(?:${ABBREVIATION_PATTERN}))(?![A-Za-z])|[+-]\\d{2}:?\\d{2}`;
const ISO_RE = /\b\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}:?\d{2})(?![\w])/g;
const ISO_DATE = '(?:\\d{4}-\\d{2}-\\d{2})';
const EN_DATE = `(?:${MONTH_PATTERN}\\s+\\d{1,2}(?:,?\\s+\\d{4})?|\\d{1,2}\\s+${MONTH_PATTERN}(?:\\s+\\d{4})?)`;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateParts(source) {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (match) return { year: +match[1], month: +match[2], day: +match[3], hasYear: true };
  match = new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?$`, 'i').exec(source);
  let dayFirst = false;
  if (!match) {
    match = new RegExp(`^(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?$`, 'i').exec(source);
    dayFirst = true;
  }
  if (!match) return null;
  const name = (dayFirst ? match[2] : match[1]).toLowerCase().replace(/\.$/, '');
  const month = MONTH_NAMES.findIndex((item) => item.toLowerCase().startsWith(name.slice(0, 3))) + 1;
  return { year: +(dayFirst ? match[3] : match[3]) || null, month, day: +(dayFirst ? match[1] : match[2]), hasYear: Boolean(match[3]) };
}

function parseTime(raw) {
  const s = raw.toUpperCase().trim().replace(/([AP])\.?\s*M\.?$/, '$1M').replace(/\s+/g, ' ');
  const ampm = /\s*([AP])M$/.exec(s);
  const time = s.replace(/\s*[AP]M$/, '');
  const [h, m = '0', sec = '0'] = time.split(':');
  let hour = +h;
  if (ampm) hour = (hour % 12) + (ampm[1] === 'P' ? 12 : 0);
  return { hour, minute: +m, second: Math.floor(+sec), millisecond: Math.round((+sec % 1) * 1000) };
}

function normalizeZone(rawZone, overrides = {}) {
  if (!rawZone) return null;
  const source = rawZone.trim().replace(/\s+/g, '').toUpperCase();
  const offset = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(source.replace(/^UTC/, '').replace(/^GMT/, ''));
  if (offset) {
    const hour = +offset[2];
    const minute = +(offset[3] || 0);
    if (hour > 23 || minute > 59) return null;
    const value = `${offset[1]}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { zone: value, label: rawZone.trim().replace(/\s+/g, '') };
  }
  const key = source;
  const overrideKey = Object.keys(overrides).find((item) => item.toUpperCase() === key);
  if (overrideKey) {
    const override = String(overrides[overrideKey]).trim();
    const overrideOffset = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(override.replace(/^UTC/i, '').replace(/^GMT/i, ''));
    const zone = overrideOffset ? normalizeZone(overrideOffset[0])?.zone : override;
    if (!zone) return null;
    try { Temporal.Now.zonedDateTimeISO(zone); } catch { return null; }
    return { zone, label: `${rawZone.trim()} (${override})` };
  }
  const spec = DEFAULT_ZONES[key];
  if (spec) return spec;
  // A whitelist keeps the accepted grammar explicit; region/IANA zone names may be supplied as overrides.
  if (/^[A-Z_]+(?:\/[A-Z_+-]+)+$/.test(rawZone.trim())) {
    try { Temporal.Now.zonedDateTimeISO(rawZone.trim()); return { zone: rawZone.trim(), label: rawZone.trim() }; } catch { return null; }
  }
  return null;
}

function safeZonedDateTime(parts, zone, disambiguation = 'reject') {
  return Temporal.ZonedDateTime.from({ ...parts, timeZone: zone }, { disambiguation });
}

function possibleWallClockInstants(parts, zone) {
  const sameWallTime = (zdt) => zdt.year === parts.year && zdt.month === parts.month && zdt.day === parts.day
    && zdt.hour === parts.hour && zdt.minute === parts.minute && zdt.second === parts.second
    && zdt.millisecond === parts.millisecond;
  const candidates = [];
  for (const disambiguation of ['earlier', 'later']) {
    const zdt = safeZonedDateTime(parts, zone, disambiguation);
    if (sameWallTime(zdt) && !candidates.some((item) => item.epochMilliseconds === zdt.epochMilliseconds)) candidates.push(zdt);
  }
  return candidates.sort((a, b) => a.epochMilliseconds - b.epochMilliseconds);
}

function nextYearDate(date, now, zone) {
  const localToday = now.toZonedDateTimeISO(zone).toPlainDate();
  return { year: date.year || localToday.year, inferredYear: !date.hasYear };
}

function resolveCandidate(text, start, end, parsed) {
  const { dateText, timeText, zoneText, iso } = parsed;
  const isoZone = iso && (/Z$/i.test(iso) ? { zone: 'UTC', label: 'UTC' } : (() => {
    const suffix = /([+-]\d{2}:?\d{2})$/.exec(iso)?.[1];
    return suffix ? normalizeZone(suffix) : null;
  })());
  const zone = iso ? isoZone : normalizeZone(zoneText, parsed.overrides);
  if (!zone) return null;
  try {
    let instant;
    let assumedDate = null;
    if (iso) {
      instant = Temporal.Instant.from(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2').replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2}) /, '$1T'));
    } else {
      const time = parseTime(timeText);
      if (dateText) {
        const d = dateParts(dateText);
        if (!d || d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return null;
        const now = Temporal.Instant.fromEpochMilliseconds(parsed.nowMs);
        const { year: localYear, inferredYear } = nextYearDate(d, now, zone.zone);
        let date = null;
        let zdt = null;
        const firstYear = d.year || localYear;
        const lastYear = d.year || firstYear + 8;
        for (let year = firstYear; year <= lastYear && !zdt; year++) {
          let candidateDate;
          try {
            candidateDate = Temporal.PlainDate.from({ year, month: d.month, day: d.day }, { overflow: 'reject' });
          } catch {
            continue;
          }
          let candidateZdt;
          try {
            candidateZdt = safeZonedDateTime({ year, month: d.month, day: d.day, ...time }, zone.zone, 'reject');
          } catch {
            // Invalid explicitly dated DST wall times stay invalid. For a yearless date,
            // a gap in one year may have a real occurrence in a later year.
            if (!inferredYear) return null;
            continue;
          }
          if (inferredYear && candidateZdt.epochMilliseconds <= now.epochMilliseconds) continue;
          date = candidateDate;
          zdt = candidateZdt;
        }
        if (!zdt) return null;
        instant = zdt.toInstant();
        if (inferredYear) assumedDate = `Year assumed: ${date.year}`;
      } else {
        const now = Temporal.Instant.fromEpochMilliseconds(parsed.nowMs);
        const local = now.toZonedDateTimeISO(zone.zone);
        let date = local.toPlainDate();
        let zdt = null;
        // Skip wall-clock gaps and choose the next future occurrence during a repeated hour.
        for (let daysAhead = 0; daysAhead <= 370 && !zdt; daysAhead++) {
          const wallTime = { year: date.year, month: date.month, day: date.day, ...time };
          zdt = possibleWallClockInstants(wallTime, zone.zone).find((candidate) => candidate.epochMilliseconds > now.epochMilliseconds) || null;
          if (!zdt) date = date.add({ days: 1 });
        }
        if (!zdt) return null;
        date = zdt.toPlainDate();
        instant = zdt.toInstant();
        assumedDate = `Assumed date: ${date.toString()}`;
      }
    }
    const instantMs = Number(instant.epochMilliseconds);
    if (!Number.isFinite(instantMs)) return null;
    return { start, end, original: text.slice(start, end), instantMs, sourceLabel: zone.label, assumedDate };
  } catch {
    return null;
  }
}

function scanMatches(text, regex, parser, options, out) {
  regex.lastIndex = 0;
  for (const match of text.matchAll(regex)) {
    const candidate = parser(match, options);
    if (!candidate) continue;
    const item = resolveCandidate(text, match.index, match.index + match[0].length, { ...candidate, nowMs: options.nowMs, overrides: options.overrides });
    if (item) out.push(item);
  }
}

const dateTimePattern = new RegExp(`(${ISO_DATE}|${EN_DATE})\\s+(?:at\\s+)?(?:(${ZONE_PATTERN})\\s+)?(${TIME_PATTERN})(?:\\s+(${ZONE_PATTERN}))?`, 'gi');
const zonedTimePattern = new RegExp(`(?:\\b(${ZONE_PATTERN})\\s+)?(${TIME_PATTERN})(?:\\s+(${ZONE_PATTERN}))?`, 'gi');

export function scanText(input, options = {}) {
  const text = String(input ?? '');
  const opts = {
    nowMs: Number.isFinite(options.nowMs) ? options.nowMs : Date.now(),
    overrides: options.overrides || {},
  };
  const matches = [];

  scanMatches(text, ISO_RE, (m) => ({ iso: m[0] }), opts, matches);

  scanMatches(text, dateTimePattern, (m) => {
    const zoneText = m[4] || m[2];
    if (!zoneText) return null;
    return { dateText: m[1], timeText: m[3], zoneText };
  }, opts, matches);

  scanMatches(text, zonedTimePattern, (m) => {
    const source = m[0].trim();
    const found = new RegExp(`^(?:(${ZONE_PATTERN})\\s+)?(${TIME_PATTERN})(?:\\s+(${ZONE_PATTERN}))?$`, 'i').exec(source);
    if (!found || (!found[1] && !found[3])) return null;
    // ISO-like date matches are handled above; reject a fragment embedded in another numeric token.
    const beforeChar = text[m.index - 1] || '';
    const prefix = text.slice(Math.max(0, m.index - 48), m.index);
    const dateContext = new RegExp(`(?:\\b\\d{4}-\\d{2}-\\d{2}|${EN_DATE})(?:\\s+at)?(?:\\s+${ZONE_PATTERN})?\\s*$`, 'i');
    if (/\d/.test(beforeChar) || dateContext.test(prefix)) return null;
    return { timeText: found[2], zoneText: found[1] || found[3] };
  }, opts, matches);

  const unique = new Map();
  for (const item of matches) {
    const key = `${item.start}:${item.end}`;
    const previous = unique.get(key);
    if (!previous || (item.assumedDate && !previous.assumedDate)) unique.set(key, item);
  }
  const sorted = [...unique.values()].sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping = [];
  for (const item of sorted) {
    const previous = nonOverlapping.at(-1);
    if (!previous || item.start >= previous.end) nonOverlapping.push(item);
  }
  return nonOverlapping;
}

function countdownText(deltaMs) {
  const seconds = Math.floor(Math.abs(deltaMs) / 1000);
  if (seconds === 0) return 'now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  let remainder = seconds;
  const parts = [];
  for (const [name, size] of units) {
    const count = Math.floor(remainder / size);
    if (count) {
      parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
      remainder %= size;
      if (parts.length === 2) break;
    }
  }
  const phrase = parts.join(' ');
  return deltaMs > 0 ? `in ${phrase}` : `${phrase} ago`;
}

export function formatEvent(match, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const targetZone = options.targetZone || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
  const deltaMs = match.instantMs - nowMs;
  const state = Math.abs(deltaMs) < 1000 ? 'now' : deltaMs > 0 ? 'future' : 'past';
  const hour12 = options.hour12 === true;
  let localDate = '';
  let localTime = '';
  let timeZone = targetZone;
  try {
    const local = Temporal.Instant.fromEpochMilliseconds(match.instantMs).toZonedDateTimeISO(targetZone);
    localDate = local.toPlainDate().toString();
    localTime = hour12
      ? `${local.hour % 12 || 12}:${String(local.minute).padStart(2, '0')} ${local.hour < 12 ? 'AM' : 'PM'}`
      : `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
    timeZone = local.timeZoneId;
  } catch {
    timeZone = 'UTC';
    const local = Temporal.Instant.fromEpochMilliseconds(match.instantMs).toZonedDateTimeISO('UTC');
    localDate = local.toPlainDate().toString();
    localTime = hour12
      ? `${local.hour % 12 || 12}:${String(local.minute).padStart(2, '0')} ${local.hour < 12 ? 'AM' : 'PM'}`
      : `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
  }
  return {
    countdown: countdownText(deltaMs), localDate, localTime, timeZone,
    sourceLabel: match.sourceLabel, assumption: match.assumedDate || '',
    isoInstant: Temporal.Instant.fromEpochMilliseconds(match.instantMs).toString(), state,
  };
}
