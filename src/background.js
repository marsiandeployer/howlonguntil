import { resolveSettings } from './settings.js';

const SCRIPT_ID = 'hlu-pages';
const CONTENT_SCRIPT = {
  id: SCRIPT_ID,
  matches: ['http://*/*', 'https://*/*'],
  js: ['content.js'],
  css: ['content.css'],
  runAt: 'document_idle',
  allFrames: true,
  persistAcrossSessions: true,
};
const OPTIONAL_ORIGINS = ['http://*/*', 'https://*/*'];
let configureQueue = Promise.resolve();

function readSettings() {
  return new Promise(resolve => chrome.storage.local.get('settings', result => resolve(resolveSettings(result.settings))));
}

function permissionContains(origins) {
  return new Promise(resolve => chrome.permissions.contains({ origins }, resolve));
}

function getRegisteredContentScripts() {
  return new Promise((resolve, reject) => {
    chrome.scripting.getRegisteredContentScripts({}, scripts => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(scripts || []);
    });
  });
}

async function unregisterContentScripts() {
  const scripts = await getRegisteredContentScripts();
  if (!scripts.some(script => script.id === SCRIPT_ID)) return;
  return new Promise((resolve, reject) => {
    chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }, () => {
      const error = chrome.runtime.lastError;
      if (error && !/could not find (?:registered )?(?:content )?script (?:with )?id|no (?:registered )?(?:content )?scripts? (?:with )?id|(?:content )?script id .*not found|content script .*does not exist/i.test(error.message)) reject(new Error(error.message));
      else resolve();
    });
  });
}

function registerContentScripts() {
  return new Promise((resolve, reject) => {
    chrome.scripting.registerContentScripts([CONTENT_SCRIPT], () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve();
    });
  });
}

function isKnownRestrictedPageError(message = '') {
  return /cannot access contents of the page|cannot access a chrome|extensions gallery|chrome:\/\/|edge:\/\/|about:|web store/i.test(message);
}

function sendTabConfigure(tabId, tabUrl, enabled, settings) {
  if (!tabId || !/^https?:/i.test(tabUrl || '')) return Promise.resolve();
  let origin;
  try { origin = new URL(tabUrl).origin; } catch { return Promise.resolve(); }
  if (!enabled || settings.siteDisabled.includes(origin)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['content.css'] }, () => {
      const cssError = chrome.runtime.lastError;
      if (cssError) {
        if (isKnownRestrictedPageError(cssError.message)) return resolve();
        return reject(new Error(cssError.message));
      }
      chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] }, () => {
        const scriptError = chrome.runtime.lastError;
        if (scriptError && !isKnownRestrictedPageError(scriptError.message)) reject(new Error(scriptError.message));
        else resolve();
      });
    });
  });
}

async function performConfigure() {
  const settings = await readSettings();
  const permitted = await permissionContains(OPTIONAL_ORIGINS);
  if (!settings.enabled || !permitted) {
    await unregisterContentScripts();
    return { configured: false, permitted };
  }
  await unregisterContentScripts();
  await registerContentScripts();
  const tabs = await new Promise((resolve, reject) => chrome.tabs.query({}, result => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve(result || []);
  }));
  const results = await Promise.allSettled(tabs.map(tab => sendTabConfigure(tab.id, tab.url, settings.enabled, settings)));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return { configured: true, permitted };
}

function configure() {
  const result = configureQueue.then(performConfigure, performConfigure);
  configureQueue = result.catch(() => {});
  return result;
}

async function enableAfterHostPermissionGrant() {
  if (!await permissionContains(OPTIONAL_ORIGINS)) return;
  const current = await readSettings();
  if (!current.enabled) {
    const settings = resolveSettings({ ...current, enabled: true });
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ settings }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve();
      });
    });
  }
  await configure();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'HLU_CONFIGURE') {
    configure().then(sendResponse, error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'HLU_STATUS' || message?.type === 'HLU_REVEAL') {
    const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
    if (!Number.isInteger(tabId)) { sendResponse(null); return false; }
    const payload = message.type === 'HLU_STATUS' ? { type: 'HLU_STATUS' } : { type: 'HLU_REVEAL', index: message.index };
    chrome.tabs.sendMessage(tabId, payload, { frameId: 0 }, response => {
      const error = chrome.runtime.lastError;
      if (error) sendResponse({ error: error.message });
      else sendResponse(response);
    });
    return true;
  }
  return false;
});

chrome.permissions.onRemoved.addListener(({ origins = [] }) => {
  if (!origins.length) return;
  configure().then(async result => {
    if (!result.permitted) {
      const current = await readSettings();
      if (current.enabled) await chrome.storage.local.set({ settings: { ...current, enabled: false } });
    }
  }).catch(() => {});
});

chrome.permissions.onAdded.addListener(({ origins = [] }) => {
  if (!origins.some(origin => OPTIONAL_ORIGINS.includes(origin))) return;
  enableAfterHostPermissionGrant().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => { configure().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { configure().catch(() => {}); });
