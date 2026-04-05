/**
 * Accessibility theme system.
 *
 * Provides three themes:
 *   'default'   — current dark theme (no changes)
 *   'comfort'   — reduced contrast for halation-sensitive / astigmatic users
 *   'dyslexia'  — creme background + dark text, validated by eye-tracking research
 *
 * Usage: call setTheme('comfort') to apply. Persisted in localStorage.
 * CSS custom properties are set on <html> and consumed via var(--a11y-bg), etc.
 */

const STORAGE_KEY = 'visualjs-a11y-theme';

export const THEMES = {
  default: {
    label: 'Default Dark',
    desc: 'Standard dark theme',
    vars: {
      '--a11y-bg':        '#080810',
      '--a11y-surface1':  '#0f0f1c',
      '--a11y-surface2':  '#141422',
      '--a11y-surface3':  '#0c0c18',
      '--a11y-border':    '#252540',
      '--a11y-text':      '#eeeef2',
      '--a11y-text-sec':  '#c8c8d4',
      '--a11y-text-muted':'#666688',
      '--a11y-code-bg':   '#0b0b16',
    },
  },
  comfort: {
    label: 'Eye Comfort',
    desc: 'Softer contrast — reduces halation for astigmatic users',
    vars: {
      '--a11y-bg':        '#121218',
      '--a11y-surface1':  '#16161e',
      '--a11y-surface2':  '#1a1a24',
      '--a11y-surface3':  '#13131a',
      '--a11y-border':    '#2a2a3e',
      '--a11y-text':      '#d0d0d0',
      '--a11y-text-sec':  '#aaaaaa',
      '--a11y-text-muted':'#666',
      '--a11y-code-bg':   '#16161e',
    },
  },
  dyslexia: {
    label: 'Dyslexia Friendly',
    desc: 'Creme background with dark text — reduces visual stress',
    vars: {
      '--a11y-bg':        '#FAFAC8',
      '--a11y-surface1':  '#F5F5C0',
      '--a11y-surface2':  '#EFEFB8',
      '--a11y-surface3':  '#F8F8D0',
      '--a11y-border':    '#D4D4A0',
      '--a11y-text':      '#1a1a00',
      '--a11y-text-sec':  '#333300',
      '--a11y-text-muted':'#666640',
      '--a11y-code-bg':   '#F5F5C0',
    },
  },
};

/** Get the saved theme name, or 'default' */
export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

/** Apply a theme by name. Sets CSS vars on <html> and persists choice. */
export function setTheme(name) {
  const theme = THEMES[name] || THEMES.default;
  const root = document.documentElement;
  for (const [prop, val] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, val);
  }
  // Set a data attribute for CSS selectors that need theme-specific rules
  root.dataset.a11yTheme = name;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch { /* storage unavailable */ }
}

/** Initialize theme on app load */
export function initTheme() {
  setTheme(getTheme());
}
