<script>
  /**
   * ModuleShell — shared layout component for all 8 learning modules.
   *
   * Handles:
   *   • All shared $state/$derived variables
   *   • Step controls (first/prev/next/last/auto/slider)
   *   • Code panel (editor ↔ highlighted display)
   *   • CPU dashboard (via CpuDash child, with snippet hooks)
   *   • Heap memory card (opt-out via showHeap=false)
   *   • STDOUT card
   *   • Complexity analysis card (dynamic or preset)
   *   • Unsupported-syntax error messages
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
  import { interpret, parseCode, checkSupported } from './interpreter.js';
  import { fv, tc, tb, COMPLEXITY_BARS, analyzeComplexity } from './utils.js';
  import { makeAnimateBox, makeAnimateVal, animateBar } from './animations.js';
  import CodeEditor from './CodeEditor.svelte';
  import CpuDash from './CpuDash.svelte';

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
  let codeText = $state(examples[0]?.code ?? '');
  let step     = $state(-1);
  let total    = $state(0);
  let steps    = $state([]);
  let playing  = $state(false);
  let timer    = $state(null);
  let hasRun   = $state(false);
  let err      = $state('');
  /** @type {CxData|null} */
  let dynamicCx = $state(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  let lines  = $derived(codeText.split('\n'));
  let sd     = $derived(step >= 0 && step < steps.length ? steps[step] : null);
  let prev   = $derived(step > 0  && step < steps.length ? steps[step - 1] : null);

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
    const c = sd.vars || {};
    const p = prev ? (prev.vars || {}) : {};
    const r = {};
    for (const k of Object.keys(c)) {
      if (!(k in p))                                                r[k] = 'new';
      else if (JSON.stringify(p[k]) !== JSON.stringify(c[k]))       r[k] = 'changed';
      else                                                           r[k] = 'same';
    }
    return r;
  });

  let varArr = $derived(sd ? Object.entries(sd.vars || {}) : []);

  /** Badge colour for the time complexity label */
  let timeBadgeColor  = $derived(COMPLEXITY_BARS.find(b => cx.time.startsWith(b.label.slice(0, 3)))?.color ?? '#4ade80');
  /** Badge colour for the space complexity label */
  let spaceBadgeColor = $derived(COMPLEXITY_BARS.find(b => cx.space.startsWith(b.label.slice(0, 3)))?.color ?? '#4ade80');

  // ── GSAP actions (accent-coloured) ─────────────────────────────────────────
  const animateBox = makeAnimateBox(accent);
  const animateVal = makeAnimateVal();

  // ── Phase colour (covers all module phase names) ───────────────────────────
  function phColor(ph) {
    if (!ph) return '#555';
    if (ph === 'declare')                         return '#4ade80';
    if (ph === 'assign')                          return '#f59e0b';
    if (ph === 'condition' || ph === 'else-enter') return '#a78bfa';
    if (ph === 'skip')                            return '#6b7280';
    if (ph === 'output')                          return '#38bdf8';
    if (ph === 'done')                            return '#4ade80';
    if (ph.startsWith('loop'))                    return accent;
    if (ph.startsWith('fn-'))                     return accent;
    return '#555';
  }

  // ── Core execute ───────────────────────────────────────────────────────────
  function _runCode() {
    err = '';
    try {
      let rawSteps;
      if (typeof executeCode === 'function') {
        // Module supplies its own executor (e.g. AsyncAwait simulation)
        rawSteps = executeCode(codeText);
        dynamicCx = null;
      } else {
        // Standard AST-based interpreter path
        const { ast, error: parseErr } = parseCode(codeText);
        if (parseErr) throw new Error(parseErr);

        // Unsupported-syntax guard
        const check = checkSupported(ast);
        if (!check.ok) throw new Error(check.message);

        // Dynamic complexity (only when user has written custom code)
        if (isCustomCode) dynamicCx = analyzeComplexity(ast);
        else              dynamicCx = null;

        const result = interpret(codeText, interpreterOptions);
        if (result.error) throw new Error(result.error);
        rawSteps = result.steps;
      }

      const codeLines = codeText.split('\n');
      steps = rawSteps.map(s => mapStep ? mapStep(s, codeLines) : s);
      total  = steps.length;
      step   = 0;
      hasRun = true;
    } catch (e) {
      err = e.message;
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  function goFirst() { if (hasRun) step = 0; }
  function goPrev()  { if (hasRun && step > 0) step--; }
  function goNext()  { if (hasRun && step < total - 1) step++; }
  function goLast()  { if (hasRun) step = total - 1; }

  function toggleAuto() {
    if (playing) {
      clearInterval(timer); timer = null; playing = false;
    } else {
      if (step >= total - 1) step = 0;
      playing = true;
      timer = setInterval(() => {
        if (step < total - 1) step++;
        else { clearInterval(timer); timer = null; playing = false; }
      }, 1800);
    }
  }

  function loadEx(idx) {
    selEx    = idx;
    codeText = examples[idx].code;
    _reset();
  }

  function editCode() { _reset(); }

  function _reset() {
    hasRun = false; step = -1; steps = []; err = ''; dynamicCx = null;
    if (playing) { clearInterval(timer); timer = null; playing = false; }
  }

  onMount(() => () => { if (timer) clearInterval(timer); });
</script>

<div class="mod">
  <!-- Header -->
  <header class="hdr">
    <a href="#/" class="back">← modules</a>
    <div class="title-group">
      <h2>{titlePrefix}<span class="ac" style="color:{accent}">{titleAccent}</span>
        <span class="sub">{subtitle}</span></h2>
      {#if desc}<p class="desc">{desc}</p>{/if}
    </div>
  </header>

  <!-- Example picker -->
  <div class="ex-bar">
    <span class="ex-lbl">Examples:</span>
    {#each examples as ex, i}
      <button
        class="ex-btn"
        class:act={selEx === i}
        style="--acc:{accent}"
        onclick={() => loadEx(i)}
      >{ex.label}</button>
    {/each}
  </div>

  <!-- Main split layout -->
  <div class="main">

    <!-- ── LEFT: CODE PANEL ────────────────────────────────────────────────── -->
    <div class="code-panel">
      <div class="ph">
        <span class="pt">Source Code</span>
        <div class="pa">
          {#if hasRun}
            <button class="eb" onclick={editCode}>✎ Edit</button>
          {/if}
          <button class="rb" style="background:{accent};color:#0a0a0f" onclick={_runCode}>
            ▶ Visualize
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

      {#if err}<div class="err">{err}</div>{/if}

      {#if hasRun}
        <div class="ctrls">
          <button class="cb" onclick={goFirst} disabled={step <= 0}>⟪</button>
          <button class="cb" onclick={goPrev}  disabled={step <= 0}>‹</button>
          <button class="cb abtn" style="color:{accent};border-color:{accent}33" onclick={toggleAuto}>{playing ? '⏸' : '⏵'}</button>
          <button class="cb" onclick={goNext}  disabled={step >= total - 1}>›</button>
          <button class="cb" onclick={goLast}  disabled={step >= total - 1}>⟫</button>
          <span class="sc">{step + 1}/{total}</span>
        </div>
        <input type="range" class="slider" min="0" max={total - 1} bind:value={step}
          style="accent-color:{accent}" />
      {/if}
    </div>

    <!-- ── RIGHT: VISUAL STATE PANEL ──────────────────────────────────────── -->
    <div class="vis-panel">
      {#if sd}

        <!-- CPU dashboard -->
        {#key step}
          <CpuDash
            {sd} {step} {total} {accent} {phColor}
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
            <div class="heap-hdr">
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
            <div class="out-hdr">
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
              <div class="cx-label">Time Complexity</div>
              <div class="cx-badge" style="color:{timeBadgeColor};background:{timeBadgeColor}20">{cx.time}</div>
            </div>
            <div class="cx-why">{cx.timeWhy}</div>
            <div class="cx-row">
              <div class="cx-label">Space Complexity</div>
              <div class="cx-badge" style="color:{spaceBadgeColor};background:{spaceBadgeColor}20">{cx.space}</div>
            </div>
            <div class="cx-why">{cx.spaceWhy}</div>
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
  .mod { width:100%; height:100%; display:flex; flex-direction:column; padding:14px 18px; gap:10px; overflow:hidden; font-family:'Inter','SF Pro',system-ui,sans-serif; }
  .hdr { display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .back { font-size:0.75rem; color:#555; text-decoration:none; }
  .back:hover { color:#aaa; }
  .title-group { display:flex; flex-direction:column; }
  h2  { font-size:1.3rem; font-weight:700; color:#e0e0e0; margin:0; }
  .ac  { /* colour set inline */ }
  .sub { font-weight:400; font-size:0.85rem; color:#555; }
  .desc { font-size:0.65rem; color:#444; margin:2px 0 0; }

  /* ── Example picker ────────────────────────────────────────────────────── */
  .ex-bar  { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .ex-lbl  { font-size:0.65rem; color:#444; }
  .ex-btn  { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#666; font-size:0.7rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all 0.2s; }
  .ex-btn:hover { border-color:color-mix(in srgb, var(--acc) 27%, transparent); color:#aaa; }
  .ex-btn.act   { border-color:color-mix(in srgb, var(--acc) 40%, transparent); color:var(--acc); background:color-mix(in srgb, var(--acc) 6%, transparent); }

  /* ── Split main area ───────────────────────────────────────────────────── */
  .main { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }

  /* ── Code panel (left) ─────────────────────────────────────────────────── */
  .code-panel { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ph  { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; }
  .pt  { font-size:0.65rem; color:#555; letter-spacing:0.5px; text-transform:uppercase; }
  .pa  { display:flex; gap:6px; }
  .rb  { border:none; border-radius:4px; padding:3px 12px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; }
  .rb:hover { filter:brightness(0.88); }
  .eb  { background:transparent; color:#666; border:1px solid #1a1a2e; border-radius:4px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; }
  .eb:hover { color:#aaa; border-color:#333; }

  .code-disp { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:6px 0; overflow-y:auto; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; }
  .cl       { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .cl-exec  { background:color-mix(in srgb, var(--acc) 9%, transparent); }
  .cl-next  { background:#f59e0b0c; }
  .cl-true  { background:#4ade8014; }
  .cl-false { background:#f8717114; }
  .ln      { width:30px; text-align:right; color:#2a2a3e; font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .ac-col  { width:20px; text-align:center; flex-shrink:0; }
  .ae      { font-size:0.7rem; }
  .an      { color:#f59e0b; font-size:0.7rem; }
  .ax      { opacity:0; }
  .lt      { white-space:pre; color:#ccc; }

  .ctrls  { display:flex; gap:4px; flex-shrink:0; }
  .cb     { background:#0a0a12; border:1px solid #1a1a2e; border-radius:4px; color:#888; font-size:0.8rem; padding:3px 10px; cursor:pointer; }
  .cb:hover:not(:disabled) { border-color:#333; color:#eee; }
  .cb:disabled { opacity:0.2; cursor:default; }
  .abtn   { /* colour set inline */ }
  .sc     { font-size:0.6rem; color:#333; margin-left:6px; font-family:monospace; }
  .slider { width:100%; margin-top:2px; }
  .err    { background:#ef444412; border:1px solid #ef444433; border-radius:4px; color:#ef4444; font-size:0.72rem; padding:5px 10px; flex-shrink:0; }

  /* ── Visual panel (right) ──────────────────────────────────────────────── */
  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* ── Heap memory card ──────────────────────────────────────────────────── */
  .heap-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .heap-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .heap-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-count { margin-left:auto; font-size:0.5rem; color:#333; font-family:monospace; }
  .heap-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:6px; padding:8px; }
  .heap-box   { background:#08080e; border:2px solid #1a1a2e; border-radius:8px; overflow:hidden; transition:border-color .3s; }
  .heap-box:hover { border-color:#2a2a4e; }
  .heap-addr  { background:#0d0d16; padding:2px 8px; font-size:0.42rem; color:#222; font-family:monospace; border-bottom:1px solid #1a1a2e; }
  .heap-head  { display:flex; justify-content:space-between; align-items:center; padding:6px 10px 2px; }
  .heap-name  { font-size:0.82rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .heap-type  { font-size:0.45rem; padding:1px 5px; border-radius:3px; border:1px solid; font-family:monospace; letter-spacing:0.5px; font-weight:600; }
  .heap-val   { padding:4px 10px 8px; font-size:1.1rem; font-weight:800; font-family:'SF Mono',monospace; display:inline-block; }
  .heap-change { display:flex; align-items:center; gap:4px; padding:2px 10px 6px; }
  .heap-old   { font-size:0.55rem; color:#555; font-family:monospace; text-decoration:line-through; }
  .heap-arrow { font-size:0.5rem; color:#f59e0b; }
  .heap-new   { font-size:0.55rem; font-family:monospace; font-weight:600; }

  /* ── STDOUT ────────────────────────────────────────────────────────────── */
  .out-card { background:#050508; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .out-hdr  { display:flex; align-items:center; gap:6px; padding:4px 10px; background:#0a0a12; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#444; font-family:monospace; letter-spacing:1px; font-weight:700; }
  .out-ln   { padding:4px 12px; font-size:0.78rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

  /* ── Complexity card ───────────────────────────────────────────────────── */
  .cx-card       { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .cx-hdr        { display:flex; align-items:center; justify-content:space-between; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .cx-title      { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .cx-live-badge { font-size:0.42rem; color:#4ade80; border:1px solid #4ade8044; border-radius:3px; padding:1px 5px; font-family:monospace; letter-spacing:0.5px; }
  .cx-chart      { display:flex; align-items:flex-end; gap:4px; height:60px; padding:8px 10px 0; }
  .cx-col        { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .cx-bar        { width:100%; border-radius:3px 3px 0 0; min-height:2px; }
  .cx-lbl        { font-family:monospace; font-size:0.42rem; text-align:center; margin-top:2px; font-weight:600; }
  .cx-detail-grid { padding:8px 10px; border-top:1px solid #1a1a2e; display:flex; flex-direction:column; gap:4px; }
  .cx-row        { display:flex; justify-content:space-between; align-items:center; }
  .cx-label      { font-size:0.68rem; color:#888; font-family:monospace; }
  .cx-badge      { font-size:0.65rem; font-family:monospace; font-weight:800; padding:2px 10px; border-radius:4px; }
  .cx-why        { font-size:0.68rem; color:#999; line-height:1.5; margin-bottom:6px; }
  .cx-stats      { display:flex; gap:14px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-s          { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  /* ── Placeholder ───────────────────────────────────────────────────────── */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-text         { font-size:0.75rem; color:#333; text-align:center; }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 800px) {
    .main       { flex-direction:column; overflow-y:auto; }
    .vis-panel  { width:100%; }
    .mod        { padding:10px; }
  }
</style>
