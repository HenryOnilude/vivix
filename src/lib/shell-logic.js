/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

// Testable helpers split out from ModuleShell.svelte.

import { COMPLEXITY_BARS } from './utils.js';

// ── Phase colour (covers all module phase names) ────────────────────────────
// Colour for a given execution phase.
export function phColor(ph, accent = '#38bdf8') {
  if (!ph) return '#555';
  if (ph === 'declare')                         return '#4ade80';
  if (ph === 'assign')                          return '#f59e0b';
  if (ph === 'condition' || ph === 'else-enter') return '#a78bfa';
  if (ph === 'skip')                            return '#6b7280';
  if (ph === 'output')                          return '#38bdf8';
  if (ph === 'done')                            return '#4ade80';
  if (ph.startsWith('loop'))                    return accent;
  if (ph.startsWith('fn-'))                     return accent;
  return '#555';
}

// ── Phase icon for timeline markers ─────────────────────────────────────────
// Icon character for a given execution phase.
export function phIcon(ph) {
  if (!ph) return '▶';
  if (ph === 'done')                                    return '✓';
  if (ph === 'condition' || ph === 'else-enter' || ph === 'skip') return '?';
  if (ph.startsWith('loop'))                            return '↻';
  if (ph.startsWith('fn-'))                             return 'ƒ';
  return '▶';
}

// ── Structural equality ───────────────────────────────────────────────────────
// Deep value comparison for sanitized step data (primitives, arrays, plain
// objects, function-placeholder strings). Key-order independent for objects.
// Exits on first mismatch — unchanged vars pay near-zero cost per step.
function structuralEq(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!structuralEq(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!structuralEq(a[k], b[k])) return false;
  }
  return true;
}

// ── Variable diff between current and previous step ─────────────────────────
// Which variables are new, changed, or unchanged between two steps.
export function computeVarDiff(current, previous) {
  /** @type {Record<string, 'new'|'changed'|'same'>} */
  const r = {};
  for (const k of Object.keys(current)) {
    if (!(k in previous))                          r[k] = 'new';
    else if (!structuralEq(previous[k], current[k])) r[k] = 'changed';
    else                                            r[k] = 'same';
  }
  return r;
}

// ── Timeline helpers ────────────────────────────────────────────────────────
// Timeline marker position (0–100%).
export function markerPct(i, total) {
  return total > 1 ? (i / (total - 1)) * 100 : 0;
}

// Timeline fill width up to current step (0–100%).
export function fillPct(step, total) {
  return total > 1 ? (step / (total - 1)) * 100 : 0;
}

// ── Complexity badge colour ─────────────────────────────────────────────────
// Badge colour for a complexity label.
export function complexityBadgeColor(label) {
  return COMPLEXITY_BARS.find(b => label.startsWith(b.label.slice(0, 3)))?.color ?? '#4ade80';
}
