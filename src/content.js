import { scanText, formatEvent } from './time-engine.js';
import { resolveSettings, resolvedTimeZone } from './settings.js';

(() => {
  if (window.__hluContentLoaded) return;
  window.__hluContentLoaded = true;

  const HIGHLIGHT_NAME = 'hlu-event-time';
  const ROOT_ID = 'hlu-ui-root';
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'PRE', 'KBD', 'SAMP',
    'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'SVG', 'CANVAS',
  ]);
  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DD', 'DETAILS',
    'DIALOG', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER',
    'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN',
    'NAV', 'OL', 'P', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TD', 'TFOOT',
    'TH', 'THEAD', 'TR', 'UL',
  ]);

  let settings = resolveSettings();
  let enabled = false;
  let observer = null;
  let debounceHandle = 0;
  let idleHandle = 0;
  let idleIsTimeout = false;
  let pointerFrame = 0;
  let pendingPointer = null;
  let timerHandle = 0;
  let closeHandle = 0;
  let generation = 0;
  let matches = [];
  let recordsByBlock = new Map();
  let visibilityCache = new WeakMap();
  let inFlightRoots = [];
  let activeMatch = null;
  let host = null;
  let shadow = null;
  let card = null;
  let fields = null;
  let ownHighlight = null;
  let styleNode = null;

  const pageOrigin = (() => {
    try { return location.origin; } catch { return ''; }
  })();

  function isEnabled() {
    return settings.enabled === true && !settings.siteDisabled.includes(pageOrigin)
      && /^https?:$/.test(location.protocol)
      && typeof CSS !== 'undefined' && CSS.highlights
      && typeof Highlight === 'function'
      && typeof CSS.highlights.highlightsFromPoint === 'function';
  }

  function ensureUI() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    shadow = host.attachShadow({ mode: 'closed' });
    styleNode = document.createElement('style');
    styleNode.textContent = tooltipStyles;
    card = document.createElement('section');
    card.className = 'card';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;

    const source = document.createElement('div');
    source.className = 'source';
    const countdown = document.createElement('div');
    countdown.className = 'countdown';
    countdown.setAttribute('aria-label', 'Time remaining');
    const local = document.createElement('div');
    local.className = 'local';
    const zone = document.createElement('div');
    zone.className = 'zone';
    const assumption = document.createElement('div');
    assumption.className = 'assumption';
    fields = { source, countdown, local, zone, assumption };
    card.append(source, countdown, local, zone, assumption);
    shadow.append(styleNode, card);
    document.documentElement.append(host);

    card.addEventListener('pointerenter', cancelClose);
    card.addEventListener('pointerleave', scheduleClose);
  }

  const tooltipStyles = `
    :host { all: initial; }
    .card {
      position: fixed; z-index: 2147483647; box-sizing: border-box;
      width: max-content; max-width: min(340px, calc(100vw - 24px));
      padding: 13px 16px 14px; border: 1px solid rgba(49, 37, 67, .13);
      border-radius: 12px; background: #fffefa; color: #211d27;
      box-shadow: 0 8px 26px rgba(27, 20, 38, .15);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: auto; color-scheme: light dark;
    }
    .card[hidden] { display: none; }
    .source { color: #625b6d; font-size: 12px; overflow-wrap: anywhere; }
    .countdown { margin: 2px 0 5px; color: #4e347c; font-size: 25px; font-weight: 650; line-height: 1.15; font-variant-numeric: tabular-nums; letter-spacing: -.025em; }
    .local { color: #211d27; font-size: 13px; font-variant-numeric: tabular-nums; }
    .zone, .assumption { color: #625b6d; font-size: 12px; }
    .assumption { margin-top: 5px; }
    @media (prefers-color-scheme: dark) {
      .card { background: #25212b; color: #f4f0f7; border-color: rgba(255,255,255,.16); box-shadow: 0 8px 26px rgba(0,0,0,.4); }
      .source, .zone, .assumption { color: #c2b9cd; }
      .countdown { color: #c8b2f4; }
      .local { color: #f4f0f7; }
    }
  `;

  function stopTimers() {
    if (timerHandle) clearInterval(timerHandle);
    if (closeHandle) clearTimeout(closeHandle);
    timerHandle = 0;
    closeHandle = 0;
  }

  function cancelClose() {
    if (closeHandle) clearTimeout(closeHandle);
    closeHandle = 0;
  }

  function scheduleClose() {
    if (closeHandle) return;
    closeHandle = setTimeout(closeTooltip, 180);
  }

  function format(match) {
    return formatEvent(match, {
      nowMs: Date.now(),
      targetZone: resolvedTimeZone(settings),
      hour12: settings.hour12,
      overrides: settings.abbreviationOverrides,
    });
  }

  function renderTooltip() {
    if (!activeMatch || !card || card.hidden) return;
    const item = format(activeMatch);
    fields.source.textContent = item.sourceLabel || activeMatch.sourceLabel || '';
    fields.countdown.textContent = item.countdown;
    fields.local.textContent = `${item.localDate} · ${item.localTime}`;
    fields.zone.textContent = item.timeZone;
    fields.assumption.textContent = item.assumption || '';
    fields.assumption.hidden = !item.assumption;
  }

  function placeTooltip(match) {
    const rect = match.range.getBoundingClientRect();
    const gap = 10;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = Math.max(12, Math.min(rect.left, innerWidth - width - 12));
    let top = rect.bottom + gap;
    if (top + height > innerHeight - 12 && rect.top - height - gap >= 12) {
      top = rect.top - height - gap;
    }
    top = Math.max(12, Math.min(top, innerHeight - height - 12));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function openTooltip(match) {
    ensureUI();
    cancelClose();
    if (activeMatch === match && !card.hidden) return;
    activeMatch = match;
    card.hidden = false;
    renderTooltip();
    placeTooltip(match);
    if (!timerHandle) timerHandle = setInterval(renderTooltip, 1000);
  }

  function closeTooltip() {
    cancelClose();
    activeMatch = null;
    if (card) card.hidden = true;
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = 0;
  }

  function clearHighlights() {
    if (CSS?.highlights?.get(HIGHLIGHT_NAME) === ownHighlight) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
    ownHighlight = null;
  }

  function stopScan() {
    generation += 1;
    if (observer) observer.disconnect();
    observer = null;
    if (debounceHandle) clearTimeout(debounceHandle);
    cancelIdleWork();
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pendingPointer = null;
    debounceHandle = idleHandle = 0;
    clearHighlights();
    matches = [];
    recordsByBlock.clear();
    inFlightRoots = [];
    pendingDirtyRoots.length = 0;
    closeTooltip();
    if (host) host.remove();
    host = shadow = card = fields = null;
  }

  function isHiddenOrEditable(element) {
    const path = [];
    let node = element;
    let hidden = false;
    while (node && node !== document.documentElement) {
      if (visibilityCache.has(node)) {
        hidden = visibilityCache.get(node);
        break;
      }
      path.push(node);
      node = node.parentElement;
    }
    for (let index = path.length - 1; index >= 0; index -= 1) {
      node = path[index];
      if (hidden || node.id === ROOT_ID || SKIP_TAGS.has(node.tagName) || node.hidden || node.inert
          || node.getAttribute('aria-hidden') === 'true' || node.isContentEditable
          || node.getAttribute('contenteditable') === 'true') hidden = true;
      else {
        const style = getComputedStyle(node);
        hidden = style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
      }
      visibilityCache.set(node, hidden);
    }
    return hidden;
  }

  function addTextNode(node, blockNodes) {
    if (!node.nodeValue) return;
    const parent = node.parentElement;
    if (!parent || isHiddenOrEditable(parent)) return;
    blockNodes.push(node);
  }

  function* collectBlocks(root) {
    let current = [];
    function* flush(owner) {
      if (current.length) yield { owner, nodes: current };
      current = [];
    }
    function* visit(node, owner) {
      if (node.nodeType === Node.TEXT_NODE) {
        addTextNode(node, current);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(node.tagName)
          || node.id === ROOT_ID || isHiddenOrEditable(node)) return;
      const isBlock = BLOCK_TAGS.has(node.tagName)
        || getComputedStyle(node).display.startsWith('block')
        || getComputedStyle(node).display === 'list-item'
        || getComputedStyle(node).display === 'table-cell';
      if (isBlock) yield* flush(owner);
      const childOwner = isBlock ? node : owner;
      for (const child of node.childNodes) yield* visit(child, childOwner);
      if (isBlock) yield* flush(childOwner);
    }
    yield* visit(root, root);
    yield* flush(root);
  }

  function rangeFor(nodes, starts, ends) {
    const range = document.createRange();
    range.setStart(nodes[starts.node], starts.offset);
    range.setEnd(nodes[ends.node], ends.offset);
    return range;
  }

  function locateOffset(nodes, lengths, offset) {
    let base = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const next = base + lengths[i];
      if (offset < next || (offset === next && i === nodes.length - 1)) {
        return { node: i, offset: offset - base };
      }
      base = next;
    }
    return { node: nodes.length - 1, offset: lengths.at(-1) };
  }

  function buildMatches(blockNodes) {
    const nodes = blockNodes.filter(node => node.isConnected && node.parentElement && !isHiddenOrEditable(node.parentElement));
    if (!nodes.length) return [];
    const lengths = nodes.map(node => node.nodeValue.length);
    const text = nodes.map(node => node.nodeValue).join('');
    let found;
    try {
      found = scanText(text, {
        nowMs: Date.now(),
        overrides: settings.abbreviationOverrides,
      });
    } catch { return []; }
    return found.map(event => {
      const start = locateOffset(nodes, lengths, event.start);
      const end = locateOffset(nodes, lengths, event.end);
      if (!nodes[start.node]?.isConnected || !nodes[end.node]?.isConnected) return null;
      try { return { ...event, range: rangeFor(nodes, start, end) }; }
      catch { return null; }
    }).filter(Boolean);
  }

  function requestIdle(callback) {
    if ('requestIdleCallback' in window) {
      idleIsTimeout = false;
      idleHandle = requestIdleCallback(callback, { timeout: 700 });
    } else {
      idleIsTimeout = true;
      idleHandle = setTimeout(() => callback({ timeRemaining: () => 8, didTimeout: true }), 20);
    }
  }

  function cancelIdleWork() {
    if (!idleHandle) return;
    if (idleIsTimeout) clearTimeout(idleHandle);
    else cancelIdleCallback(idleHandle);
    idleHandle = 0;
  }

  function refreshMatchSnapshot() {
    matches = [];
    for (const [owner, records] of recordsByBlock) {
      if (!owner.isConnected) recordsByBlock.delete(owner);
      else matches.push(...records);
    }
    matches = matches.filter(match => match.range.startContainer.isConnected);
    matches.sort((a, b) => {
      const left = a.range.startContainer;
      const right = b.range.startContainer;
      if (left === right) return a.range.startOffset - b.range.startOffset;
      const position = left.compareDocumentPosition(right);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  function rebuildBlocks(roots, full = false) {
    if (!enabled) return;
    generation += 1;
    const run = generation;
    cancelIdleWork();
    visibilityCache = new WeakMap();
    if (full) {
      roots = [document.body || document.documentElement];
      inFlightRoots = roots;
      recordsByBlock.clear();
      closeTooltip();
    } else {
      roots = [...new Set([...inFlightRoots, ...roots])].filter(root => root?.isConnected);
      roots = roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
      inFlightRoots = roots;
      for (const root of roots) {
        for (const [owner, records] of recordsByBlock) {
          if (owner === root || root.contains(owner)) {
            if (activeMatch && records.includes(activeMatch)) closeTooltip();
            recordsByBlock.delete(owner);
          }
        }
      }
    }
    clearHighlights();
    const iterators = roots.map(root => collectBlocks(root));
    const pending = [];
    let iteratorIndex = 0;
    let complete = false;
    const processChunk = deadline => {
      idleHandle = 0;
      if (!enabled || run !== generation) return;
      let processed = 0;
      while (processed < 80 && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
        if (iteratorIndex >= iterators.length) { complete = true; break; }
        const next = iterators[iteratorIndex].next();
        if (next.done) { iteratorIndex += 1; continue; }
        const records = buildMatches(next.value.nodes);
        if (records.length) pending.push([next.value.owner, records]);
        processed += 1;
      }
      if (!complete) requestIdle(processChunk);
      else {
        for (const [owner, records] of pending) {
          recordsByBlock.set(owner, (recordsByBlock.get(owner) || []).concat(records));
        }
        inFlightRoots = [];
        refreshMatchSnapshot();
        installHighlights();
      }
    };
    requestIdle(processChunk);
  }

  function scanDocument() {
    rebuildBlocks([], true);
  }

  function installHighlights() {
    if (!enabled || !matches.length) return;
    try {
      ownHighlight = new Highlight();
      for (const match of matches) {
        if (match.range.startContainer.isConnected) ownHighlight.add(match.range);
      }
      CSS.highlights.set(HIGHLIGHT_NAME, ownHighlight);
    } catch {
      ownHighlight = null;
    }
  }

  function closestBlock(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element !== document.documentElement) {
      if (BLOCK_TAGS.has(element.tagName) || getComputedStyle(element).display.startsWith('block')) return element;
      element = element.parentElement;
    }
    return document.body || document.documentElement;
  }

  function isBlockElement(node) {
    return node?.nodeType === Node.ELEMENT_NODE
      && (BLOCK_TAGS.has(node.tagName) || getComputedStyle(node).display.startsWith('block'));
  }

  const pendingDirtyRoots = [];

  function cancelRescan(roots) {
    if (debounceHandle) clearTimeout(debounceHandle);
    pendingDirtyRoots.push(...roots);
    debounceHandle = setTimeout(() => rebuildBlocks(pendingDirtyRoots.splice(0)), 100);
  }

  function startScan() {
    if (!enabled) return;
    ensureUI();
    scanDocument();
    observer = new MutationObserver(records => {
      const roots = [];
      for (const record of records) {
        if (host && (record.target === host || host.contains(record.target))) continue;
        if (record.type === 'childList') {
          for (const removed of record.removedNodes) {
            if (isBlockElement(removed)) {
              for (const [owner, matchesForBlock] of recordsByBlock) {
                if (owner === removed || removed.contains(owner)) {
                  if (activeMatch && matchesForBlock.includes(activeMatch)) closeTooltip();
                  recordsByBlock.delete(owner);
                }
              }
            } else roots.push(closestBlock(record.target));
          }
          for (const added of record.addedNodes) roots.push(isBlockElement(added) ? added : closestBlock(record.target));
        } else roots.push(closestBlock(record.target));
      }
      if (roots.length) cancelRescan(roots);
      else {
        refreshMatchSnapshot();
        clearHighlights();
        installHighlights();
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'style', 'class', 'aria-hidden', 'contenteditable'] });
  }

  function clearSettingsAndStart(value) {
    settings = resolveSettings(value);
    const shouldRun = isEnabled();
    if (!shouldRun) {
      enabled = false;
      stopScan();
      return;
    }
    if (!enabled) {
      enabled = true;
      startScan();
    } else {
      scanDocument();
    }
  }

  function findHit(event) {
    let hits;
    try { hits = CSS.highlights.highlightsFromPoint(event.clientX, event.clientY); }
    catch { return null; }
    for (const hit of hits || []) {
      if (hit.highlight !== ownHighlight || !Array.isArray(hit.ranges)) continue;
      for (const range of hit.ranges) {
        const match = matches.find(item => item.range.startContainer === range.startContainer
          && item.range.startOffset === range.startOffset
          && item.range.endContainer === range.endContainer
          && item.range.endOffset === range.endOffset);
        if (match) return match;
      }
    }
    return null;
  }

  function isInsideTooltip(event) {
    return host && event.composedPath().includes(host);
  }

  function processPointerMove(event) {
    if (!enabled) return;
    if (event.insideTooltip) {
      cancelClose();
      return;
    }
    const hit = findHit(event);
    if (hit) openTooltip(hit);
    else if (activeMatch) scheduleClose();
  }

  function onPointerMove(event) {
    pendingPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
      insideTooltip: isInsideTooltip(event),
    };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const current = pendingPointer;
      pendingPointer = null;
      if (current) processPointerMove(current);
    });
  }

  function onPointerDown(event) {
    if (activeMatch && !isInsideTooltip(event) && !findHit(event)) closeTooltip();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && activeMatch) closeTooltip();
  }

  function onVisibilityChange() {
    if (document.hidden) closeTooltip();
  }

  function snapshot() {
    return {
      enabled,
      count: matches.length,
      events: matches.slice(0, 50).map(({ range, ...match }) => ({ ...match, ...format(match) })),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'HLU_STATUS') {
      sendResponse(snapshot());
      return false;
    }
    if (message?.type === 'HLU_RESCAN') {
      if (enabled) scanDocument();
      sendResponse(snapshot());
      return false;
    }
    if (message?.type === 'HLU_REVEAL') {
      const match = matches[message.index];
      if (enabled && match?.range?.startContainer?.isConnected) {
        match.range.startContainer.parentElement?.scrollIntoView({ behavior: 'auto', block: 'center' });
        requestAnimationFrame(() => { if (enabled && match.range.startContainer.isConnected) openTooltip(match); });
        sendResponse({ ...snapshot(), revealed: true });
      } else sendResponse({ ...snapshot(), revealed: false });
      return false;
    }
    return false;
  });

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  chrome.storage.local.get('settings').then(result => clearSettingsAndStart(result?.settings));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) clearSettingsAndStart(changes.settings.newValue);
  });
})();
