/**
 * Web Worker for running the interpreter off the main thread.
 * Receives { code, options } messages, returns { steps, error, friendly }.
 *
 * Performance strategy:
 *   1. Try posting the raw result first (zero-cost fast path).
 *   2. If postMessage throws a DataCloneError (functions, symbols, etc.),
 *      fall back to sanitizing only the offending data.
 */
import { interpret } from './interpreter.js';

/**
 * Quick check whether a value contains non-cloneable types.
 * Returns true if sanitization is needed.
 * Uses a seen set to avoid infinite loops on circular references.
 */
function needsSanitize(val, depth, seen) {
  if (depth > 20) return false;
  if (val === null || val === undefined) return false;
  const t = typeof val;
  if (t === 'function' || t === 'symbol' || t === 'bigint') return true;
  if (t !== 'object') return false;
  if (val instanceof RegExp || val instanceof Error) return true;
  if (seen.has(val)) return false;
  seen.add(val);
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      if (needsSanitize(val[i], depth + 1, seen)) return true;
    }
    return false;
  }
  const keys = Object.keys(val);
  for (let i = 0; i < keys.length; i++) {
    if (needsSanitize(val[keys[i]], depth + 1, seen)) return true;
  }
  return false;
}

/**
 * Recursively sanitize a value so it can survive structuredClone / postMessage.
 * Functions, Symbols, and other non-cloneable types are replaced with
 * descriptive string placeholders.
 */
function sanitize(val, depth) {
  if (depth > 50) return '[max depth]';
  if (val === null || val === undefined) return val;
  const t = typeof val;
  if (t === 'function') return `[Function: ${val.name || 'anonymous'}]`;
  if (t === 'symbol')   return val.toString();
  if (t === 'bigint')   return val.toString();
  if (t !== 'object')   return val;              // string, number, boolean
  if (val instanceof RegExp) return val.toString();
  if (val instanceof Date)   return val.toISOString();
  if (val instanceof Error)  return { message: val.message, name: val.name };
  if (Array.isArray(val))    return val.map(v => sanitize(v, depth + 1));
  // Plain object
  const out = {};
  const keys = Object.keys(val);
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = sanitize(val[keys[i]], depth + 1);
  }
  return out;
}

self.onmessage = function (e) {
  const { code, options } = e.data;
  try {
    const result = interpret(code, options);
    const payload = { steps: result.steps, error: result.error, friendly: result.friendly || null };

    // Fast path: try posting without sanitization
    try {
      self.postMessage(payload);
      return;
    } catch (_cloneErr) {
      // DataCloneError — need to sanitize
    }

    // Selective sanitization: only sanitize steps that actually need it
    const steps = result.steps;
    const sanitized = new Array(steps.length);
    const seen = new Set();
    for (let i = 0; i < steps.length; i++) {
      sanitized[i] = needsSanitize(steps[i], 0, seen)
        ? sanitize(steps[i], 0)
        : steps[i];
      seen.clear();
    }
    self.postMessage({ steps: sanitized, error: result.error, friendly: result.friendly || null });
  } catch (err) {
    self.postMessage({ steps: [], error: err.message, friendly: null });
  }
};
