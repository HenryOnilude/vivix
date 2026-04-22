<script>
  /**
   * TapTooltip — accessible tooltip that works on both hover (desktop) and tap (mobile).
   *
   * On desktop: shows on hover like a native tooltip.
   * On mobile: shows on tap, dismisses on tap-outside or after 3s.
   *
   * Props:
   *   text  — tooltip content string
   *   position — 'top' | 'bottom' (default 'top')
   */
  let { text = '', position = 'top' } = $props();

  let visible = $state(false);
  let timer = null;

  function show() {
    visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => { visible = false; }, 3000);
  }

  function toggle(e) {
    // Prevent tap from propagating to the document click-away listener immediately
    e.stopPropagation();
    if (visible) {
      visible = false;
      clearTimeout(timer);
    } else {
      show();
    }
  }

  function handleClickAway() {
    if (visible) {
      visible = false;
      clearTimeout(timer);
    }
  }

  // Attach/detach click-away listener
  $effect(() => {
    if (visible) {
      document.addEventListener('pointerdown', handleClickAway);
      return () => document.removeEventListener('pointerdown', handleClickAway);
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="tap-tooltip-wrap"
  onpointerdown={toggle}
  onmouseenter={() => { if (window.matchMedia('(hover: hover)').matches) show(); }}
  onmouseleave={() => { visible = false; clearTimeout(timer); }}
>
  <slot />
  {#if visible && text}
    <span
      class="tap-tooltip"
      class:tt-top={position === 'top'}
      class:tt-bottom={position === 'bottom'}
      role="tooltip"
      aria-live="polite"
    >{text}</span>
  {/if}
</span>

<style>
  .tap-tooltip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tap-tooltip {
    position: absolute;
    z-index: 100;
    background: #1a1a2e;
    color: #e0e0e0;
    font-size: 0.62rem;
    font-family: var(--font-code);
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #2a2a44;
    white-space: nowrap;
    max-width: 260px;
    white-space: normal;
    word-break: break-word;
    line-height: 1.4;
    pointer-events: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    animation: tt-fade-in 0.15s ease;
  }

  .tt-top {
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tt-bottom {
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }

  @keyframes tt-fade-in {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .tt-bottom {
    animation-name: tt-fade-in-bottom;
  }

  @keyframes tt-fade-in-bottom {
    from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
