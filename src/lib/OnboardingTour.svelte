<script>
  /**
   * OnboardingTour.svelte
   *
   * First-run guided tour overlay. Shows tooltip bubbles pointing at key UI
   * elements. Persisted in localStorage so it only appears once.
   *
   * Usage: <OnboardingTour accent="#38bdf8" />
   *
   * Tour steps reference CSS selectors in ModuleShell.svelte.
   */
  import { onMount, onDestroy } from 'svelte';

  /** @type {string} */
  let { accent = '#6366f1' } = $props();

  const STORAGE_KEY = 'visualjs-onboarding-done';

  const STEPS = [
    {
      selector: '.ex-bar',
      title: 'Pick an example',
      text: 'Choose a code snippet to explore. Each one teaches a different concept.',
      arrow: 'top',
    },
    {
      selector: '.code-panel',
      title: 'Read & edit code',
      text: 'View the source code here. You can edit it to experiment with your own logic.',
      arrow: 'top',
    },
    {
      selector: '.rb',
      title: 'Visualize execution',
      text: 'Click this button to run the code and see a step-by-step visualization.',
      arrow: 'left',
    },
    {
      selector: '.vis-panel',
      title: 'Watch the CPU',
      text: 'After running, this panel shows CPU state, memory, and output — updated each step.',
      arrow: 'top',
    },
  ];

  let currentStep = $state(-1); // -1 = not started / dismissed
  let tooltipStyle = $state('');
  let arrowDir = $state('top');
  let visible = $state(false);

  function isDone() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch { return false; }
  }

  function markDone() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }

  function dismiss() {
    currentStep = -1;
    visible = false;
    markDone();
  }

  function next() {
    if (currentStep >= STEPS.length - 1) {
      dismiss();
      return;
    }
    currentStep++;
    positionTooltip();
  }

  function prev() {
    if (currentStep <= 0) return;
    currentStep--;
    positionTooltip();
  }

  function positionTooltip() {
    const step = STEPS[currentStep];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      // Element not found — skip this step
      if (currentStep < STEPS.length - 1) { currentStep++; positionTooltip(); }
      else dismiss();
      return;
    }

    const rect = el.getBoundingClientRect();
    arrowDir = step.arrow;

    // Calculate position based on arrow direction
    let top, left;
    const pad = 12;

    if (step.arrow === 'top') {
      // Tooltip below the element
      top = rect.bottom + pad;
      left = rect.left + rect.width / 2;
    } else if (step.arrow === 'bottom') {
      // Tooltip above the element
      top = rect.top - pad;
      left = rect.left + rect.width / 2;
    } else if (step.arrow === 'left') {
      // Tooltip to the right of the element
      top = rect.top + rect.height / 2;
      left = rect.right + pad;
    } else {
      // Tooltip to the left of the element
      top = rect.top + rect.height / 2;
      left = rect.left - pad;
    }

    // Clamp to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 20) left = 20;
    if (left > vw - 20) left = vw - 20;
    if (top < 10) top = 10;
    if (top > vh - 120) top = vh - 120;

    tooltipStyle = `top:${top}px;left:${left}px`;
  }

  /** @type {number|undefined} */
  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentStep >= 0) positionTooltip();
    }, 100);
  }

  onMount(() => {
    if (isDone()) return;
    // Small delay to let the module render first
    setTimeout(() => {
      visible = true;
      currentStep = 0;
      positionTooltip();
    }, 600);
    window.addEventListener('resize', onResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
  });

  const stepData = $derived(currentStep >= 0 && currentStep < STEPS.length ? STEPS[currentStep] : null);
</script>

{#if visible && stepData}
  <!-- Backdrop overlay -->
  <div class="tour-backdrop" onclick={dismiss} aria-hidden="true"></div>

  <!-- Tooltip -->
  <div
    class="tour-tip"
    class:arrow-top={arrowDir === 'top'}
    class:arrow-bottom={arrowDir === 'bottom'}
    class:arrow-left={arrowDir === 'left'}
    class:arrow-right={arrowDir === 'right'}
    style="{tooltipStyle};--acc:{accent}"
    role="dialog"
    aria-label="Onboarding step {currentStep + 1} of {STEPS.length}"
  >
    <div class="tour-header">
      <span class="tour-step-badge">{currentStep + 1}/{STEPS.length}</span>
      <button class="tour-close" onclick={dismiss} aria-label="Close tour">✕</button>
    </div>
    <h4 class="tour-title">{stepData.title}</h4>
    <p class="tour-text">{stepData.text}</p>
    <div class="tour-nav">
      {#if currentStep > 0}
        <button class="tour-btn tour-btn-ghost" onclick={prev}>← Back</button>
      {:else}
        <button class="tour-btn tour-btn-ghost" onclick={dismiss}>Skip</button>
      {/if}
      <button class="tour-btn tour-btn-primary" onclick={next}>
        {currentStep >= STEPS.length - 1 ? 'Got it!' : 'Next →'}
      </button>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ─────────────────────────────────────────────────────────── */
  .tour-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  /* ── Tooltip ──────────────────────────────────────────────────────────── */
  .tour-tip {
    position: fixed;
    z-index: 9999;
    transform: translate(-50%, 0);
    max-width: 320px;
    width: max-content;
    min-width: 220px;
    background: color-mix(in srgb, var(--acc) 6%, #111118);
    border: 1px solid color-mix(in srgb, var(--acc) 30%, rgba(255,255,255,0.08));
    border-radius: 12px;
    padding: 14px 16px 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    animation: tour-in 0.25s ease;
  }

  .arrow-top    { transform: translate(-50%, 0); }
  .arrow-bottom { transform: translate(-50%, -100%); }
  .arrow-left   { transform: translate(0, -50%); }
  .arrow-right  { transform: translate(-100%, -50%); }

  /* Arrow pseudo-element */
  .tour-tip::before {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: color-mix(in srgb, var(--acc) 6%, #111118);
    border: 1px solid color-mix(in srgb, var(--acc) 30%, rgba(255,255,255,0.08));
    border-radius: 2px;
    transform: rotate(45deg);
  }

  .arrow-top::before    { top: -7px; left: 50%; margin-left: -6px; border-bottom: none; border-right: none; }
  .arrow-bottom::before { bottom: -7px; left: 50%; margin-left: -6px; border-top: none; border-left: none; }
  .arrow-left::before   { left: -7px; top: 50%; margin-top: -6px; border-top: none; border-right: none; }
  .arrow-right::before  { right: -7px; top: 50%; margin-top: -6px; border-bottom: none; border-left: none; }

  @keyframes tour-in {
    from { opacity: 0; scale: 0.96; }
    to   { opacity: 1; scale: 1; }
  }

  /* ── Content ──────────────────────────────────────────────────────────── */
  .tour-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .tour-step-badge {
    font-size: 0.55rem;
    font-weight: 700;
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 15%, transparent);
    padding: 2px 8px;
    border-radius: 10px;
    font-family: 'Geist Mono', monospace;
    letter-spacing: 0.5px;
  }

  .tour-close {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.35);
    font-size: 0.8rem;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.15s;
  }
  .tour-close:hover { color: rgba(255,255,255,0.7); }

  .tour-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--a11y-text, #eeeef2);
    margin: 0 0 4px;
    font-family: 'Geist', system-ui, sans-serif;
  }

  .tour-text {
    font-size: 0.72rem;
    color: var(--a11y-text-sec, #c8c8d4);
    line-height: 1.55;
    margin: 0 0 12px;
    font-family: 'Geist', system-ui, sans-serif;
  }

  /* ── Navigation ───────────────────────────────────────────────────────── */
  .tour-nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .tour-btn {
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.68rem;
    font-weight: 600;
    font-family: 'Geist', system-ui, sans-serif;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tour-btn-primary {
    background: var(--acc);
    color: var(--a11y-bg, #080810);
  }
  .tour-btn-primary:hover {
    filter: brightness(1.15);
  }

  .tour-btn-ghost {
    background: transparent;
    color: rgba(255,255,255,0.45);
    border: 1px solid rgba(255,255,255,0.10);
  }
  .tour-btn-ghost:hover {
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.2);
  }

  /* ── Mobile ───────────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .tour-tip {
      max-width: calc(100vw - 24px);
      min-width: 0;
    }
    .tour-title { font-size: 0.82rem; }
    .tour-text  { font-size: 0.68rem; }
    .tour-btn   { padding: 8px 14px; min-height: 44px; }
  }
</style>
