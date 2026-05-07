<!--
  TruncText — Phase-8 spec: every visible text block ≤ 200 characters,
  anything longer is hidden behind a "↓ more" inline link.

  Usage:
    <TruncText text={someLongString} />
    <TruncText text={someLongString} max={120} />

  Props:
    - text  (string, required): the prose to display.
    - max   (number, default 200): the visible-when-collapsed cap.
    - tag   (string, default 'span'): wrapper element.
    - moreLabel / lessLabel: customise the toggle copy.

  Behaviour:
    - text length ≤ max → renders inline, no toggle.
    - text length  > max → shows the first `max - 1` chars + "… [↓ more]".
      Clicking "more" reveals the rest in place; "↑ less" collapses again.
    - Word-boundary aware: cut never happens mid-word if a space exists
      within 30 chars of the hard limit. Falls back to hard-cut otherwise.
    - Pure CSS / Svelte 5 runes; no GSAP, no JS animation.
-->
<script>
  let { text = '', max = 200, tag = 'span', moreLabel = '↓ more', lessLabel = '↑ less', class: extraClass = '' } = $props();

  let expanded = $state(false);

  /** Cut the string at the last word boundary within 30 chars of `max`,
   *  or at `max - 1` if no convenient space exists. The cut point is
   *  recomputed reactively whenever `text` or `max` changes. */
  const cutPoint = $derived.by(() => {
    if (!text || text.length <= max) return text?.length ?? 0;
    const hardCut = max - 1;
    // Look back up to 30 chars for a space so we don't slice mid-word.
    const window = text.slice(Math.max(0, hardCut - 30), hardCut);
    const lastSpace = window.lastIndexOf(' ');
    if (lastSpace === -1) return hardCut;
    return Math.max(0, hardCut - 30) + lastSpace;
  });

  const isLong   = $derived((text?.length ?? 0) > max);
  const visible  = $derived(isLong && !expanded ? text.slice(0, cutPoint).trimEnd() + '…' : text);

  function toggle() { expanded = !expanded; }
</script>

<svelte:element this={tag} class="trunc {extraClass}">
  <span class="trunc-body">{visible}</span>
  {#if isLong}
    <button
      type="button"
      class="trunc-toggle"
      aria-expanded={expanded}
      onclick={toggle}
    >{expanded ? lessLabel : moreLabel}</button>
  {/if}
</svelte:element>

<style>
  .trunc { display: inline; }
  .trunc-body { white-space: pre-wrap; }
  .trunc-toggle {
    display: inline;
    background: none;
    border: none;
    padding: 0 0 0 4px;
    font: inherit;
    color: var(--c-text-sec, #8b949e);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    opacity: 0.85;
    transition: opacity var(--t-fast, 0.25s) var(--ease-state, ease-in-out);
  }
  .trunc-toggle:hover,
  .trunc-toggle:focus-visible {
    opacity: 1;
    color: var(--c-text, #c9d1d9);
  }
  .trunc-toggle:focus-visible {
    outline: 2px solid var(--c-accent-stack, #7aa2f7);
    outline-offset: 2px;
    border-radius: 2px;
  }
</style>
