/*
 * PostHog analytics — lazy-loaded and non-blocking.
 *
 * posthog-js is pulled in via a deferred dynamic import() so it never sits
 * on the app's critical path. If the CDN / package fails to load, the app
 * still renders and events are silently dropped. Captures fired before the
 * module finishes loading are queued and replayed once it's ready.
 *
 * We only ever send explicit event names — never code content or PII.
 */

const PH_KEY   = 'phc_kiRjFYbBajzgggV5natwswmeMJTWBtES9L3vpkTB9qFp';
const PH_HOST  = 'https://eu.i.posthog.com';

/**
 * Query params we will never let reach PostHog — any of these may carry
 * the user's source code via our hash-based share links (see url-state.js).
 * The list is intentionally broad: if in doubt, strip it.
 */
const SENSITIVE_PARAMS = new Set(['code', 'src', 'source', 'program', 'script']);

/**
 * Strip sensitive query params from a URL string, preserving everything else.
 * Handles both the search (?a=b) and hash (#/route?a=b) portions because
 * our share URLs live in the hash. Returns the original string on any
 * parse failure — we never want URL scrubbing to throw.
 * @param {unknown} url
 * @returns {unknown}
 */
function scrubUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  try {
    const u = new URL(url, 'http://_'); // base for protocol-relative / path-only
    // 1. Top-level search params
    for (const k of SENSITIVE_PARAMS) u.searchParams.delete(k);
    // 2. Hash fragment may embed its own querystring (#/route?code=...)
    if (u.hash && u.hash.includes('?')) {
      const [hashPath, hashQuery] = u.hash.slice(1).split('?');
      const hp = new URLSearchParams(hashQuery);
      for (const k of SENSITIVE_PARAMS) hp.delete(k);
      const q = hp.toString();
      u.hash = q ? `#${hashPath}?${q}` : `#${hashPath}`;
    }
    // Rebuild without the synthetic base when input was absolute
    return url.startsWith('http') ? u.toString() : u.pathname + u.search + u.hash;
  } catch (_) {
    return url;
  }
}

/**
 * Scrub every URL-shaped property on an event before it leaves the browser.
 * Applied to both auto-captured ($current_url, $pathname, $referrer,
 * $initial_current_url, etc.) and custom props we may add later.
 */
function sanitizeProperties(properties /* , event */) {
  if (!properties || typeof properties !== 'object') return properties;
  const urlKeys = [
    '$current_url', '$pathname', '$referrer',
    '$initial_current_url', '$initial_pathname', '$initial_referrer',
    'url', 'page_url',
  ];
  for (const k of urlKeys) {
    if (k in properties) properties[k] = scrubUrl(properties[k]);
  }
  return properties;
}

/** @type {any} Resolved posthog instance, or null until ready */
let _ph = null;
/** @type {Array<{event:string, props?:Record<string,any>}>} */
const _queue = [];
let _loading = false;

function _flush() {
  if (!_ph) return;
  while (_queue.length) {
    const { event, props } = _queue.shift();
    try { _ph.capture(event, props); } catch (_) { /* ignore */ }
  }
}

async function _load() {
  if (_ph || _loading || typeof window === 'undefined') return;
  _loading = true;
  try {
    const mod = await import('posthog-js');
    const ph = mod.default || mod;
    ph.init(PH_KEY, {
      api_host: PH_HOST,
      capture_pageview: true,
      autocapture: false,
      session_recording: { maskAllInputs: true },
      // Global hook: runs on every event (including auto-captured $pageview)
      // before it's sent. Guarantees no code query param ever leaves the
      // browser, regardless of where it was captured.
      sanitize_properties: sanitizeProperties,
    });
    _ph = ph;
    _flush();
  } catch (err) {
    // Silently swallow — analytics must never break the app.
    // eslint-disable-next-line no-console
    console.warn('[analytics] posthog failed to load:', err?.message || err);
  } finally {
    _loading = false;
  }
}

// Kick off the load after first paint so the UI renders first.
if (typeof window !== 'undefined') {
  const start = () => { _load(); };
  if (document.readyState === 'complete') {
    setTimeout(start, 0);
  } else {
    window.addEventListener('load', () => setTimeout(start, 0), { once: true });
  }
}

/**
 * Fire-and-forget capture. Safe to call before posthog has loaded —
 * the event is queued and replayed when the library is ready.
 * @param {string} event
 * @param {Record<string, any>} [props]
 */
export function capture(event, props) {
  if (_ph) {
    try { _ph.capture(event, props); } catch (_) { /* ignore */ }
  } else {
    _queue.push({ event, props });
  }
}

/**
 * Legacy shim so existing `posthog.capture(...)` call sites keep working
 * without needing to know about the lazy-load indirection.
 */
export const posthog = {
  capture,
  get _instance() { return _ph; },
};

export { scrubUrl };
export default posthog;
