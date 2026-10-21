import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const backgroundUrl = pathToFileURL(path.resolve('src/background.js')).href;
let importSequence = 0;

function eventHook() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    listeners,
    fire(...args) { return listeners.map(listener => listener(...args)); },
  };
}

function createChromeMock({ enabled = false, permitted = false } = {}) {
  const state = {
    settings: { enabled, siteDisabled: [], timeZone: 'system', hour12: false, abbreviationOverrides: {} },
    grantedOrigins: permitted ? ['http://*/*', 'https://*/*'] : [],
    registered: [],
    registerCalls: 0,
    unregisterCalls: 0,
    registerErrors: [],
    tabMessages: [],
    runtimeLastError: null,
  };
  const runtime = {
    onMessage: eventHook(),
    onInstalled: eventHook(),
    onStartup: eventHook(),
    get lastError() { return state.runtimeLastError; },
  };
  const callback = (fn, error = null) => {
    state.runtimeLastError = error ? { message: error } : null;
    fn?.();
    state.runtimeLastError = null;
  };
  const chrome = {
    runtime,
    storage: {
      local: {
        get(key, done) { done({ [key]: structuredClone(state.settings) }); },
        set(value, done) { Object.assign(state, value); done?.(); },
      },
    },
    permissions: {
      contains({ origins }, done) { done(origins.every(origin => state.grantedOrigins.includes(origin))); },
      onAdded: eventHook(),
      onRemoved: eventHook(),
    },
    scripting: {
      getRegisteredContentScripts(_query, done) { done(state.registered.map(script => ({ ...script }))); },
      unregisterContentScripts({ ids }, done) {
        state.unregisterCalls += 1;
        const found = state.registered.filter(script => ids.includes(script.id));
        if (!found.length) return callback(done, `Could not find script with ID: ${ids[0]}`);
        state.registered = state.registered.filter(script => !ids.includes(script.id));
        callback(done);
      },
      registerContentScripts(scripts, done) {
        state.registerCalls += 1;
        const duplicate = scripts.find(incoming => state.registered.some(script => script.id === incoming.id));
        if (duplicate) {
          state.registerErrors.push(`Duplicate script id: ${duplicate.id}`);
          return callback(done, `Duplicate script id: ${duplicate.id}`);
        }
        state.registered.push(...scripts.map(script => ({ ...script })));
        callback(done);
      },
      insertCSS(_details, done) { callback(done); },
      executeScript(_details, done) { callback(done); },
    },
    tabs: {
      query(_query, done) { done([]); },
      sendMessage(tabId, message, options, done) {
        state.tabMessages.push({ tabId, message, options });
        done({ received: message.type });
      },
    },
  };
  return { chrome, state };
}

async function loadBackground(chrome) {
  globalThis.chrome = chrome;
  importSequence += 1;
  return import(`${backgroundUrl}?test-run=${importSequence}`);
}

function sendConfigure(chrome) {
  const [handler] = chrome.runtime.onMessage.listeners;
  assert.equal(typeof handler, 'function', 'background message listener should be registered');
  return new Promise((resolve, reject) => {
    const keepChannelOpen = handler({ type: 'HLU_CONFIGURE' }, {}, response => {
      if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
    assert.equal(keepChannelOpen, true, 'configure keeps the response channel open');
  });
}

function sendToTab(chrome, message) {
  const [handler] = chrome.runtime.onMessage.listeners;
  return new Promise((resolve, reject) => {
    const keepChannelOpen = handler(message, {}, response => {
      if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
    assert.equal(keepChannelOpen, true, `${message.type} keeps the response channel open`);
  });
}

async function waitFor(predicate, message) {
  for (let tries = 0; tries < 30; tries += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.fail(message);
}

test('fresh configure with no registered script resolves cleanly', async () => {
  const { chrome, state } = createChromeMock();
  await loadBackground(chrome);

  const response = await sendConfigure(chrome);

  assert.deepEqual(response, { configured: false, permitted: false });
  assert.deepEqual(state.registered, []);
  assert.equal(state.unregisterCalls, 0, 'missing IDs are checked before unregistering');
});

test('enabled configuration with granted host access registers the packaged script once', async () => {
  const { chrome, state } = createChromeMock({ enabled: true, permitted: true });
  await loadBackground(chrome);

  const response = await sendConfigure(chrome);

  assert.deepEqual(response, { configured: true, permitted: true });
  assert.equal(state.registerCalls, 1);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);
  assert.deepEqual(state.registered[0].js, ['content.js']);
  assert.deepEqual(state.registered[0].css, ['content.css']);
  assert.equal(state.registered[0].runAt, 'document_idle');
  assert.equal(state.registered[0].allFrames, true);
});

test('serial repeated configure messages leave exactly one registration without duplicate errors', async () => {
  const { chrome, state } = createChromeMock({ enabled: true, permitted: true });
  await loadBackground(chrome);

  const responses = await Promise.all([
    sendConfigure(chrome), sendConfigure(chrome), sendConfigure(chrome),
  ]);

  assert.ok(responses.every(response => response.configured === true));
  assert.equal(state.registerErrors.length, 0);
  assert.equal(state.registerCalls, 3);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);
});

test('removing host access disables the setting and unregisters the content script', async () => {
  const { chrome, state } = createChromeMock({ enabled: true, permitted: true });
  await loadBackground(chrome);
  await sendConfigure(chrome);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);

  state.grantedOrigins = [];
  chrome.permissions.onRemoved.fire({ origins: ['http://*/*', 'https://*/*'] });
  await waitFor(() => state.settings.enabled === false && state.registered.length === 0,
    'permission removal should disable settings and unregister the script');

  assert.equal(state.settings.enabled, false);
  assert.deepEqual(state.registered, []);
});

test('enabled setting without host access does not register page code', async () => {
  const { chrome, state } = createChromeMock({ enabled: true, permitted: false });
  await loadBackground(chrome);

  const response = await sendConfigure(chrome);

  assert.deepEqual(response, { configured: false, permitted: false });
  assert.equal(state.registerCalls, 0);
  assert.deepEqual(state.registered, []);
});

test('full host grant enables and configures in the background after the popup is gone', async () => {
  const { chrome, state } = createChromeMock({ enabled: false, permitted: false });
  state.settings = {
    ...state.settings,
    timeZone: 'Europe/Paris',
    siteDisabled: ['https://example.test'],
    hour12: true,
  };
  await loadBackground(chrome);

  state.grantedOrigins = ['http://*/*', 'https://*/*'];
  chrome.permissions.onAdded.fire({ origins: ['http://*/*', 'https://*/*'] });
  await waitFor(() => state.settings.enabled === true && state.registered.length === 1,
    'full permission grant should enable settings and register page code without popup callbacks');

  assert.equal(state.settings.enabled, true);
  assert.equal(state.settings.timeZone, 'Europe/Paris');
  assert.deepEqual(state.settings.siteDisabled, ['https://example.test']);
  assert.equal(state.settings.hour12, true);
  assert.equal(state.registerCalls, 1);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);
});

test('full host grant configures even if the popup saved enabled before closing', async () => {
  const { chrome, state } = createChromeMock({ enabled: true, permitted: false });
  await loadBackground(chrome);

  state.grantedOrigins = ['http://*/*', 'https://*/*'];
  chrome.permissions.onAdded.fire({ origins: ['http://*/*', 'https://*/*'] });
  await waitFor(() => state.registered.length === 1,
    'permission grant should complete configuration when enabled was already saved');

  assert.equal(state.settings.enabled, true);
  assert.equal(state.registerCalls, 1);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);
});

test('partial host grant stays disabled until both optional origins are present', async () => {
  const { chrome, state } = createChromeMock({ enabled: false, permitted: false });
  await loadBackground(chrome);

  state.grantedOrigins = ['http://*/*'];
  chrome.permissions.onAdded.fire({ origins: ['http://*/*'] });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(state.settings.enabled, false);
  assert.equal(state.registerCalls, 0);

  state.grantedOrigins.push('https://*/*');
  chrome.permissions.onAdded.fire({ origins: ['https://*/*'] });
  await waitFor(() => state.settings.enabled === true && state.registered.length === 1,
    'completing both origins should enable and configure');

  assert.equal(state.registerCalls, 1);
  assert.deepEqual(state.registered.map(script => script.id), ['hlu-pages']);
});

test('status and reveal messages are routed to the main document frame', async () => {
  const { chrome, state } = createChromeMock();
  await loadBackground(chrome);

  const status = await sendToTab(chrome, { type: 'HLU_STATUS', tabId: 42 });
  const reveal = await sendToTab(chrome, { type: 'HLU_REVEAL', tabId: 42, index: 7 });

  assert.deepEqual(status, { received: 'HLU_STATUS' });
  assert.deepEqual(reveal, { received: 'HLU_REVEAL' });
  assert.deepEqual(state.tabMessages, [
    { tabId: 42, message: { type: 'HLU_STATUS' }, options: { frameId: 0 } },
    { tabId: 42, message: { type: 'HLU_REVEAL', index: 7 }, options: { frameId: 0 } },
  ]);
});
