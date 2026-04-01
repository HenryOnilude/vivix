/**
 * Pure logic extracted from ModuleShell.svelte.
 *
 * Contains phase-colour mapping, phase-icon mapping, variable-diff
 * computation, timeline helpers, and complexity badge colour lookup.
 * These functions are side-effect-free and easily testable.
 */

import { COMPLEXITY_BARS } from './utils.js';

// ── Phase colour (covers all module phase names) ────────────────────────────
/**
 * @param {string|null|undefined} ph - Phase name
 * @param {string} accent - Accent colour for module-specific phases
 * @returns {string} CSS colour
 */
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
/**
 * @param {string|null|undefined} ph - Phase name
 * @returns {string} Icon character
 */
export function phIcon(ph) {
  if (!ph) return '▶';
  if (ph === 'done')                                    return '✓';
  if (ph === 'condition' || ph === 'else-enter' || ph === 'skip') return '?';
  if (ph.startsWith('loop'))                            return '↻';
  if (ph.startsWith('fn-'))                             return 'ƒ';
  return '▶';
}

// ── Variable diff between current and previous step ─────────────────────────
/**
 * Computes which variables are new, changed, or same between two steps.
 * @param {Record<string,*>} current - Current step vars
 * @param {Record<string,*>} previous - Previous step vars
 * @returns {Record<string, 'new'|'changed'|'same'>}
 */
export function computeVarDiff(current, previous) {
  /** @type {Record<string, 'new'|'changed'|'same'>} */
  const r = {};
  for (const k of Object.keys(current)) {
    if (!(k in previous))                                          r[k] = 'new';
    else if (JSON.stringify(previous[k]) !== JSON.stringify(current[k])) r[k] = 'changed';
    else                                                            r[k] = 'same';
  }
  return r;
}

// ── Timeline helpers ────────────────────────────────────────────────────────
/**
 * Marker position as a percentage.
 * @param {number} i - Step index
 * @param {number} total - Total steps
 * @returns {number} Percentage (0–100)
 */
export function markerPct(i, total) {
  return total > 1 ? (i / (total - 1)) * 100 : 0;
}

/**
 * Fill width percentage up to current step.
 * @param {number} step - Current step index
 * @param {number} total - Total steps
 * @returns {number} Percentage (0–100)
 */
export function fillPct(step, total) {
  return total > 1 ? (step / (total - 1)) * 100 : 0;
}

// ── Complexity badge colour ─────────────────────────────────────────────────
/**
 * @param {string} label - Complexity label, e.g. 'O(1)', 'O(n)'
 * @returns {string} CSS colour
 */
export function complexityBadgeColor(label) {
  return COMPLEXITY_BARS.find(b => label.startsWith(b.label.slice(0, 3)))?.color ?? '#4ade80';
}
