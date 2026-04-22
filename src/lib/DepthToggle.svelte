<script>
  /**
   * DepthToggle — three-way segmented control for progressive disclosure.
   *
   * Shows three options: Learn / Explore / Deep Dive.
   * Each option carries a prominent label + 12px description beneath,
   * so the toggle reads like three "zoom levels" of the same map rather
   * than arbitrary switches. Writes through depth-level.js which sets
   * `<html data-depth="...">`; CSS rules across the app consume this.
   *
   * Also renders a one-line first-visit hint ("New to JavaScript
   * internals? Start with Learn.") that persists dismissal in
   * localStorage, so returning users never see it again.
   *
   * Usage: <DepthToggle accent={accent} />
   */
  import { onMount, onDestroy } from 'svelte';
  import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS, getLevel, setLevel } from './depth-level.js';

  /** @type {{ accent?: string }} */
  let { accent = '#00FFD1' } = $props();

  const HINT_KEY = 'vivix-depth-hint-dismissed';

  let current = $state(getLevel());
  let hintVisible = $state(readHintState());

  function readHintState() {
    try { return localStorage.getItem(HINT_KEY) !== '1'; }
    catch { return true; }
  }

  function dismissHint() {
    hintVisible = false;
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage unavailable */ }
  }

  function onChange(lvl) {
    current = setLevel(lvl);
    // Any interaction with the toggle counts as acknowledging it — auto-dismiss the hint.
    if (hintVisible) dismissHint();
  }

  // Stay in sync if another component / tab changes the level.
  function onExternalChange(e) { current = e.detail; }
  onMount(() => window.addEventListener('vivix-depth-changed', onExternalChange));
  onDestroy(() => typeof window !== 'undefined' &&
    window.removeEventListener('vivix-depth-changed', onExternalChange));
</script>

<div class="depth-wrap" style="--acc:{accent}">
  <div class="depth-toggle" role="radiogroup" aria-label="Detail level">
    {#each LEVELS as lvl}
      <button
        class="depth-opt"
        class:depth-opt-active={current === lvl}
        role="radio"
        aria-checked={current === lvl}
        onclick={() => onChange(lvl)}
      >
        <span class="depth-dot" aria-hidden="true"></span>
        <span class="depth-text">
          <span class="depth-label">{LEVEL_LABELS[lvl]}</span>
          <span class="depth-desc">{LEVEL_DESCRIPTIONS[lvl]}</span>
        </span>
      </button>
    {/each}
  </div>

  {#if hintVisible}
    <!-- First-visit hint: inline, dismissible, never modal. -->
    <p class="depth-hint" role="note">
      <span class="depth-hint-text">New to JavaScript internals? Start with <strong>Learn</strong>.</span>
      <button
        type="button"
        class="depth-hint-close"
        onclick={dismissHint}
        aria-label="Dismiss hint"
      >×</button>
    </p>
  {/if}
</div>

<style>
  .depth-wrap {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    font-family: var(--font-ui);
  }

  .depth-toggle {
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    padding: 3px;
    border-radius: 9px;
    background: var(--elevation-raised);
    box-shadow: var(--elevation-shadow-raised);
  }

  .depth-opt {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    /* 150ms opacity fade — labels soften out rather than snap off when
       another tier is activated, echoing the same timing used by the
       app-wide `.dl-*` depth-level collapse animation. */
    transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
    opacity: 0.72;
  }

  .depth-opt:hover {
    color: rgba(255, 255, 255, 0.88);
    opacity: 0.92;
  }

  .depth-opt-active {
    background: var(--elevation-overlay);
    color: rgba(255, 255, 255, 0.98);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 40%, transparent);
    opacity: 1;
  }

  .depth-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.22);
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }

  .depth-opt-active .depth-dot {
    background: var(--acc);
    box-shadow: 0 0 8px var(--acc);
  }

  .depth-text {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.15;
    gap: 2px;
  }

  .depth-label {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: inherit;
  }

  /* Spec: description in 12px type directly beneath the label. */
  .depth-desc {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.1px;
  }

  .depth-opt-active .depth-desc {
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── First-visit hint ────────────────────────────────────────────────
     One-line, text-only (no modal), dismissible via × and auto-dismissed
     the moment the user picks any depth level. */
  .depth-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 3px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--acc) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--acc) 18%, transparent);
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.62);
    line-height: 1.3;
    animation: depth-hint-in 0.18s ease both;
  }
  .depth-hint-text strong {
    color: var(--acc);
    font-weight: 700;
  }
  .depth-hint-close {
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.95rem;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s ease;
  }
  .depth-hint-close:hover { color: rgba(255, 255, 255, 0.95); }

  @keyframes depth-hint-in {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 720px) {
    .depth-opt { padding: 5px 9px; gap: 6px; }
    .depth-label { font-size: 0.74rem; }
    .depth-desc { display: none; }
    .depth-hint { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .depth-opt, .depth-dot, .depth-hint-close { transition: none; }
    .depth-hint { animation: none; }
  }
</style>
