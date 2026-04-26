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
   * Usage: <DepthToggle accent={accent} />
   */
  import { onMount, onDestroy } from 'svelte';
  import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS, getLevel, setLevel } from './depth-level.js';

  /** @type {{ accent?: string }} */
  let { accent = '#00FFD1' } = $props();

  let current = $state(getLevel());

  function onChange(lvl) {
    current = setLevel(lvl);
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

  @media (max-width: 720px) {
    .depth-opt { padding: 5px 9px; gap: 6px; }
    .depth-label { font-size: 0.74rem; }
    .depth-desc { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .depth-opt, .depth-dot { transition: none; }
  }
</style>
