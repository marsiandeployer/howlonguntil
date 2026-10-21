import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-chrome-run-hlu-'));
const fixedNow = Date.parse('2026-10-21T15:45:00Z');
const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>How Long Until demo</title><style>
body{margin:0;background:#faf8f2;color:#282331;font:19px/1.7 system-ui,sans-serif}main{max-width:850px;margin:65px auto;padding:0 32px}h1{font-size:46px;letter-spacing:-.035em;line-height:1.1;margin:10px 0 24px}p{margin:24px 0}a{color:#5139a5}small{color:#71677d}textarea{width:300px}#excluded{font-size:13px;margin-top:40px}strong{font-weight:600}</style></head>
<body><main><small>How Long Until · Demo page</small><h1>The next event is already on this page.</h1>
<p id="basic">The keynote begins at <strong>18:00 UTC</strong>.</p>
<p id="split">Team sync: <span>6 PM</span> <span>EST</span>.</p>
<p id="dated">Release: 2026-10-22 at 18:00 UTC.</p>
<p id="offset">Workshop: 18:00 GMT+05:30.</p>
<p><a href="#event" id="event-link">21:00 UTC</a> — the original link still works.</p>
<div id="excluded"><code>18:00 UTC</code><pre>18:00 UTC</pre><p hidden>18:00 UTC</p><textarea>18:00 UTC</textarea><p contenteditable="true">18:00 UTC</p><p>Plain 18:00, invalid 2026-02-30 18:00 UTC, and issue #1800 stay alone.</p></div>
</main><script>window.linkClicks=0;document.querySelector('#event-link').addEventListener('click',()=>window.linkClicks++);</script></body></html>`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url === '/large') res.end(`<html><title>Large fixture</title><body>${Array.from({ length: 5000 }, (_, i) => `<p>Ordinary paragraph ${i}. ${i % 50 === 0 ? 'Event at 18:00 UTC.' : 'No event time in this paragraph.'}</p>`).join('')}</body></html>`);
  else res.end(fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const failures = [], checks = [], requests = [];
let browser;
let fixtureDir;
let stage = 'starting';
let watchdog;
const record = (name, details = {}) => { checks.push({ name, ...details }); console.log(`PASS ${name}`); };
try {
  await mkdir('qa', { recursive: true });
  browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium',
    headless: true, pipe: true, enableExtensions: true, userDataDir: profile,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  watchdog = setTimeout(() => { console.error(`QA timed out at: ${stage}`); browser?.close(); }, 100_000);
  let extensionId = await browser.installExtension(path.resolve('dist'));
  let workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().includes(extensionId));
  let worker = await workerTarget.worker();
  const initialPermissions = await worker.evaluate(() => chrome.permissions.getAll());
  assert.deepEqual(initialPermissions.origins, []);
  record('fresh installation has no website access');
  const page = await browser.newPage();
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', req => requests.push({ url: req.url(), frame: 'page' }));
  await page.goto(origin, { waitUntil: 'networkidle2' });
  assert.equal(await page.evaluate(() => CSS.highlights.has('hlu-event-time')), false);
  record('page remains untouched before opt-in');

  // Headless Chrome cannot accept the native optional-permission dialog. Test
  // functional behavior with byte-identical JS and test-only pre-granted hosts.
  // This copy is never shipped; production's no-access default was checked above.
  await browser.uninstallExtension(extensionId);
  fixtureDir = await mkdtemp(path.resolve('qa/.extension-fixture-'));
  await cp('dist', fixtureDir, { recursive: true });
  const testManifest = JSON.parse(await readFile(path.join(fixtureDir, 'manifest.json'), 'utf8'));
  testManifest.host_permissions = testManifest.optional_host_permissions;
  delete testManifest.optional_host_permissions;
  await writeFile(path.join(fixtureDir, 'manifest.json'), JSON.stringify(testManifest));
  for (const file of ['content.js', 'background.js', 'popup.js']) {
    assert.deepEqual(await readFile(path.join(fixtureDir, file)), await readFile(path.join('dist', file)));
  }
  extensionId = await browser.installExtension(fixtureDir);
  workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().includes(extensionId));
  worker = await workerTarget.worker();
  const workerCdp = await workerTarget.createCDPSession();
  await workerCdp.send('Network.enable');
  workerCdp.on('Network.requestWillBeSent', event => requests.push({ url: event.request.url, frame: 'worker' }));
  const grantedPermissions = await worker.evaluate(() => chrome.permissions.getAll());
  assert.ok(grantedPermissions.origins.includes('http://*/*'));
  record('functional fixture uses byte-identical JS with test-only pre-granted hosts');
  const controller = await browser.newPage();
  controller.on('request', req => requests.push({ url: req.url(), frame: 'extension' }));
  controller.on('pageerror', error => failures.push(error.message));
  await controller.goto(`chrome-extension://${extensionId}/popup.html`);
  const [tab] = await controller.evaluate(async origin => (await chrome.tabs.query({})).filter(tab => tab.url?.startsWith(origin)), origin);
  assert.ok(tab?.id);
  // Freeze only the extension realm's clock for reproducible store/demo captures.
  await worker.evaluate(async (tabId, clock) => chrome.scripting.executeScript({ target: { tabId },
    func: value => { Date.now = () => value; }, args: [clock] }), tab.id, fixedNow);
  await controller.evaluate(async () => chrome.storage.local.set({ settings: { enabled: false, siteDisabled: [], timeZone: 'Europe/Moscow', hour12: false, abbreviationOverrides: {} } }));
  await controller.waitForSelector('#enable-toggle');
  await controller.click('#enable-toggle');
  await controller.waitForFunction(() => document.querySelector('#enable-toggle').getAttribute('aria-checked') === 'true');
  const configured = await controller.evaluate(() => chrome.runtime.sendMessage({ type: 'HLU_CONFIGURE' }));
  assert.ok(configured.configured, JSON.stringify(configured));
  const status = () => controller.evaluate(tabId => chrome.tabs.sendMessage(tabId, { type: 'HLU_STATUS' }), tab.id);
  async function waitCount(expected) {
    let last;
    for (let i = 0; i < 80; i++) {
      last = await status().catch(() => null);
      if (last?.count === expected) return last;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Expected ${expected} detected times, got ${JSON.stringify(last)}`);
  }
  let state = await waitCount(5);
  assert.ok(state.events.some(event => event.original === '6 PM EST'));
  assert.equal(state.events[0].localTime, '21:00');
  assert.equal(state.events[0].countdown, 'in 2 hours 15 minutes');
  assert.equal(state.events[0].isoInstant, '2026-10-21T18:00:00Z');
  assert.ok(state.events.every(event => !event.original.includes('02-30')));
  record('real content script detects supported formats and inline-split text; skips excluded content', { count: state.count });
  await page.bringToFront();
  const originalBasic = await page.$eval('#basic', node => node.innerHTML);
  assert.equal(originalBasic, 'The keynote begins at <strong>18:00 UTC</strong>.');
  assert.equal(await page.evaluate(() => CSS.highlights.get('hlu-event-time')?.size), 5);
  const rect = await page.$eval('#basic strong', node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(rect.x, rect.y);
  await new Promise(resolve => setTimeout(resolve, 120));
  await page.screenshot({ path: 'qa/hover-demo.png' });
  // Inspect the closed tooltip via browser debugging, without exposing it to page JS.
  const cdp = await page.createCDPSession();
  await cdp.send('DOM.enable');
  const dom = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  let tooltipText = '';
  const collect = node => { if (node.nodeName === '#text') tooltipText += ` ${node.nodeValue}`; for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) collect(child); };
  collect(dom.root);
  assert.match(tooltipText, /in 2 hours 15 minutes/);
  record('actual pointer hover opens live countdown tooltip');
  stage = 'Escape and original link click';
  console.log(`Checking ${stage}`);
  await page.keyboard.press('Escape');
  const linkRect = await page.evaluate(() => { const rect = document.querySelector('#event-link').getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; });
  await page.mouse.click(linkRect.x, linkRect.y);
  assert.equal(await page.evaluate(() => window.linkClicks), 1);
  record('original text, inline markup and link handlers are preserved');
  stage = 'dynamic content updates';
  await page.evaluate(() => { const p = document.createElement('p'); p.id = 'dynamic'; p.textContent = 'Added at 19:00 UTC.'; document.querySelector('main').append(p); });
  await waitCount(6);
  await page.$eval('#dynamic', node => node.firstChild.nodeValue = 'Changed to 20:00 UTC.');
  state = await waitCount(6);
  for (let i = 0; i < 40 && !state.events.some(event => event.original === '20:00 UTC'); i++) { await new Promise(r => setTimeout(r, 100)); state = await status(); }
  assert.ok(state.events.some(event => event.original === '20:00 UTC'));
  record('dynamic insertions and changed time text update highlights');
  await page.$eval('#dynamic', node => node.remove());
  await waitCount(5);

  await page.bringToFront();
  stage = 'opening actual toolbar popup';
  await worker.evaluate(() => chrome.action.openPopup());
  const popupTarget = await browser.waitForTarget(target => target.url().endsWith('/popup.html') && target !== controller.target());
  const popup = await popupTarget.asPage();
  await popup.waitForFunction(() => document.querySelectorAll('.event-item').length === 5);
  stage = 'popup site switch';
  await new Promise(resolve => setTimeout(resolve, 200));
  await popup.screenshot({ path: 'qa/popup-enabled.png' });
  assert.match(await popup.evaluate(() => document.body.innerText), /Reminders · Pro/);
  await popup.click('#site-toggle');
  await waitCount(0);
  assert.equal(await page.evaluate(() => CSS.highlights.has('hlu-event-time')), false);
  record('actual popup per-site switch removes current-page highlights');
  if (!popup.isClosed()) await popup.close();
  await controller.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, siteDisabled: [] } }); await chrome.runtime.sendMessage({ type: 'HLU_CONFIGURE' }); });
  await waitCount(5);
  await controller.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, enabled: false } }); await chrome.runtime.sendMessage({ type: 'HLU_CONFIGURE' }); });
  await waitCount(0);
  assert.equal((await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts())).length, 0);
  record('global disable unregisters scripts and removes existing highlights');
  await controller.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, enabled: true } }); await chrome.runtime.sendMessage({ type: 'HLU_CONFIGURE' }); });
  await waitCount(5);
  assert.equal((await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts())).length, 1);
  record('re-enable registers exactly once without duplicate content injection');

  stage = 'large page scan';
  const largeStart = performance.now();
  await page.goto(`${origin}/large`, { waitUntil: 'networkidle2' });
  const largeState = await waitCount(100);
  const scanElapsedMs = Math.round(performance.now() - largeStart);
  assert.equal(largeState.events.length, 50);
  assert.equal(await page.evaluate(() => document.querySelectorAll('p').length), 5000);
  record('large page retains 5000 paragraphs and detects all 100 times', { scanElapsedMs, popupEvents: largeState.events.length });

  await controller.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, enabled: false } }); await chrome.runtime.sendMessage({ type: 'HLU_CONFIGURE' }); });
  await waitCount(0);
  const finalSettings = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.equal(finalSettings.enabled, false);
  assert.deepEqual(Object.keys(await worker.evaluate(() => chrome.storage.local.get(null))), ['settings']);
  record('only preferences are persisted; scanned page content stays in memory');
  const external = requests.filter(request => /^https?:/.test(request.url) && !request.url.startsWith(origin));
  assert.deepEqual(external, []);
  assert.deepEqual(failures, []);
  record('no external network requests or page errors observed', { observedRequests: requests.length });
  const result = { status: 'PASS', at: new Date().toISOString(), browser: await browser.version(), checks,
    limitations: ['Production manifest default/no-access state is verified. Native optional-permission accept/cancel dialog UI is not automated; functional UI/content checks use byte-identical JS and a separate test-only manifest with pre-granted hosts. Permission removal is covered by unit tests.'],
    productionManifest: JSON.parse(await readFile('dist/manifest.json', 'utf8')).version };
  await writeFile('qa/browser-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(`Browser acceptance passed: ${checks.length} checks.`);
} catch (error) {
  await writeFile('qa/browser-results.json', JSON.stringify({ status: 'FAIL', stage, error: error.stack, checks }, null, 2) + '\n');
  throw error;
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  await rm('/tmp/snap-private-tmp/snap.chromium' + profile, { recursive: true, force: true });
}
