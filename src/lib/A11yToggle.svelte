<script>
  /**
   * A11yToggle — accessibility theme switcher button.
   *
   * Renders a small ♿ button that cycles through themes:
   *   default → comfort → dyslexia → default
   *
   * Placed in the top bar of each module via ModuleShell.
   */
  import { THEMES, getTheme, setTheme } from './a11y-theme.js';

  let current = $state(getTheme());

  const order = ['default', 'comfort', 'dyslexia'];

  function cycle() {
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
    current = next;
  }
</script>

<button
  class="a11y-btn"
  onclick={cycle}
  aria-label="Accessibility theme: {THEMES[current]?.label ?? 'Default'}. Click to change."
>
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="3" r="2" fill="currentColor" opacity="0.8"/>
    <path d="M4 6.5 L8 7 L12 6.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M8 7 L8 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M8 10.5 L5.5 14" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M8 10.5 L10.5 14" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>
  <span class="a11y-label">{THEMES[current]?.label ?? 'Default'}</span>
</button>

<style>
  .a11y-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--a11y-surface2, #0d0d16);
    border: 1px solid var(--a11y-border, #1a1a2e);
    border-radius: 6px;
    color: var(--a11y-text-muted, #555);
    font-size: 0.55rem;
    font-family: inherit;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 28px;
  }

  .a11y-btn:hover {
    color: var(--a11y-text-sec, #aaa);
    border-color: var(--a11y-text-muted, #555);
  }

  .a11y-label {
    letter-spacing: 0.3px;
  }

  @media (max-width: 768px) {
    .a11y-btn {
      min-height: 44px;
      min-width: 44px;
      padding: 4px 10px;
    }
  }

  @media (max-width: 480px) {
    .a11y-label { display: none; }
  }
</style>
