# Shared implementation contract

## Time engine: src/time-engine.js

Export `scanText(text, options = {})` and `formatEvent(match, options = {})`.

Options: `nowMs` (default Date.now()), `targetZone` (default browser zone), `hour12` (default false), `overrides` (abbreviation to offset string or IANA zone).

Each valid match: `{ start, end, original, instantMs, sourceLabel, assumedDate }`. Indices are JavaScript string offsets; `end` is exclusive. Invalid or unresolved times are not matches. Never return NaN. UTC and explicit offsets are authoritative. Bare times resolve in the source zone to their next occurrence. A dated event never rolls into the future just because it has passed. Date parsing is explicit, not locale-dependent Date.parse guessing.

`formatEvent` returns `{ countdown, localDate, localTime, timeZone, sourceLabel, assumption, isoInstant, state }`; state is `future`, `past`, or `now`. Countdown refreshes against nowMs; never rolls a matched instant into tomorrow after midnight. Assumption is a readable string only when date was inferred.

## Preferences: src/settings.js (owned by integration)

`DEFAULT_SETTINGS`: `{ enabled: false, siteDisabled: [], timeZone: 'system', hour12: false, abbreviationOverrides: {} }`. Stored under `chrome.storage.local.settings`; siteDisabled contains HTTP(S) origins. Export `resolveSettings(value)` to merge/validate defaults and `resolvedTimeZone(settings)`.

## Content and popup messaging

Content listens for `{type: 'HLU_STATUS'}` and returns `{ enabled, count, events }`; events are the first 50 match snapshots with fields from match plus `formatEvent`. Content also listens for `{type: 'HLU_RESCAN'}` and `{type:'HLU_REVEAL', index}`; it returns a status snapshot after rescan. Reveal scrolls the requested match into view and opens its tooltip. Result indices refer to the current content snapshot, no raw page text is persisted.

Popup requests optional origins `http://*/*`, `https://*/*` on the user gesture, then sends background `{type:'HLU_CONFIGURE'}`. It updates settings directly through storage.local. Background reads settings, registers or unregisters packaged content scripts, and injects into already open permitted HTTP(S) tabs without duplicate listeners. Registration id `hlu-pages`; files `content.js`, `content.css`; document_idle, allFrames true. Content uses a global guard and observes storage changes to remove highlights/stop work immediately on disable.

Content uses `scanText`/`formatEvent` bundled locally. Page UI root id `hlu-ui-root`; skip its own UI and code/editable/hidden content. Preserve page text nodes, links, and event handlers. Highlight namespace `hlu-event-time`; tooltip isolated in Shadow DOM. Handle inline-split expressions within one text block. Only one visible tooltip timer; stop it when closed or tab hidden.

Popup receives restricted-page or missing-content-script errors as an honest empty/unavailable state. Never fake an event count. Optional reminders are a disabled “Reminders · Pro — Soon” label.
