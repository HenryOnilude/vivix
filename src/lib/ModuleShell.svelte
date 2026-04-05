<script>
  /**
   * ModuleShell — shared layout component for all 8 learning modules.
   *
   * Handles:
   *   • All shared $state/$derived variables
   *   • Step controls (first/prev/next/last/auto/timeline scrubber)
   *   • Code panel (editor ↔ highlighted display)
   *   • CPU dashboard (via CpuDash child, with snippet hooks)
   *   • Heap memory card (opt-out via showHeap=false)
   *   • STDOUT card
   *   • Complexity analysis card (dynamic or preset)
   *   • Unsupported-syntax error messages
   *   • Keyboard shortcuts (← → Space Home End) when not focused in editor
   *
   * Snippet hooks for module-specific content (all receive the current step `sd`):
   *   topPanel(sd)      — inserted between CPU and heap (e.g. branch flowchart, loop tracker)
   *   bottomPanel(sd)   — inserted between heap and STDOUT (e.g. byte map)
   *   liveStats(sd)     — replaces the default stats row inside the complexity card
   *   placeholder()     — replaces the generic "click Visualize" placeholder
   *   cpuRegisters(sd)  — SVG: right-column registers inside CpuDash
   *   cpuGauge(sd)      — SVG: bottom-right gauge inside CpuDash
   *   cpuStack(sd)      — SVG: optional stack-visual override inside CpuDash
   */
  import { onMount } from 'svelte';
  import { interpret, parseCode, checkSupported, friendlyError } from './interpreter.js';
  import { fv, tc, tb, COMPLEXITY_BARS, analyzeComplexity } from './utils.js';
  import { makeAnimateBox, makeAnimateVal, animateBar } from './animations.js';
  import { createInterpreterWorker } from './useInterpreterWorker.js';
  import { phColor as _phColor, phIcon, computeVarDiff, markerPct, fillPct as computeFillPct, complexityBadgeColor } from './shell-logic.js';
  import CodeEditor from './CodeEditor.svelte';
  import CpuDash from './CpuDash.svelte';
  import TapTooltip from './TapTooltip.svelte';


  /**
   * @typedef {Object} CxData
   * @property {string} time
   * @property {string} space
   * @property {string} timeWhy
   * @property {string} spaceWhy
   * @property {boolean} [dynamic]
   */

  let {
    // ── identity ──────────────────────────────────────────────────────────────
    titlePrefix  = '',
    titleAccent  = '',
    subtitle     = '',
    desc         = '',
    accent       = '#38bdf8',

    // ── data ──────────────────────────────────────────────────────────────────
    /** @type {Array<{label:string, code:string, cx?:CxData, complexity?:CxData}>} */
    examples = [],

    // ── interpreter ───────────────────────────────────────────────────────────
    /** Extra options forwarded to interpret() */
    interpreterOptions = {},
    /** (rawStep, codeLines) => augmentedStep — add module-specific fields */
    mapStep = undefined,
    /** Completely replaces the built-in interpret() call if provided */
    executeCode = undefined,

    // ── layout ────────────────────────────────────────────────────────────────
    showHeap = true,

    // ── Svelte 5 snippets ─────────────────────────────────────────────────────
    topPanel    = undefined,
    bottomPanel = undefined,
    liveStats   = undefined,
    placeholder = undefined,
    cpuRegisters = undefined,
    cpuGauge     = undefined,
    cpuStack     = undefined,
  } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let selEx    = $state(0);
  // eslint-disable-next-line -- intentionally captures initial example code
  let codeText = $state(examples[0]?.code ?? '');
  let step     = $state(-1);
  let total    = $state(0);
  let steps    = $state([]);
  let playing  = $state(false);
  let timer    = $state(null);
  let hasRun   = $state(false);
  let err      = $state('');
  /** @type {{ friendly:string, hint:string, raw:string }|null} */
  let errFriendly = $state(null);
  let speed    = $state(1);   // 0.5 | 1 | 2 | 4
  /** @type {'simple'|'advanced'} */
  let explainMode = $state('simple');
  /** @type {CxData|null} */
  let dynamicCx = $state(null);
  let running   = $state(false);

  // ── Web Worker for off-main-thread interpretation ──
  let interpWorker = null;

  // ── Derived ────────────────────────────────────────────────────────────────
  let lines  = $derived(codeText.split('\n'));
  let sd     = $derived(step >= 0 && step < steps.length ? steps[step] : null);
  let prev   = $derived(step >= 1 && step < steps.length ? steps[step - 1] : null);

  /** Playback interval in ms — derived from speed */
  let interval = $derived(Math.round(1800 / speed));

  /** True when the code in the editor doesn't match the selected example */
  let isCustomCode = $derived(codeText !== (examples[selEx]?.code ?? ''));

  /** Complexity to show: dynamic if user edited code, preset otherwise */
  let cx = $derived.by(() => {
    const ex  = examples[selEx] ?? {};
    const preset = ex.cx ?? ex.complexity ?? { time: 'O(?)', space: 'O(?)', timeWhy: '', spaceWhy: '' };
    if (isCustomCode && hasRun && dynamicCx) return dynamicCx;
    return preset;
  });

  let varDiff = $derived.by(() => {
    if (!sd) return {};
    return computeVarDiff(sd.vars || {}, prev ? (prev.vars || {}) : {});
  });

  let varArr = $derived(sd ? Object.entries(sd.vars || {}) : []);

  /** Badge colour for the time complexity label */
  let timeBadgeColor  = $derived(complexityBadgeColor(cx.time));
  /** Badge colour for the space complexity label */
  let spaceBadgeColor = $derived(complexityBadgeColor(cx.space));

  // ── GSAP actions (accent-coloured) ─────────────────────────────────────────
  let animateBox = $derived(makeAnimateBox(accent));
  const animateVal = makeAnimateVal();

  // ── Phase helpers (delegated to shell-logic.js) ───────────────────────────
  function phColor(ph) { return _phColor(ph, accent); }

  // ── Core execute ───────────────────────────────────────────────────────────
  async function _runCode() {
    err = '';
    errFriendly = null;
    running = true;
    try {
      let rawSteps;
      if (typeof executeCode === 'function') {
        rawSteps = executeCode(codeText);
        dynamicCx = null;
      } else {
        const parseResult = parseCode(codeText);
        if (parseResult.error) {
          errFriendly = parseResult.friendly || friendlyError(parseResult.error, codeText);
          throw new Error(parseResult.error);
        }

        const check = checkSupported(parseResult.ast);
        if (!check.ok) {
          errFriendly = friendlyError(check.message, codeText);
          throw new Error(check.message);
        }

        if (isCustomCode) dynamicCx = analyzeComplexity(parseResult.ast);
        else              dynamicCx = null;

        // Use Web Worker for non-blocking execution
        if (!interpWorker) interpWorker = createInterpreterWorker();
        const result = await interpWorker.run(codeText, interpreterOptions);
        if (result.error) {
          errFriendly = result.friendly || friendlyError(result.error, codeText);
          throw new Error(result.error);
        }
        rawSteps = result.steps;
      }

      const codeLines = codeText.split('\n');
      steps = rawSteps.map(s => mapStep ? mapStep(s, codeLines) : s);
      total  = steps.length;
      step   = 0;
      hasRun = true;
    } catch (e) {
      err = e.message;
      if (!errFriendly) errFriendly = friendlyError(e.message, codeText);
    }
    running = false;
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  function goFirst() { if (hasRun) step = 0; }
  function goPrev()  { if (hasRun && step > 0) step--; }
  function goNext()  { if (hasRun && step < total - 1) step++; }
  function goLast()  { if (hasRun) step = total - 1; }

  function _startTimer(ms) {
    timer = setInterval(() => {
      if (step < total - 1) step++;
      else { clearInterval(timer); timer = null; playing = false; }
    }, ms);
  }

  function toggleAuto() {
    if (playing) {
      clearInterval(timer); timer = null; playing = false;
    } else {
      if (step >= total - 1) step = 0;
      playing = true;
      _startTimer(interval);
    }
  }

  /** Change speed; restart timer if currently playing */
  function setSpeed(s) {
    speed = s;
    if (playing) {
      clearInterval(timer);
      _startTimer(Math.round(1800 / s));
    }
  }

  function loadEx(idx) {
    selEx    = idx;
    codeText = examples[idx].code;
    _reset();
  }

  function editCode() { _reset(); }

  function _reset() {
    hasRun = false; step = -1; steps = []; err = ''; errFriendly = null; dynamicCx = null;
    if (playing) { clearInterval(timer); timer = null; playing = false; }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function handleKey(e) {
    if (!hasRun) return;
    const el = document.activeElement;
    if (!el) return;
    // Don't intercept when typing in CodeMirror or any editable element
    if (el.closest('.cm-editor') || el.isContentEditable ||
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); goPrev();      break;
      case 'ArrowRight': e.preventDefault(); goNext();      break;
      case 'Space':      e.preventDefault(); toggleAuto();  break;
      case 'Home':       e.preventDefault(); goFirst();     break;
      case 'End':        e.preventDefault(); goLast();      break;
    }
  }

  // ── Timeline helpers (delegated to shell-logic.js) ────────────────────────
  /** Fill width percentage up to current step */
  let fillPct = $derived(computeFillPct(step, total));

  /** Whether to show icons inside markers (too many = just dots) */
  let showIcons = $derived(total <= 35);

  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (timer) clearInterval(timer);
      if (interpWorker) { interpWorker.terminate(); interpWorker = null; }
    };
  });
</script>

<div class="mod" role="main" aria-label="{titlePrefix}{titleAccent} learning module">
  <!-- Header -->
  <header class="hdr">
    <a href="#/" class="back" aria-label="Back to all modules">← modules</a>
    <div class="title-group">
      <h2>{titlePrefix}<span class="ac" style="color:{accent}">{titleAccent}</span>
        <span class="sub">{subtitle}</span></h2>
      {#if desc}<p class="desc">{desc}</p>{/if}
    </div>
    <div class="hdr-spacer"></div>
  </header>

  <!-- Example picker -->
  <nav class="ex-bar" aria-label="Example programs">
    <span class="ex-lbl" id="ex-label">Examples:</span>
    {#each examples as ex, i}
      <button
        class="ex-btn"
        class:act={selEx === i}
        style="--acc:{accent}"
        onclick={() => loadEx(i)}
        aria-pressed={selEx === i}
        aria-describedby="ex-label"
      >{ex.label}</button>
    {/each}
  </nav>

  <!-- Main split layout -->
  <div class="main">

    <!-- ── LEFT: CODE PANEL ────────────────────────────────────────────────── -->
    <div class="code-panel">
      <div class="ph">
        <span class="pt">Source Code</span>
        <div class="pa">
          {#if hasRun}
            <button class="eb" onclick={editCode} aria-label="Edit code">✎ Edit</button>
          {/if}
          <button class="rb" style="background:{accent};color:#0a0a0f" onclick={_runCode} disabled={running}
            aria-label={running ? 'Running code' : 'Visualize code execution'}>
            {running ? '⏳ Running…' : '▶ Visualize'}
          </button>
        </div>
      </div>

      {#if !hasRun}
        <CodeEditor bind:value={codeText} {accent} />
      {:else}
        <div class="code-disp">
          {#each lines as line, i}
            <div class="cl"
              class:cl-exec ={sd && sd.lineIndex      === i}
              class:cl-next ={sd && sd.nextLineIndex  === i}
              class:cl-true ={sd && sd.lineIndex === i && sd.cond === true}
              class:cl-false={sd && sd.lineIndex === i && sd.cond === false}
              style="--acc:{accent}"
            >
              <span class="ln">{i + 1}</span>
              <span class="ac-col">
                {#if      sd && sd.lineIndex     === i}<span class="ae" style="color:{accent}">▶</span>
                {:else if sd && sd.nextLineIndex === i}<span class="an">▸</span>
                {:else}<span class="ax">&nbsp;</span>{/if}
              </span>
              <span class="lt">{line || ' '}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if err}
        <div class="err-card">
          <div class="err-head">
            <span class="err-icon">!</span>
            <span class="err-friendly">{errFriendly?.friendly ?? err}</span>
          </div>
          {#if errFriendly?.hint}
            <pre class="err-hint">{errFriendly.hint}</pre>
          {/if}
          <details class="err-details">
            <summary class="err-toggle">Show technical error</summary>
            <code class="err-raw">{err}</code>
          </details>
        </div>
      {/if}

      {#if hasRun}
        <!-- Step controls row -->
        <div class="ctrls" role="toolbar" aria-label="Step controls">
          <TapTooltip text="First (Home)"><button class="cb" onclick={goFirst} disabled={step <= 0} aria-label="First step">⟪</button></TapTooltip>
          <TapTooltip text="Back (←)"><button class="cb" onclick={goPrev}  disabled={step <= 0} aria-label="Previous step">‹</button></TapTooltip>
          <TapTooltip text="Play/Pause (Space)"><button class="cb abtn" style="color:{accent};border-color:{accent}33"
            onclick={toggleAuto} aria-label={playing ? 'Pause auto-play' : 'Start auto-play'}>{playing ? '⏸' : '⏵'}</button></TapTooltip>
          <TapTooltip text="Forward (→)"><button class="cb" onclick={goNext}  disabled={step >= total - 1} aria-label="Next step">›</button></TapTooltip>
          <TapTooltip text="Last (End)"><button class="cb" onclick={goLast}  disabled={step >= total - 1} aria-label="Last step">⟫</button></TapTooltip>
          <span class="sc" role="status" aria-live="polite" aria-label="Step {step + 1} of {total}">{step + 1}/{total}</span>
          <!-- Speed selector -->
          <div class="speed-row">
            {#each [0.5, 1, 2, 4] as s}
              <button
                class="spd-btn"
                class:spd-act={speed === s}
                style="--acc:{accent}"
                onclick={() => setSpeed(s)}
                aria-label="{s}x speed: {s === 0.5 ? '3600' : s === 1 ? '1800' : s === 2 ? '900' : '450'}ms per step"
              >{s}x</button>
            {/each}
          </div>
        </div>

        <!-- Keyboard shortcut hints -->
        <div class="kbd-hints" aria-hidden="true">
          <span class="kbd-hint"><kbd>←</kbd> Prev</span>
          <span class="kbd-hint"><kbd>→</kbd> Next</span>
          <span class="kbd-hint"><kbd>Space</kbd> Play</span>
          <span class="kbd-hint"><kbd>Home</kbd> First</span>
          <span class="kbd-hint"><kbd>End</kbd> Last</span>
        </div>

        <!-- Timeline scrubber -->
        <div class="timeline" style="--acc:{accent}" role="slider" aria-label="Execution timeline" aria-valuemin="1" aria-valuemax={total} aria-valuenow={step + 1} aria-valuetext="Step {step + 1} of {total}: {sd?.phase ?? 'ready'}">
          <div class="tl-track">
            <!-- Progress fill -->
            <div class="tl-fill" style="width:{fillPct}%"></div>
            <!-- Step markers -->
            {#each steps as s, i}
              {@const isActive = i === step}
              {@const isPast   = i < step}
              <button
                class="tl-dot"
                class:tl-active={isActive}
                class:tl-past={isPast}
                style="left:{markerPct(i, total)}%;--ph:{phColor(s.phase)}"
                onclick={() => step = i}
                aria-label="Step {i + 1}: {s.phase ?? 'exec'}"
              >{#if showIcons || isActive}<span class="tl-icon">{phIcon(s.phase)}</span>{/if}</button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- ── RIGHT: VISUAL STATE PANEL ──────────────────────────────────────── -->
    <div class="vis-panel">
      {#if sd}

        <!-- CPU dashboard -->
        {#key step}
          <CpuDash
            {sd} {step} {total} {accent} {phColor}
            {explainMode}
            onToggleMode={() => { explainMode = explainMode === 'simple' ? 'advanced' : 'simple'; }}
            registers={cpuRegisters}
            gauge={cpuGauge}
            stack={cpuStack}
          />
        {/key}

        <!-- Module-specific content above the heap (e.g. branch flowchart, loop tracker) -->
        {#if topPanel}{@render topPanel(sd)}{/if}

        <!-- Default heap memory card -->
        {#if showHeap && varArr.length > 0}
          <div class="heap-card">
            <div class="heap-hdr" role="heading" aria-level="3">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="1" y="1" width="5" height="5" rx="1" fill={accent} opacity="0.5"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill={accent} opacity="0.3"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill={accent} opacity="0.3"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill={accent} opacity="0.15"/>
              </svg>
              <span class="heap-title">HEAP MEMORY</span>
              <span class="heap-count">{varArr.length} var{varArr.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="heap-grid">
              {#each varArr as [name, val], idx}
                {@const status = varDiff[name] || 'same'}
                {@const color  = tc(val)}
                <div class="heap-box" use:animateBox={{ status, step }}>
                  <div class="heap-addr">0x{(0x4A00 + idx * 8).toString(16).toUpperCase()}</div>
                  <div class="heap-head">
                    <span class="heap-name">{name}</span>
                    <span class="heap-type" style="color:{color};border-color:{color}33">{tb(val)}</span>
                  </div>
                  <div class="heap-val" style="color:{color}"
                    use:animateVal={{ status, color, step }}
                  >{fv(val)}</div>
                  {#if sd.changed && sd.changed.name === name}
                    <div class="heap-change">
                      <span class="heap-old">{fv(sd.changed.from)}</span>
                      <span class="heap-arrow">→</span>
                      <span class="heap-new" style="color:{color}">{fv(sd.changed.to)}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Module-specific content below the heap (e.g. byte map) -->
        {#if bottomPanel}{@render bottomPanel(sd)}{/if}

        <!-- STDOUT -->
        {#if sd.output && sd.output.length > 0}
          <div class="out-card">
            <div class="out-hdr" role="heading" aria-level="3">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="0" y="0" width="12" height="12" rx="2" fill="#111"/>
                <text x="3" y="9" fill={accent} font-size="8" font-family="monospace">$</text>
              </svg>
              <span>STDOUT</span>
            </div>
            {#each sd.output as line}
              <div class="out-ln">› {line}</div>
            {/each}
          </div>
        {/if}

        <!-- COMPLEXITY ANALYSIS -->
        <div class="cx-card">
          <div class="cx-hdr">
            <span class="cx-title">COMPLEXITY ANALYSIS</span>
            {#if cx.dynamic}<span class="cx-live-badge">live</span>{/if}
          </div>
          <div class="cx-chart">
            {#each COMPLEXITY_BARS as b}
              {@const active = cx.time === b.label || (b.label === 'O(1)' && cx.time === 'O(1)')}
              <div class="cx-col">
                <div class="cx-bar" style="background:{b.color}"
                  use:animateBar={{ active, h: b.h, color: b.color, step }}
                ></div>
                <span class="cx-lbl" style="color:{active ? b.color : '#222'}">{b.label}</span>
              </div>
            {/each}
          </div>
          <div class="cx-detail-grid">
            <div class="cx-row">
              <div class="cx-label">
                <svg width="12" height="12" viewBox="0 0 12 12" style="vertical-align:-1px;margin-right:4px">
                  <circle cx="6" cy="6" r="5" fill="none" stroke={timeBadgeColor} stroke-width="1" opacity="0.5"/>
                  <line x1="6" y1="3" x2="6" y2="6" stroke={timeBadgeColor} stroke-width="1.2" stroke-linecap="round"/>
                  <line x1="6" y1="6" x2="8" y2="7.5" stroke={timeBadgeColor} stroke-width="1" stroke-linecap="round"/>
                </svg>
                Time Complexity
              </div>
              <div class="cx-badge" style="color:{timeBadgeColor};background:{timeBadgeColor}20">{cx.time}</div>
            </div>
            <details class="cx-explain-toggle">
              <summary class="cx-explain-summary">Why {cx.time}?</summary>
              <div class="cx-why">{cx.timeWhy}</div>
            </details>
            <div class="cx-row">
              <div class="cx-label">
                <svg width="12" height="12" viewBox="0 0 12 12" style="vertical-align:-1px;margin-right:4px">
                  <rect x="2" y="3" width="8" height="7" rx="1" fill="none" stroke={spaceBadgeColor} stroke-width="1" opacity="0.5"/>
                  <rect x="4" y="1" width="4" height="3" rx="1" fill="none" stroke={spaceBadgeColor} stroke-width="0.8" opacity="0.4"/>
                </svg>
                Space Complexity
              </div>
              <div class="cx-badge" style="color:{spaceBadgeColor};background:{spaceBadgeColor}20">{cx.space}</div>
            </div>
            <details class="cx-explain-toggle">
              <summary class="cx-explain-summary">Why {cx.space}?</summary>
              <div class="cx-why">{cx.spaceWhy}</div>
            </details>
          </div>
          <div class="cx-stats">
            {#if liveStats}
              {@render liveStats(sd)}
            {:else}
              <span class="cx-s">
                <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
                {sd.memOps || 0} writes
              </span>
            {/if}
          </div>
        </div>

      {:else if !hasRun}
        {#if placeholder}
          {@render placeholder()}
        {:else}
          <div class="vis-placeholder">
            <p class="ph-text">Write code and click
              <strong style="color:{accent}">▶ Visualize</strong>
              to see execution
            </p>
          </div>
        {/if}
      {/if}
    </div>

  </div>
</div>

<style>
  /* ── Outer layout ──────────────────────────────────────────────────────── */
  .mod {
    width:100%; height:100%; display:flex; flex-direction:column;
    padding:14px 18px; gap:10px; overflow:hidden;
    font-family:'Geist','Inter','SF Pro',system-ui,sans-serif;
    color:var(--a11y-text-sec);
    /* Module-identity atmosphere: accent color orb top-right, subtle opposite corner */
    background-color: var(--a11y-bg);
    background-image:
      radial-gradient(ellipse 65% 50% at 100% 0%,   color-mix(in srgb, var(--acc) 10%, transparent) 0%, transparent 65%),
      radial-gradient(ellipse 45% 35% at 0%   100%,  color-mix(in srgb, var(--acc) 6%,  transparent) 0%, transparent 60%);
  }
  .hdr { display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .hdr-spacer { flex:1; }
  .back { font-size:0.78rem; color:rgba(255,255,255,0.45); text-decoration:none; transition:color 0.2s; font-family:'Geist','Inter',system-ui,sans-serif; }
  .back:hover { color:var(--acc); }
  .title-group { display:flex; flex-direction:column; }
  h2  { font-size:1.3rem; font-weight:700; color:rgba(255,255,255,0.95); margin:0; font-family:'SF Mono','Fira Code',monospace; }
  .ac  { /* colour set inline */ }
  .sub { font-weight:400; font-size:0.88rem; color:rgba(255,255,255,0.55); font-family:'Geist','Inter',system-ui,sans-serif; }
  .desc { font-size:0.72rem; color:rgba(255,255,255,0.52); margin:2px 0 0; font-family:'Geist','Inter',system-ui,sans-serif; }

  /* ── Example picker ────────────────────────────────────────────────────── */
  .ex-bar  { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .ex-lbl  { font-size:0.68rem; color:rgba(255,255,255,0.42); font-family:'Geist','Inter',system-ui,sans-serif; }
  .ex-btn  { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:5px; color:rgba(255,255,255,0.58); font-size:0.72rem; padding:4px 11px; cursor:pointer; font-family:'Geist','Inter',system-ui,sans-serif; transition:all 0.2s; }
  .ex-btn:hover { border-color:color-mix(in srgb, var(--acc) 45%, transparent); color:rgba(255,255,255,0.88); }
  .ex-btn.act   { border-color:color-mix(in srgb, var(--acc) 65%, transparent); color:var(--acc); background:color-mix(in srgb, var(--acc) 12%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, var(--acc) 25%, transparent); font-weight:600; }

  /* ── Split main area ───────────────────────────────────────────────────── */
  .main { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }

  /* ── Code panel (left) ─────────────────────────────────────────────────── */
  .code-panel { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ph  {
    display:flex; justify-content:space-between; align-items:center;
    padding:5px 10px;
    background:var(--a11y-surface2);
    border:1px solid color-mix(in srgb, var(--acc) 18%, rgba(255,255,255,0.05));
    border-bottom: 1px solid rgba(255,255,255,0.04);
    border-radius:8px 8px 0 0;
    /* Top accent stripe */
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    position: relative;
  }
  .ph::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0;
    height:1.5px;
    border-radius:8px 8px 0 0;
    background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--acc) 60%, transparent), transparent);
  }
  .pt  { font-size:0.62rem; color:rgba(255,255,255,0.3); letter-spacing:1px; text-transform:uppercase; font-weight:600; }
  .pa  { display:flex; gap:6px; }
  .rb  { border:none; border-radius:5px; padding:4px 14px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; transition:filter 0.15s, box-shadow 0.15s; }
  .rb:hover { filter:brightness(1.12); box-shadow:0 0 12px color-mix(in srgb, var(--acc) 30%, transparent); }
  .eb  { background:transparent; color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1); border-radius:5px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; transition:all 0.2s; }
  .eb:hover { color:rgba(255,255,255,0.75); border-color:rgba(255,255,255,0.22); }

  .code-disp {
    flex:1; background:var(--a11y-code-bg);
    border:1px solid color-mix(in srgb, var(--acc) 12%, rgba(255,255,255,0.05));
    border-top:none; border-radius:0 0 8px 8px;
    padding:6px 0; overflow-y:auto;
    font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8;
  }
  .cl       { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .cl-exec  { background:color-mix(in srgb, var(--acc) 9%, transparent); }
  .cl-next  { background:#f59e0b0c; }
  .cl-true  { background:#4ade8014; }
  .cl-false { background:#f8717114; }
  .ln      { width:30px; text-align:right; color:rgba(255,255,255,0.18); font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .ac-col  { width:20px; text-align:center; flex-shrink:0; }
  .ae      { font-size:0.7rem; }
  .an      { color:#f59e0b; font-size:0.7rem; }
  .ax      { opacity:0; }
  .lt      { white-space:pre; color:var(--a11y-text-sec); }

  /* ── Step controls ─────────────────────────────────────────────────────── */
  .ctrls  { display:flex; gap:4px; align-items:center; flex-shrink:0; }
  .cb     { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:5px; color:rgba(255,255,255,0.65); font-size:0.82rem; padding:4px 11px; cursor:pointer; transition:all 0.15s; font-family:'Geist','Inter',system-ui,sans-serif; }
  .cb:hover:not(:disabled) { border-color:rgba(255,255,255,0.25); color:rgba(255,255,255,0.92); background:rgba(255,255,255,0.07); }
  .cb:disabled { opacity:0.22; cursor:default; }
  .abtn   { /* colour set inline */ }
  .sc     { font-size:0.62rem; color:rgba(255,255,255,0.38); margin-left:6px; font-family:'Geist','Inter',system-ui,sans-serif; }
  /* ── Error card ──────────────────────────────────────────────────────── */
  .err-card     { background:#ef444410; border:1px solid #ef444433; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .err-head     { display:flex; align-items:flex-start; gap:8px; padding:8px 12px; background:#ef44440a; border-bottom:1px solid #ef444418; }
  .err-icon     { flex-shrink:0; width:20px; height:20px; display:flex; align-items:center; justify-content:center; background:#ef4444; color:#0a0a0f; font-size:0.7rem; font-weight:800; border-radius:50%; margin-top:1px; }
  .err-friendly { font-size:0.78rem; color:#fca5a5; line-height:1.5; font-weight:600; }
  .err-hint     { padding:8px 12px; font-size:0.7rem; color:#d4a0a0; line-height:1.65; white-space:pre-wrap; font-family:'SF Mono','Fira Code','Consolas',monospace; background:transparent; margin:0; border:none; }
  .err-details  { border-top:1px solid #ef444418; }
  .err-toggle   { padding:5px 12px; font-size:0.58rem; color:#ef444488; cursor:pointer; font-family:monospace; letter-spacing:0.3px; }
  .err-toggle:hover { color:#ef4444cc; }
  .err-raw      { display:block; padding:6px 12px; font-size:0.62rem; color:#ef4444aa; font-family:'SF Mono','Fira Code','Consolas',monospace; word-break:break-all; white-space:pre-wrap; }

  /* ── Speed selector ────────────────────────────────────────────────────── */
  .speed-row { display:flex; gap:2px; align-items:center; margin-left:auto; }
  .spd-btn   { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.10); border-radius:4px; color:rgba(255,255,255,0.50); font-size:0.62rem; padding:3px 7px; cursor:pointer; font-family:'Geist','Inter',system-ui,sans-serif; letter-spacing:0.2px; transition:all 0.15s; }
  .spd-btn:hover  { border-color:rgba(255,255,255,0.22); color:rgba(255,255,255,0.85); }
  .spd-btn.spd-act { border-color:color-mix(in srgb, var(--acc) 50%, transparent); color:var(--acc); background:color-mix(in srgb, var(--acc) 8%, transparent); }

  /* ── Keyboard shortcut hints ──────────────────────────────────────────── */
  .kbd-hints  { display:flex; gap:10px; justify-content:center; padding:3px 8px; flex-wrap:wrap; }
  .kbd-hints  { display:flex; gap:10px; justify-content:center; padding:3px 8px; flex-wrap:wrap; }
  .kbd-hint   { font-size:0.62rem; color:rgba(255,255,255,0.50); font-family:'Geist','Inter',system-ui,sans-serif; display:flex; align-items:center; gap:4px; }
  .kbd-hint kbd { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:2px 6px; font-size:0.58rem; color:rgba(255,255,255,0.70); font-family:'SF Mono',monospace; }

  /* ── Timeline scrubber ─────────────────────────────────────────────────── */
  .timeline { flex-shrink:0; padding:6px 0 2px; }

  .tl-track {
    position:relative;
    height:28px;
    display:flex;
    align-items:center;
    /* side padding so edge markers aren't clipped */
    margin:0 10px;
  }

  /* The base track line */
  .tl-track::before {
    content:'';
    position:absolute;
    left:0; right:0;
    height:2px;
    background:#1a1a2e;
    border-radius:1px;
  }

  /* Progress fill */
  .tl-fill {
    position:absolute;
    left:0;
    height:2px;
    background:var(--acc);
    border-radius:1px;
    opacity:0.35;
    pointer-events:none;
    transition:width 0.12s;
  }

  /* Individual step markers */
  .tl-dot {
    position:absolute;
    transform:translateX(-50%);
    width:14px;
    height:14px;
    border-radius:50%;
    background:#0d0d16;
    border:1.5px solid #252538;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
    z-index:1;
    transition:border-color 0.15s, background 0.15s, width 0.15s, height 0.15s, box-shadow 0.15s;
  }
  .tl-dot:hover:not(.tl-active) {
    border-color:#555;
    transform:translateX(-50%) scale(1.25);
    z-index:3;
  }
  .tl-dot.tl-past {
    border-color:color-mix(in srgb, var(--acc) 35%, transparent);
    background:color-mix(in srgb, var(--acc) 6%, #0d0d16);
  }
  .tl-dot.tl-active {
    width:22px;
    height:22px;
    background:var(--acc);
    border-color:var(--acc);
    z-index:4;
    box-shadow:0 0 10px color-mix(in srgb, var(--acc) 45%, transparent);
  }
  .tl-dot.tl-active:hover { transform:translateX(-50%) scale(1.1); }

  .tl-icon {
    font-size:0.45rem;
    line-height:1;
    color:#555;
    pointer-events:none;
  }
  .tl-active .tl-icon { color:#0a0a0f; font-size:0.6rem; font-weight:700; }
  .tl-past .tl-icon { color:color-mix(in srgb, var(--acc) 60%, transparent); }

  /* ── Visual panel (right) ──────────────────────────────────────────────── */
  .vis-panel { width:520px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* ── Heap memory card ──────────────────────────────────────────────────── */
  .heap-card  {
    background: color-mix(in srgb, var(--acc) 3%, var(--a11y-surface1));
    border: 1px solid color-mix(in srgb, var(--acc) 18%, rgba(255,255,255,0.05));
    border-radius:10px; overflow:hidden; flex-shrink:0;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.3);
  }
  .heap-hdr   {
    display:flex; align-items:center; gap:6px; padding:7px 10px;
    background: color-mix(in srgb, var(--acc) 5%, var(--a11y-surface2));
    border-bottom: 1px solid color-mix(in srgb, var(--acc) 12%, rgba(255,255,255,0.04));
    position: relative;
  }
  .heap-hdr::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0; height:1.5px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--acc) 50%, transparent), transparent);
  }
  .heap-title { font-size:0.55rem; color:rgba(255,255,255,0.45); font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-count { margin-left:auto; font-size:0.5rem; color:rgba(255,255,255,0.2); font-family:monospace; }
  .heap-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:6px; padding:8px; }
  .heap-box   {
    background: color-mix(in srgb, var(--acc) 4%, #08080e);
    border: 1px solid color-mix(in srgb, var(--acc) 20%, rgba(255,255,255,0.06));
    border-radius:8px; overflow:hidden; transition:border-color .3s, box-shadow .3s;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .heap-box:hover {
    border-color: color-mix(in srgb, var(--acc) 40%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 12px color-mix(in srgb, var(--acc) 10%, transparent);
  }
  .heap-addr  { background:rgba(0,0,0,0.25); padding:2px 8px; font-size:0.42rem; color:rgba(255,255,255,0.2); font-family:monospace; border-bottom:1px solid rgba(255,255,255,0.04); }
  .heap-head  { display:flex; justify-content:space-between; align-items:center; padding:6px 10px 2px; }
  .heap-name  { font-size:0.82rem; color:var(--a11y-text); font-weight:700; font-family:'SF Mono',monospace; }
  .heap-type  { font-size:0.45rem; padding:1px 5px; border-radius:3px; border:1px solid; font-family:monospace; letter-spacing:0.5px; font-weight:600; }
  .heap-val   { padding:4px 10px 8px; font-size:1.3rem; font-weight:800; font-family:'SF Mono',monospace; display:inline-block; }
  .heap-change { display:flex; align-items:center; gap:4px; padding:2px 10px 6px; }
  .heap-old   { font-size:0.55rem; color:rgba(255,255,255,0.30); font-family:monospace; text-decoration:line-through; }
  .heap-arrow { font-size:0.5rem; color:#f59e0b; }
  .heap-new   { font-size:0.55rem; font-family:monospace; font-weight:600; }

  /* ── STDOUT ────────────────────────────────────────────────────────────── */
  .out-card {
    background: color-mix(in srgb, var(--acc) 3%, #050508);
    border: 1px solid color-mix(in srgb, var(--acc) 15%, rgba(255,255,255,0.05));
    border-radius:10px; overflow:hidden; flex-shrink:0;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.3);
  }
  .out-hdr  {
    display:flex; align-items:center; gap:6px; padding:5px 10px;
    background: color-mix(in srgb, var(--acc) 5%, #0a0a12);
    border-bottom: 1px solid color-mix(in srgb, var(--acc) 10%, rgba(255,255,255,0.04));
    font-size:0.55rem; color:rgba(255,255,255,0.4); font-family:monospace; letter-spacing:1px; font-weight:700;
    position:relative;
  }
  .out-hdr::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0; height:1.5px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--acc) 50%, transparent), transparent);
  }
  .out-ln   { padding:4px 12px; font-size:0.78rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

  /* ── Complexity card ───────────────────────────────────────────────────── */
  .cx-card       {
    background: color-mix(in srgb, var(--acc) 3%, var(--a11y-surface1));
    border: 1px solid color-mix(in srgb, var(--acc) 15%, rgba(255,255,255,0.05));
    border-radius:10px; overflow:hidden; flex-shrink:0;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.3);
  }
  .cx-hdr        {
    display:flex; align-items:center; justify-content:space-between; padding:6px 10px;
    background: color-mix(in srgb, var(--acc) 5%, var(--a11y-surface2));
    border-bottom: 1px solid color-mix(in srgb, var(--acc) 12%, rgba(255,255,255,0.04));
    position:relative;
  }
  .cx-hdr::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0; height:1.5px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--acc) 50%, transparent), transparent);
  }
  .cx-title      { font-size:0.55rem; color:rgba(255,255,255,0.45); font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .cx-live-badge { font-size:0.42rem; color:#4ade80; border:1px solid #4ade8044; border-radius:3px; padding:1px 5px; font-family:monospace; letter-spacing:0.5px; }
  .cx-chart      { display:flex; align-items:flex-end; gap:4px; height:76px; padding:8px 10px 0; }
  .cx-col        { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .cx-bar        { width:100%; border-radius:3px 3px 0 0; min-height:2px; }
  .cx-lbl        { font-family:monospace; font-size:0.42rem; text-align:center; margin-top:2px; font-weight:600; }
  .cx-detail-grid { padding:8px 10px; border-top:1px solid #1a1a2e; display:flex; flex-direction:column; gap:4px; }
  .cx-row        { display:flex; justify-content:space-between; align-items:center; }
  .cx-label      { font-size:0.68rem; color:rgba(255,255,255,0.60); font-family:monospace; }
  .cx-badge      { font-size:0.65rem; font-family:monospace; font-weight:800; padding:2px 10px; border-radius:4px; }
  .cx-explain-toggle  { margin-bottom:4px; }
  .cx-explain-summary { font-size:0.6rem; color:rgba(255,255,255,0.38); cursor:pointer; font-family:monospace; letter-spacing:0.3px; padding:2px 0; user-select:none; transition:color 0.15s; }
  .cx-explain-summary:hover { color:rgba(255,255,255,0.70); }
  .cx-why        { font-size:0.68rem; color:rgba(255,255,255,0.55); line-height:1.55; margin-bottom:6px; }
  .cx-stats      { display:flex; gap:14px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-s          { display:flex; align-items:center; gap:4px; font-size:0.58rem; color:rgba(255,255,255,0.45); font-family:monospace; }

  /* ── Placeholder ───────────────────────────────────────────────────────── */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-text         { font-size:0.8rem; color:rgba(255,255,255,0.45); text-align:center; }

  /* ── Responsive: tablet ≤768px ────────────────────────────────────────── */
  @media (max-width: 768px) {
    .mod        { padding:10px 12px; gap:8px; height:auto; min-height:100vh; min-height:100dvh; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
    .hdr        { gap:10px; }
    h2          { font-size:1.1rem; }
    .sub        { font-size:0.75rem; }
    .desc       { font-size:0.58rem; }
    .ex-bar     { gap:4px; overflow-x:auto; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; padding-bottom:4px; scrollbar-width:none; }
    .ex-bar::-webkit-scrollbar { display:none; }
    .ex-btn     { font-size:0.62rem; padding:6px 12px; white-space:nowrap; flex-shrink:0; min-height:44px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; }
    .main       { flex-direction:column; overflow:visible; min-height:0; flex:none; gap:10px; }
    .code-panel { min-height:auto; flex:none; }
    .vis-panel  { width:100%; flex-shrink:initial; max-height:none; overflow:visible; }
    .code-disp  { max-height:260px; min-height:180px; }
    .ctrls      { flex-wrap:wrap; gap:4px; justify-content:center; }
    .cb         { padding:6px 12px; font-size:0.75rem; min-height:44px; min-width:44px; display:flex; align-items:center; justify-content:center; }
    .sc         { font-size:0.58rem; width:100%; text-align:center; order:10; margin:2px 0 0; }
    .speed-row  { margin-left:0; gap:3px; }
    .spd-btn    { padding:4px 8px; font-size:0.55rem; min-height:44px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; }
    .kbd-hints  { display:none; }
    .timeline   { padding:4px 0 2px; }
    .tl-track   { margin:0 6px; height:24px; }
    .tl-dot     { width:10px; height:10px; }
    .tl-dot.tl-active { width:16px; height:16px; }
    .tl-icon    { font-size:0.35rem; }
    .tl-active .tl-icon { font-size:0.5rem; }
    .heap-grid  { grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:4px; padding:6px; }
    .heap-val   { font-size:1rem; }
    .cx-chart   { height:56px; }
    .cx-why     { font-size:0.6rem; }
    .cx-stats   { flex-wrap:wrap; gap:8px; }
    .err-friendly { font-size:0.7rem; }
    .err-hint     { font-size:0.62rem; padding:6px 10px; }
    .err-raw      { font-size:0.55rem; }
  }

  /* ── Responsive: phone ≤480px ────────────────────────────────────────── */
  @media (max-width: 480px) {
    .mod        { padding:6px 8px; gap:6px; }
    .hdr        { flex-direction:column; align-items:flex-start; gap:4px; }
    h2          { font-size:0.95rem; }
    .sub        { font-size:0.68rem; }
    .ex-btn     { font-size:0.6rem; padding:5px 10px; min-height:44px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; }
    .code-disp  { max-height:200px; min-height:140px; font-size:0.75rem; line-height:1.6; }
    .ln         { width:22px; font-size:0.62rem; }
    .ac-col     { width:16px; }
    .cb         { padding:6px 10px; font-size:0.7rem; min-height:44px; min-width:44px; }
    .abtn       { min-width:48px; min-height:44px; }
    .heap-grid  { grid-template-columns:1fr 1fr; gap:4px; padding:4px; }
    .heap-name  { font-size:0.72rem; }
    .heap-val   { font-size:0.9rem; padding:3px 8px 6px; }
    .heap-addr  { font-size:0.38rem; }
    .cx-chart   { height:42px; }
    .cx-lbl     { font-size:0.38rem; }
    .cx-label   { font-size:0.6rem; }
    .cx-badge   { font-size:0.58rem; padding:2px 8px; }
    .cx-why     { font-size:0.55rem; }
    .out-ln     { font-size:0.7rem; padding:3px 8px; }
    .ph         { padding:4px 8px; }
    .pt         { font-size:0.58rem; }
    .rb         { font-size:0.62rem; padding:5px 14px; min-height:44px; }
    .eb         { font-size:0.62rem; padding:5px 10px; min-height:44px; }
    .err-head   { padding:6px 8px; gap:6px; }
    .err-icon   { width:16px; height:16px; font-size:0.58rem; }
    .err-friendly { font-size:0.65rem; }
    .err-hint   { font-size:0.58rem; padding:5px 8px; }
    .err-raw    { font-size:0.5rem; padding:4px 8px; }
    .tl-track   { margin:0 4px; height:20px; }
    .tl-dot     { width:8px; height:8px; }
    .tl-dot.tl-active { width:14px; height:14px; }
    .tl-icon    { font-size:0.3rem; }
    .tl-active .tl-icon { font-size:0.42rem; }
  }

  /* ── Responsive: very small phone ≤360px ─────────────────────────────── */
  @media (max-width: 360px) {
    .mod        { padding:4px 6px; gap:4px; }
    h2          { font-size:0.85rem; }
    .code-disp  { max-height:160px; min-height:120px; font-size:0.7rem; }
    .heap-grid  { grid-template-columns:1fr; }
    .heap-val   { font-size:0.8rem; }
    .cx-chart   { height:36px; }
    .cb         { padding:5px 8px; font-size:0.65rem; min-height:36px; min-width:36px; }
  }
</style>
