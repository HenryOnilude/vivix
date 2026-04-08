/**
 * url-state.js — Shareable URL state encoding/decoding.
 *
 * URL format:  #/module?ex=0&step=3&code=BASE64
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

// ── Parse URL state from current hash ──────────────────────────────────────

/**
 * Parse the current hash URL and return route + state params.
 * @returns {{ route: string, ex: number|null, step: number|null, code: string|null }}
 */
export function parseHashState() {
  const hash = window.location.hash.slice(2) || '';   // remove '#/'
  const [routePart, queryPart] = hash.split('?');
  const route = routePart || 'home';

  const result = { route, ex: null, step: null, code: null };

  if (!queryPart) return result;

  const params = new URLSearchParams(queryPart);

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
 * @returns {string} Full URL with hash
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
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/${route}${query ? '?' + query : ''}`;
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
