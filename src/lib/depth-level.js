/**
 * depth-level.js — progressive disclosure state.
 *
 * Three semantic depth levels:
 *   'learn'   (L1) — code flow, variable values, basic output. Clean and uncluttered.
 *   'explore' (L2) — + call stack + heap memory. The core Vivix experience. (default)
 *   'deep'    (L3) — + byte sizes, memory addresses, CPU dashboard, V8 internals.
 *
 * The active level is written to <html data-depth="..."> so CSS rules
 * across the entire app can gate visibility via `.dl-explore` /
 * `.dl-deep` selectors. Persisted in localStorage.
 */

const STORAGE_KEY = 'vivix-depth-level';
const DEFAULT_LEVEL = 'explore';

export const LEVELS = ['learn', 'explore', 'deep'];

export const LEVEL_LABELS = {
  learn:   'Learn',
  explore: 'Explore',
  deep:    'Deep Dive',
};

/** One-line descriptions shown beneath each toggle label (12px type). */
export const LEVEL_DESCRIPTIONS = {
  learn:   'See what the code does',
  explore: 'See how the engine handles it',
  deep:    'See why the engine was designed this way',
};

/** Back-compat: the three previous level ids map 1:1 onto the new tiers so
 *  returning users keep the same semantic experience without a flicker. */
const LEGACY_ALIAS = {
  logic:   'learn',
  machine: 'explore',
  physics: 'deep',
};

/** Read the saved level from localStorage, falling back to the default. */
export function getLevel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LEVEL;
    if (LEVELS.includes(raw)) return raw;
    if (raw in LEGACY_ALIAS) return LEGACY_ALIAS[raw];
  } catch { /* storage unavailable */ }
  return DEFAULT_LEVEL;
}

/** Apply a level: writes the data attribute and persists the choice. */
export function setLevel(level) {
  const valid = LEVELS.includes(level) ? level : DEFAULT_LEVEL;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.depth = valid;
  }
  try { localStorage.setItem(STORAGE_KEY, valid); } catch { /* ignore */ }
  // Broadcast so components that mounted before a change can react.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vivix-depth-changed', { detail: valid }));
  }
  return valid;
}

/** Initialise the depth attribute on app load. */
export function initDepthLevel() {
  return setLevel(getLevel());
}
