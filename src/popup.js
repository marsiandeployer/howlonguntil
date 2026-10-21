import { DEFAULT_SETTINGS, resolveSettings } from './settings.js';

const OPTIONAL_ORIGINS = ['http://*/*', 'https://*/*'];
const REPOSITORY_URL = 'https://github.com/marsiandeployer/howlonguntil';
const OVERRIDE_DEFAULTS = { CST: '-06:00', IST: '+05:30', BST: '+01:00', EST: '-05:00', PST: '-08:00' };
const elements = Object.fromEntries([
  'active-mark', 'enable-toggle', 'permission-note', 'site-label', 'site-toggle',
  'event-count', 'event-state', 'event-list', 'timezone', 'hour12', 'settings-state',
  'override-cst', 'override-ist', 'override-bst', 'override-est', 'override-pst',
].map(id => [id, document.getElementById(id)]));

let settings = { ...DEFAULT_SETTINGS };
let currentTab = null;
let events = [];
let scanState = 'loading';
let refreshTimer = null;
let configureWarning = '';

function runtimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    });
  });
}

async function readSettings() {
  const result = await chrome.storage.local.get('settings');
  return resolveSettings(result.settings);
}

async function writeSettings(patch, { configure = ('enabled' in patch || 'siteDisabled' in patch) } = {}) {
  settings = resolveSettings({ ...settings, ...patch });
  await chrome.storage.local.set({ settings });
  if (configure) {
    try {
      const result = await runtimeMessage({ type: 'HLU_CONFIGURE' });
      if (result?.error) {
        configureWarning = `Settings saved, but open pages could not be updated: ${result.error}`;
      } else configureWarning = '';
    } catch {
      configureWarning = 'Settings saved. Close and reopen the popup if page access does not update.';
    }
  }
  renderSettings();
}

function getOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch { return null; }
}

function renderSettings() {
  elements['enable-toggle'].setAttribute('aria-checked', String(settings.enabled));
  elements['active-mark'].classList.toggle('on', settings.enabled);
  elements.timezone.value = settings.timeZone;
  elements.hour12.checked = settings.hour12;
  for (const abbreviation of ['cst', 'ist', 'bst', 'est', 'pst']) {
    const key = abbreviation.toUpperCase();
    const value = settings.abbreviationOverrides[key] ?? OVERRIDE_DEFAULTS[key];
    elements[`override-${abbreviation}`].value = value;
  }
  const origin = currentTab && getOrigin(currentTab.url);
  const isDisabled = origin ? settings.siteDisabled.includes(origin) : false;
  elements['site-label'].textContent = origin ? new URL(currentTab.url).hostname : 'Unavailable on this page';
  elements['site-toggle'].disabled = !origin || !settings.enabled;
  elements['site-toggle'].setAttribute('aria-checked', String(Boolean(origin && settings.enabled && !isDisabled)));
  elements['permission-note'].hidden = true;
  if (configureWarning) {
    elements['permission-note'].textContent = configureWarning;
    elements['permission-note'].hidden = false;
  } else if (settings.enabled && !origin) {
    elements['permission-note'].textContent = 'Chrome restricts access to this page. Try a regular http or https website.';
    elements['permission-note'].hidden = false;
  }
}

function formatRemaining(instantMs) {
  if (!Number.isFinite(instantMs)) return '';
  const delta = instantMs - Date.now();
  if (Math.abs(delta) < 60_000) return delta < 0 ? 'just passed' : 'less than a minute';
  let seconds = Math.floor(Math.abs(delta) / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return `${delta < 0 ? '−' : ''}${parts.join(' ')}`;
}

function renderEvents() {
  const list = elements['event-list'];
  list.replaceChildren();
  elements['event-count'].textContent = events.length ? String(events.length) : '';
  if (scanState === 'loading') {
    elements['event-state'].textContent = 'Checking this page…';
    return;
  }
  if (!settings.enabled) {
    elements['event-state'].textContent = 'Enable highlighting to scan this page.';
    return;
  }
  if (scanState === 'restricted') {
    elements['event-state'].textContent = 'This page does not allow extensions to read its content.';
    return;
  }
  if (scanState === 'unavailable') {
    elements['event-state'].textContent = settings.enabled
      ? 'Could not read this page yet. Reload it after enabling access.'
      : 'Enable highlighting to scan this page.';
    return;
  }
  const origin = currentTab && getOrigin(currentTab.url);
  if (origin && settings.siteDisabled.includes(origin)) {
    elements['event-state'].textContent = 'Highlighting is paused for this site.';
    return;
  }
  if (!events.length) {
    elements['event-state'].textContent = 'No supported time references found on this page.';
    return;
  }
  elements['event-state'].textContent = 'Select a time to reveal it on the page.';
  events.forEach((event, index) => {
    const item = document.createElement('li');
    item.className = 'event-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'event-button';
    const source = document.createElement('span');
    source.className = 'event-source';
    source.textContent = event.original || event.sourceLabel || 'Event time';
    const countdown = document.createElement('span');
    countdown.className = 'event-countdown';
    countdown.dataset.instant = String(event.instantMs ?? '');
    countdown.textContent = event.countdown || formatRemaining(event.instantMs);
    const details = document.createElement('span');
    details.className = 'event-details';
    const local = [event.localDate, event.localTime].filter(Boolean).join(' · ');
    details.textContent = [local, event.timeZone || event.sourceLabel, event.assumption].filter(Boolean).join(' · ');
    button.append(source, countdown, details);
    button.addEventListener('click', async () => {
      try { await runtimeMessage({ type: 'HLU_REVEAL', index }); }
      catch { elements['event-state'].textContent = 'This page is no longer available. Reopen the popup to refresh.'; }
    });
    item.append(button);
    list.append(item);
  });
}

function tickCountdowns() {
  document.querySelectorAll('.event-countdown[data-instant]').forEach(node => {
    const instant = Number(node.dataset.instant);
    if (Number.isFinite(instant)) node.textContent = formatRemaining(instant);
  });
}

async function getPageStatus() {
  if (!currentTab?.id || !settings.enabled || !getOrigin(currentTab.url)) {
    events = [];
    scanState = getOrigin(currentTab?.url) ? 'unavailable' : 'restricted';
    renderEvents();
    return;
  }
  if (settings.siteDisabled.includes(getOrigin(currentTab.url))) {
    events = [];
    scanState = 'ready';
    renderEvents();
    return;
  }
  try {
    const response = await runtimeMessage({ type: 'HLU_STATUS', tabId: currentTab.id });
    if (!response || !Array.isArray(response.events)) throw new Error('Content status unavailable');
    events = response.events.slice(0, 50);
    scanState = 'ready';
    renderEvents();
  } catch (error) {
    events = [];
    scanState = /cannot access|extensions gallery|chrome:|edge:|about:/i.test(error.message) ? 'restricted' : 'unavailable';
    renderEvents();
  }
}

function fillTimezones() {
  const datalist = document.getElementById('timezones');
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  if (!zones.length) zones.push('UTC', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo');
  datalist.replaceChildren(...zones.map(zone => {
    const option = document.createElement('option'); option.value = zone; return option;
  }));
  const system = document.createElement('option'); system.value = 'system'; datalist.append(system);
}

async function setEnabledFromGesture() {
  if (settings.enabled) {
    await writeSettings({ enabled: false });
    events = [];
    scanState = 'unavailable';
    renderEvents();
    return;
  }
  elements['permission-note'].hidden = true;
  try {
    const granted = await chrome.permissions.request({ origins: OPTIONAL_ORIGINS });
    if (!granted) {
      elements['permission-note'].textContent = 'Website access was not granted. Highlighting remains off; you can try again here.';
      elements['permission-note'].hidden = false;
      return;
    }
    await writeSettings({ enabled: true });
    await getPageStatus();
  } catch {
    elements['permission-note'].textContent = 'Chrome could not grant website access. Try again from the extension popup.';
    elements['permission-note'].hidden = false;
  }
}

async function toggleThisSite() {
  const origin = currentTab && getOrigin(currentTab.url);
  if (!origin) return;
  const blocked = new Set(settings.siteDisabled);
  if (blocked.has(origin)) blocked.delete(origin); else blocked.add(origin);
  await writeSettings({ siteDisabled: [...blocked] });
  if (!blocked.has(origin)) await getPageStatus();
  else { events = []; scanState = 'ready'; renderEvents(); }
}

function validateTimeZone(value) {
  if (value === 'system') return true;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}

function validOverride(value) {
  if (!value) return true;
  if (/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value)) return true;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}

function savePreference(input, save) {
  input.addEventListener('change', async () => {
    try { await save(input); elements['settings-state'].textContent = 'Saved on this device.'; }
    catch { elements['settings-state'].textContent = 'Could not save that setting. Check its format.'; }
  });
}

async function init() {
  try {
    settings = await readSettings();
    const [tabs] = await Promise.all([chrome.tabs.query({ active: true, lastFocusedWindow: true })]);
    currentTab = tabs?.[0] || null;
    renderSettings();
    fillTimezones();
    await getPageStatus();
  } catch {
    scanState = 'unavailable';
    elements['event-state'].textContent = 'Extension settings are temporarily unavailable.';
  }
  elements['enable-toggle'].addEventListener('click', setEnabledFromGesture);
  elements['site-toggle'].addEventListener('click', toggleThisSite);
  elements.hour12.addEventListener('change', () => writeSettings({ hour12: elements.hour12.checked }));
  savePreference(elements.timezone, async input => {
    if (!validateTimeZone(input.value.trim())) throw new Error('invalid zone');
    await writeSettings({ timeZone: input.value.trim() || 'system' });
  });
  for (const abbreviation of ['cst', 'ist', 'bst', 'est', 'pst']) {
    const key = abbreviation.toUpperCase();
    savePreference(elements[`override-${abbreviation}`], async input => {
      const value = input.value.trim();
      if (!validOverride(value)) throw new Error('invalid override');
      const abbreviationOverrides = { ...settings.abbreviationOverrides };
      if (value) abbreviationOverrides[key] = value;
      else delete abbreviationOverrides[key];
      await writeSettings({ abbreviationOverrides });
    });
  }
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      settings = resolveSettings(changes.settings.newValue);
      renderSettings();
      getPageStatus();
    });
  }
  refreshTimer = window.setInterval(tickCountdowns, 1000);
  window.addEventListener('unload', () => { if (refreshTimer) clearInterval(refreshTimer); }, { once: true });
  document.querySelector('footer a')?.setAttribute('href', REPOSITORY_URL);
}

init();
