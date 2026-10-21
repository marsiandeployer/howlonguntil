export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  siteDisabled: [],
  timeZone: 'system',
  hour12: false,
  abbreviationOverrides: {},
});

export function resolveSettings(value = {}) {
  return {
    enabled: value.enabled === true,
    siteDisabled: Array.isArray(value.siteDisabled)
      ? [...new Set(value.siteDisabled.filter(v => typeof v === 'string' && /^https?:\/\/[^/]+$/.test(v)))]
      : [],
    timeZone: typeof value.timeZone === 'string' && value.timeZone ? value.timeZone : 'system',
    hour12: value.hour12 === true,
    abbreviationOverrides: value.abbreviationOverrides && typeof value.abbreviationOverrides === 'object'
      && !Array.isArray(value.abbreviationOverrides) ? value.abbreviationOverrides : {},
  };
}

export function resolvedTimeZone(settings) {
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (settings.timeZone === 'system') return system;
  try { new Intl.DateTimeFormat('en', { timeZone: settings.timeZone }); return settings.timeZone; }
  catch { return system; }
}
