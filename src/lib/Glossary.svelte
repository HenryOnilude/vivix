<script>
  /**
   * Glossary — hover-only tooltip for technical terms.
   *
   * Props:
   *   term       — canonical term (looked up in glossary.js)
   *   definition — explicit definition override (optional; falls back to
   *                the glossary lookup)
   *
   * Usage:
   *   <Glossary term="Heap Memory">Heap Memory</Glossary>
   *
   * The term itself is always fully readable without hovering. The
   * tooltip is a subtle enhancement — it sits above the term with a
   * small arrow pointer, fades in over 150ms, and disappears when the
   * cursor leaves. Never rendered on touch devices (where it would be
   * intrusive without an explicit tap target).
   */
  import { defineTerm } from './glossary.js';

  /** @type {{ term?: string, definition?: string, children?: import('svelte').Snippet }} */
  let { term = '', definition = '', children } = $props();

  let visible = $state(false);
  let hostEl  = $state(null);
  let aboveX  = $state(0); // tooltip horizontal offset in viewport pixels
  let aboveY  = $state(0); // tooltip top edge in viewport pixels
  let flip    = $state(false); // show below the term instead of above

  const resolved = $derived(definition || defineTerm(term) || '');
  const tooltipId = `glossary-${Math.random().toString(36).slice(2, 9)}`;

  function show() {
    if (!resolved) return;
    if (typeof window !== 'undefined' &&
        window.matchMedia && !window.matchMedia('(hover: hover)').matches) {
      // Touch-only device — skip; the plain term stays fully readable.
      return;
    }
    visible = true;
    // Next tick: measure and position.
    requestAnimationFrame(positionTooltip);
  }

  function hide() {
    visible = false;
  }

  function positionTooltip() {
    if (!hostEl) return;
    const r = hostEl.getBoundingClientRect();
    const tooltipW = 220;
    const margin = 8;

    // Centre horizontally on the host, clamped to the viewport.
    let cx = r.left + r.width / 2 - tooltipW / 2;
    cx = Math.max(margin, Math.min(cx, window.innerWidth - tooltipW - margin));
    aboveX = cx;

    // Decide above vs below based on available space.
    const estTooltipH = 84; // generous upper-bound
    const spaceAbove  = r.top;
    flip = spaceAbove < estTooltipH + 12;
    aboveY = flip ? (r.bottom + margin) : (r.top - estTooltipH - margin);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={hostEl}
  class="glossary-term"
  class:has-def={!!resolved}
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  aria-describedby={visible ? tooltipId : undefined}
  tabindex={resolved ? 0 : -1}
>
  {#if children}{@render children()}{:else}{term}{/if}
</span>

{#if visible && resolved}
  <span
    id={tooltipId}
    role="tooltip"
    class="glossary-tip"
    class:flip
    style="left:{aboveX}px; top:{aboveY}px;"
  >
    <span class="glossary-term-name">{term}</span>
    <span class="glossary-def">{resolved}</span>
    <span class="glossary-arrow" aria-hidden="true"></span>
  </span>
{/if}

<style>
  /* The term itself — reads naturally in prose, underline only hints
     that extra information is available on hover. */
  .glossary-term {
    display: inline;
    position: relative;
    cursor: default;
    color: inherit;
  }
  .glossary-term.has-def {
    cursor: help;
    text-decoration: underline dotted rgba(255, 255, 255, 0.28);
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
    transition: text-decoration-color 0.15s ease;
  }
  .glossary-term.has-def:hover,
  .glossary-term.has-def:focus-visible {
    text-decoration-color: rgba(255, 255, 255, 0.6);
    outline: none;
  }

  /* Tooltip itself — fixed-position, measured at show-time so it never
     clips the visualization panel or the viewport. */
  .glossary-tip {
    position: fixed;
    z-index: 9999;
    width: 220px;
    max-width: 220px;
    padding: 8px 10px 9px;
    border-radius: 7px;
    background: var(--elevation-overlay, #222222);
    box-shadow: var(--elevation-shadow-overlay, 0 6px 20px rgba(0, 0, 0, 0.55));
    font-family: var(--font-ui);
    color: rgba(255, 255, 255, 0.92);
    pointer-events: none;
    animation: glossary-fade 150ms ease-out both;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .glossary-term-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: rgba(255, 255, 255, 0.98);
  }
  .glossary-def {
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.72);
    font-weight: 400;
  }

  /* Small arrow pointer — a rotated square so it matches the bg. */
  .glossary-arrow {
    position: absolute;
    left: 50%;
    bottom: -4px;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: var(--elevation-overlay, #222222);
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }
  .flip .glossary-arrow {
    bottom: auto;
    top: -4px;
    box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3);
  }

  @keyframes glossary-fade {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .glossary-tip { animation: none; }
  }
</style>
