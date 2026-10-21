import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const decision = process.argv[2];
if (!['cancel', 'accept'].includes(decision)) throw new Error('Usage: node scripts/native-permission-qa.mjs cancel|accept');
const qaDir = path.join(root, 'qa');
const profile = await mkdtemp('/tmp/codex-chrome-run-hlu-native-');
const snapMirror = `/tmp/snap-private-tmp/snap.chromium${profile}`;
const screenshot = path.join(qaDir, `native-permission-${decision}.png`);
const resultPath = path.join(qaDir, `native-permission-${decision}-results.json`);
let browser;
let server;
let popup;
let page;

async function screenCapture(file) {
  await mkdir(qaDir, { recursive: true });
  execFileSync('import', ['-window', 'root', file], { timeout: 15000 });
}
async function stateFromContext(context) {
  return context.evaluate(async () => ({
    permissions: await chrome.permissions.getAll(),
    settings: (await chrome.storage.local.get('settings')).settings || null,
  }));
}
function xdotool(...args) {
  execFileSync('xdotool', args, { timeout: 5000 });
}
async function poll(predicate, message, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(message);
}

try {
  await mkdir(qaDir, { recursive: true });
  server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><main><p id="time">Meeting begins at 18:00 UTC.</p></main></body></html>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  browser = await puppeteer.launch({
    executablePath: '/snap/bin/chromium',
    headless: false,
    userDataDir: profile,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  const workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().endsWith('/background.js'), { timeout: 15000 });
  const extensionId = new URL(workerTarget.url()).hostname;
  const worker = await workerTarget.worker();
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle2' });
  xdotool('mousemove', '1166', '38', 'click', '1');
  await new Promise(resolve => setTimeout(resolve, 500));
  xdotool('mousemove', '987', '199', 'click', '1');
  const popupTarget = await browser.waitForTarget(target => target.url() === `chrome-extension://${extensionId}/popup.html`, { timeout: 10000 });
  popup = await popupTarget.asPage();
  await popup.waitForSelector('#enable-toggle');
  const initial = await stateFromContext(worker);
  assert.equal(initial.settings?.enabled || false, false, 'settings start disabled');
  assert.equal(await worker.evaluate(() => chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })), false, 'production manifest starts without optional host access');

  assert.match(await popup.$eval('#event-state', node => node.textContent), /Enable highlighting/);
  await popup.click('#enable-toggle');
  await new Promise(resolve => setTimeout(resolve, 1200));
  await screenCapture(screenshot);
  console.log(JSON.stringify({ phase: 'native-permission-prompt', decision, screenshot, extensionId }));

  if (decision === 'cancel') {
    execFileSync('xdotool', ['key', 'Escape']);
  } else {
    const x = Number(process.env.HLU_ALLOW_X);
    const y = Number(process.env.HLU_ALLOW_Y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('Set HLU_ALLOW_X and HLU_ALLOW_Y to the visible Allow button coordinates.');
    execFileSync('xdotool', ['mousemove', String(x), String(y), 'click', '1']);
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
  await screenCapture(path.join(qaDir, `native-permission-${decision}-after.png`));

  const state = await stateFromContext(worker);
  const hasAccess = await worker.evaluate(() => chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }));
  const enabled = state.settings?.enabled || false;
  const highlighted = await page.evaluate(() => CSS.highlights.has('hlu-event-time'));
  const result = {
    decision,
    nativePromptObserved: true,
    hasOptionalHttpAndHttpsAccess: hasAccess,
    settingsEnabled: enabled,
    pageHighlighted: highlighted,
    promptScreenshot: screenshot,
    afterScreenshot: path.join(qaDir, `native-permission-${decision}-after.png`),
    status: decision === 'cancel'
      ? (!hasAccess && !enabled && !highlighted ? 'PASS' : 'FAIL')
      : (hasAccess && enabled && highlighted ? 'PASS' : 'FAIL'),
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  if (decision === 'cancel') {
    assert.equal(hasAccess, false, 'cancel leaves optional host access absent');
    assert.equal(enabled, false, 'cancel leaves settings disabled');
    assert.equal(highlighted, false, 'cancel leaves page unhighlighted');
  } else {
    assert.equal(hasAccess, true, 'Allow grants both optional HTTP and HTTPS origins');
    assert.equal(enabled, true, 'Allow enables local settings');
    assert.equal(highlighted, true, 'accepted permission highlights the ordinary page');
    assert.equal(await page.$eval('#time', node => node.textContent), 'Meeting begins at 18:00 UTC.', 'page wording remains unchanged');
  }
  console.log(JSON.stringify(result));
} finally {
  if (popup && !popup.isClosed()) await popup.close().catch(() => {});
  if (page && !page.isClosed()) await page.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  await rm(snapMirror, { recursive: true, force: true });
}
