/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

/**
 * url-state.js — Shareable URL state encoding/decoding.
 *
 * URL format:  /module?ex=0&step=3&code=BASE64   (History API, no hash)
 *
 * - ex    — selected example index (number)
 * - step  — current step index (number, -1 = not started)
 * - code  — custom code (base64-encoded, omitted if using built-in example unchanged)
 */

// ── Encode / Decode helpers ────────────────────────────────────────────────

/** Encode a string to URL-safe base64 */
export function encodeCode(code) {
  try {
    return btoa(unescape(encodeURIComponent(code)));
  } catch (e) {
    return '';
  }
}

/** Decode a URL-safe base64 string back to code */
export function decodeCode(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch (e) {
    return '';
  }
}

// ── Parse URL state from the current path ──────────────────────────────────

/**
 * Parse the current History-API URL and return route + state params.
 *
 * @param {string} [pathname] - location pathname (e.g. '/closures'). Defaults to current.
 * @param {string} [search]   - location search  (e.g. '?ex=3').     Defaults to current.
 * @returns {{ route: string, ex: number|null, step: number|null, code: string|null }}
 */
export function parseUrlState(
  pathname = (typeof window !== 'undefined' ? window.location.pathname : '/'),
  search   = (typeof window !== 'undefined' ? window.location.search   : ''),
) {
  // Strip leading/trailing slashes — '/closures/' and '/closures' both map to 'closures'.
  const route = pathname.replace(/^\/+|\/+$/g, '') || 'home';

  const result = { route, ex: null, step: null, code: null };

  const params = new URLSearchParams(search || '');

  if (params.has('ex')) {
    const n = parseInt(params.get('ex'), 10);
    if (!isNaN(n) && n >= 0) result.ex = n;
  }

  if (params.has('step')) {
    const n = parseInt(params.get('step'), 10);
    if (!isNaN(n) && n >= -1) result.step = n;
  }

  if (params.has('code')) {
    const decoded = decodeCode(params.get('code'));
    if (decoded) result.code = decoded;
  }

  return result;
}

/** @deprecated Hash routing removed — kept as an alias for `parseUrlState`. */
export const parseHashState = parseUrlState;

// ── Build a shareable URL ──────────────────────────────────────────────────

/**
 * Build a full shareable URL for the current visualization state.
 *
 * @param {Object} opts
 * @param {string}  opts.route      - module route key (e.g. 'closures')
 * @param {number}  opts.ex         - selected example index
 * @param {number}  opts.step       - current step index (-1 if not started)
 * @param {string}  opts.code       - current code in editor
 * @param {string}  [opts.exampleCode] - the code of the currently selected example (to detect custom code)
 * @returns {string} Full History-API URL (no hash)
 */
export function buildShareUrl({ route, ex, step, code, exampleCode }) {
  const params = new URLSearchParams();

  // Always include example index
  if (ex != null && ex > 0) params.set('ex', String(ex));

  // Include step if execution has started
  if (step != null && step >= 0) params.set('step', String(step));

  // Include code only if it differs from the selected example
  const isCustom = code && exampleCode && code !== exampleCode;
  if (isCustom) params.set('code', encodeCode(code));

  const query = params.toString();
  const base = window.location.origin;
  return `${base}/${route}${query ? '?' + query : ''}`;
}

// ── Client-side navigation (History API) ───────────────────────────────────

/**
 * Navigate to an internal route using the History API and notify listeners.
 *
 * Accepts either a path ('/closures') or a full same-origin URL. Pushes a new
 * history entry and dispatches a `popstate` event so the router (which listens
 * for `popstate`) re-reads the URL — pushState alone does not fire popstate.
 *
 * @param {string} to - target path or full URL
 */
export function navigate(to) {
  if (typeof window === 'undefined') return;
  const url = new URL(to, window.location.origin);
  const dest = `${url.pathname}${url.search}`;
  window.history.pushState({}, '', dest);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ── Silently update the URL without triggering hashchange ──────────────────

/**
 * Replace the current URL hash without triggering a hashchange event.
 * Uses replaceState so it doesn't pollute browser history.
 *
 * @param {Object} opts — same as buildShareUrl
 */
export function updateUrlSilent(opts) {
  const url = buildShareUrl(opts);
  window.history.replaceState(null, '', url);
}
