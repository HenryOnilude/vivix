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
  import { interpret, parseCode, checkSupported } from './interpreter.js';
  import { fv, tc, tb, COMPLEXITY_BARS, analyzeComplexity } from './utils.js';
  import { makeAnimateBox, makeAnimateVal, animateBar, gsapSlideIn } from './animations.js';
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
  let speed    = $state(1);   // 0.5 | 1 | 2 | 4
  /** @type {CxData|null} */
  let dynamicCx = $state(null);

  // ── Predict mode ───────────────────────────────────────────────────────────
  let predictMode    = $state(false);
  let predictPending = $state(false);
  let predictOptions = $state([]);
  let predictCorrect = $state(null);
  let predictScore   = $state({ correct: 0, total: 0 });
  let selectedOption = $state(null);

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

  // ── Phase icon for timeline markers ────────────────────────────────────────
  function phIcon(ph) {
    if (!ph) return '▶';
    if (ph === 'done')                                    return '✓';
    if (ph === 'condition' || ph === 'else-enter' || ph === 'skip') return '?';
    if (ph.startsWith('loop'))                            return '↻';
    if (ph.startsWith('fn-'))                             return 'ƒ';
    return '▶';
  }

  // ── Core execute ───────────────────────────────────────────────────────────
  function _runCode() {
    err = '';
    predictScore = { correct: 0, total: 0 };
    try {
      let rawSteps;
      if (typeof executeCode === 'function') {
        rawSteps = executeCode(codeText);
        dynamicCx = null;
      } else {
        const { ast, error: parseErr } = parseCode(codeText);
        if (parseErr) throw new Error(parseErr);

        const check = checkSupported(ast);
        if (!check.ok) throw new Error(check.message);

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
  function goNext() {
    if (!hasRun || step >= total - 1) return;
    if (!predictMode) { step++; return; }

    const nextStep = steps[step + 1];
    if (!shouldPredict(nextStep)) { step++; return; }

    selectedOption = null;
    predictOptions = generateOptions(steps[step], nextStep);
    predictPending = true;
    predictCorrect = null;
  }
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
    hasRun = false; step = -1; steps = []; err = ''; dynamicCx = null;
    if (playing) { clearInterval(timer); timer = null; playing = false; }
    predictPending = false; predictOptions = []; predictScore = { correct: 0, total: 0 };
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

  // ── Predict mode helpers ───────────────────────────────────────────────────
  function shouldPredict(nextStep) {
    const predictablePhases = [
      'declare', 'assign', 'condition', 'loop-test',
      'fn-call', 'fn-return', 'output', 'closure-create', 'closure-call'
    ];
    return predictablePhases.includes(nextStep?.phase) && !nextStep?.done;
  }

  function generateOptions(currentStep, nextStep) {
    const phase    = nextStep.phase;
    const vars     = nextStep.vars || {};
    const prevVars = currentStep.vars || {};

    let changedKey   = nextStep.highlight;
    let correctValue = changedKey ? vars[changedKey] : null;

    if (phase === 'condition' || phase === 'loop-test') {
      const result = nextStep.cond;
      return shuffle([
        { label: 'TRUE — condition passes',  value: true,  correct: result === true  },
        { label: 'FALSE — condition fails',  value: false, correct: result === false },
      ]);
    }

    if (phase === 'output') {
      const line   = nextStep.output[nextStep.output.length - 1];
      const wrong1 = line + '0';
      const wrong2 = '"' + line + '"';
      return shuffle([
        { label: String(line),   correct: true  },
        { label: wrong1,         correct: false },
        { label: wrong2,         correct: false },
        { label: 'undefined',    correct: false },
      ]);
    }

    if ((phase === 'declare' || phase === 'assign') && changedKey) {
      const correct = fv(correctValue);
      const wrongs  = generateWrongValues(correctValue, prevVars, changedKey);
      return shuffle([
        { label: `${changedKey} = ${correct}`, correct: true },
        ...wrongs.map(w => ({ label: `${changedKey} = ${w}`, correct: false }))
      ]).slice(0, 4);
    }

    if (phase === 'fn-return' || phase === 'fn-call') {
      const retVal = changedKey ? fv(vars[changedKey]) : 'undefined';
      const wrongs = changedKey
        ? generateWrongValues(vars[changedKey], prevVars, changedKey)
        : ['null', '0', 'undefined'];
      return shuffle([
        { label: retVal, correct: true },
        ...wrongs.map(w => ({ label: String(w), correct: false }))
      ]).slice(0, 4);
    }

    // Fallback — skip prediction
    return [];
  }

  function generateWrongValues(correctVal, prevVars, key) {
    const wrongs = [];
    const t = typeof correctVal;

    if (t === 'number') {
      wrongs.push(fv(correctVal + 1));
      wrongs.push(fv(correctVal - 1));
      wrongs.push(fv(correctVal * 2));
    } else if (t === 'boolean') {
      wrongs.push(fv(!correctVal));
      wrongs.push('undefined');
    } else if (t === 'string') {
      wrongs.push('"' + correctVal + correctVal + '"');
      wrongs.push('undefined');
      wrongs.push('null');
    } else {
      wrongs.push('undefined');
      wrongs.push('null');
      wrongs.push('0');
    }

    if (key in prevVars && fv(prevVars[key]) !== fv(correctVal)) {
      wrongs.push(fv(prevVars[key]));
    }

    return [...new Set(wrongs)].filter(w => w !== fv(correctVal)).slice(0, 3);
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function submitPrediction(option) {
    const isCorrect = option.correct;
    predictCorrect = isCorrect;
    predictScore.total++;
    if (isCorrect) predictScore.correct++;

    setTimeout(() => {
      predictPending = false;
      predictCorrect = null;
      predictOptions = [];
      step++;
    }, 900);
  }

  // ── Timeline helpers ───────────────────────────────────────────────────────
  /** Marker position as a percentage (handles total=1 edge case) */
  function markerPct(i) {
    return total > 1 ? (i / (total - 1)) * 100 : 0;
  }

  /** Fill width percentage up to current step */
  let fillPct = $derived(total > 1 ? (step / (total - 1)) * 100 : 0);

  /** Whether to show icons inside markers (too many = just dots) */
  let showIcons = $derived(total <= 35);

  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (timer) clearInterval(timer);
    };
  });
</script>

<div class="mod" style="--accent: {accent}">
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
    <button
      class="predict-btn"
      class:predict-active={predictMode}
      onclick={() => { predictMode = !predictMode; predictPending = false; }}
    >🎯 {predictMode ? 'Predicting' : 'Predict mode'}</button>
    {#if predictMode && predictScore.total > 0}
      <span class="predict-score">{predictScore.correct}/{predictScore.total}</span>
    {/if}
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
        <!-- Step controls row -->
        <div class="ctrls">
          <button class="cb" onclick={goFirst} disabled={step <= 0} title="First (Home)">⟪</button>
          <button class="cb" onclick={goPrev}  disabled={step <= 0} title="Back (←)">‹</button>
          <button class="cb abtn" style="color:{accent};border-color:{accent}33"
            onclick={toggleAuto} title="Play/Pause (Space)">{playing ? '⏸' : '⏵'}</button>
          <button class="cb" onclick={goNext}  disabled={step >= total - 1} title="Forward (→)">›</button>
          <button class="cb" onclick={goLast}  disabled={step >= total - 1} title="Last (End)">⟫</button>
          <span class="sc">{step + 1}/{total}</span>
          <!-- Speed selector -->
          <div class="speed-row">
            {#each [0.5, 1, 2, 4] as s}
              <button
                class="spd-btn"
                class:spd-act={speed === s}
                style="--acc:{accent}"
                onclick={() => setSpeed(s)}
                title="{s === 0.5 ? '3600' : s === 1 ? '1800' : s === 2 ? '900' : '450'}ms per step"
              >{s}x</button>
            {/each}
          </div>
        </div>

        <!-- Timeline scrubber -->
        <div class="timeline" style="--acc:{accent}">
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
                style="left:{markerPct(i)}%;--ph:{phColor(s.phase)}"
                title="Step {i + 1}: {s.phase ?? 'exec'} — {s.brain ? s.brain.slice(0, 60) : ''}"
                onclick={() => step = i}
                aria-label="Step {i + 1}: {s.phase ?? 'exec'} — {s.brain ? s.brain.slice(0, 60) : ''}"
              >{#if showIcons || isActive}<span class="tl-icon">{phIcon(s.phase)}</span>{/if}</button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- ── RIGHT: VISUAL STATE PANEL ──────────────────────────────────────── -->
    <div class="vis-panel">

      {#if predictPending && predictOptions.length > 0}
        <div class="predict-panel" use:gsapSlideIn>
          <div class="predict-hdr">
            <span class="predict-title">🎯 What happens next?</span>
            <span class="predict-hint">
              {#if sd}
                <span class="predict-phase">{sd.phase}</span> on line {(sd.lineIndex ?? 0) + 1}
              {/if}
            </span>
          </div>
          <div class="predict-options">
            {#each predictOptions as option}
              <button
                class="predict-option"
                class:option-correct={predictCorrect === true && option.correct}
                class:option-wrong={predictCorrect === false && !option.correct && option === selectedOption}
                disabled={predictCorrect !== null}
                onclick={() => { selectedOption = option; submitPrediction(option); }}
              >{option.label}</button>
            {/each}
          </div>
          {#if predictCorrect === false}
            <div class="predict-explain">
              {steps[step + 1]?.brain?.split('\n')[0] ?? 'Not quite — see the explanation below.'}
            </div>
          {/if}
        </div>
      {/if}

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

          <!-- Growth curve: shows the actual shape of each complexity class -->
          <svg class="cx-curve" viewBox="0 0 300 40" preserveAspectRatio="none">
            <!-- Axes -->
            <line x1="8" y1="34" x2="292" y2="34" stroke="#1a1a2e" stroke-width="0.5"/>
            <line x1="8" y1="4"  x2="8"   y2="34" stroke="#1a1a2e" stroke-width="0.5"/>
            <!-- O(1): flat -->
            <path d="M 8 33 L 292 33" fill="none" stroke="#4ade80"
              stroke-width={cx.time === 'O(1)' ? 2 : 0.7}
              opacity={cx.time === 'O(1)' ? 0.85 : 0.15}/>
            <!-- O(log n): slow rise -->
            <path d="M 8 33 Q 60 28 292 18" fill="none" stroke="#a3e635"
              stroke-width={cx.time === 'O(lg)' ? 2 : 0.7}
              opacity={cx.time === 'O(lg)' ? 0.85 : 0.15}/>
            <!-- O(n): linear -->
            <path d="M 8 33 L 292 5" fill="none" stroke="#facc15"
              stroke-width={cx.time === 'O(n)' ? 2 : 0.7}
              opacity={cx.time === 'O(n)' ? 0.85 : 0.15}/>
            <!-- O(n log n): slightly curved above O(n) -->
            <path d="M 8 33 C 80 32 200 14 292 4" fill="none" stroke="#fb923c"
              stroke-width={cx.time === 'O(n·lg)' ? 2 : 0.7}
              opacity={cx.time === 'O(n·lg)' ? 0.85 : 0.15}/>
            <!-- O(n²): parabola (slow start, steep finish) -->
            <path d="M 8 33 C 140 33 240 18 292 4" fill="none" stroke="#f87171"
              stroke-width={cx.time === 'O(n²)' ? 2 : 0.7}
              opacity={cx.time === 'O(n²)' ? 0.85 : 0.15}/>
            <!-- Axis labels -->
            <text x="10" y="39" fill="#1e1e30" font-size="5" font-family="monospace">n=1</text>
            <text x="290" y="39" text-anchor="end" fill="#2a2a44" font-size="5" font-family="monospace">n→∞</text>
            <text x="3" y="7" fill="#2a2a44" font-size="5" font-family="monospace">ops</text>
          </svg>

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

  /* ── Step controls ─────────────────────────────────────────────────────── */
  .ctrls  { display:flex; gap:4px; align-items:center; flex-shrink:0; }
  .cb     { background:#0a0a12; border:1px solid #1a1a2e; border-radius:4px; color:#888; font-size:0.8rem; padding:3px 10px; cursor:pointer; }
  .cb:hover:not(:disabled) { border-color:#333; color:#eee; }
  .cb:disabled { opacity:0.2; cursor:default; }
  .abtn   { /* colour set inline */ }
  .sc     { font-size:0.6rem; color:#333; margin-left:6px; font-family:monospace; }
  .err    { background:#ef444412; border:1px solid #ef444433; border-radius:4px; color:#ef4444; font-size:0.72rem; padding:5px 10px; flex-shrink:0; }

  /* ── Speed selector ────────────────────────────────────────────────────── */
  .speed-row { display:flex; gap:2px; align-items:center; margin-left:auto; }
  .spd-btn   { background:#0a0a12; border:1px solid #1a1a2e; border-radius:3px; color:#444; font-size:0.52rem; padding:2px 6px; cursor:pointer; font-family:monospace; letter-spacing:0.3px; transition:all 0.15s; }
  .spd-btn:hover  { border-color:#333; color:#aaa; }
  .spd-btn.spd-act { border-color:color-mix(in srgb, var(--acc) 50%, transparent); color:var(--acc); background:color-mix(in srgb, var(--acc) 8%, transparent); }

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
  .vis-panel { width:580px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* ── Heap memory card ──────────────────────────────────────────────────── */
  .heap-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .heap-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .heap-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-count { margin-left:auto; font-size:0.5rem; color:#333; font-family:monospace; }
  .heap-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:8px; padding:8px; }
  .heap-box   { background:#08080e; border:2px solid #1a1a2e; border-radius:8px; overflow:hidden; transition:border-color .3s; }
  .heap-box:hover { border-color:#2a2a4e; }
  .heap-addr  { background:#0d0d16; padding:2px 8px; font-size:0.42rem; color:#222; font-family:monospace; border-bottom:1px solid #1a1a2e; }
  .heap-head  { display:flex; justify-content:space-between; align-items:center; padding:6px 10px 2px; }
  .heap-name  { font-size:0.95rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .heap-type  { font-size:0.45rem; padding:1px 5px; border-radius:3px; border:1px solid; font-family:monospace; letter-spacing:0.5px; font-weight:600; }
  .heap-val   { padding:6px 12px 10px; font-size:1.6rem; font-weight:800; font-family:'SF Mono',monospace; display:inline-block; }
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
  .cx-chart      { display:flex; align-items:flex-end; gap:4px; height:90px; padding:8px 10px 0; }
  .cx-col        { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .cx-bar        { width:100%; border-radius:3px 3px 0 0; min-height:2px; }
  .cx-lbl        { font-family:monospace; font-size:0.42rem; text-align:center; margin-top:2px; font-weight:600; }
  .cx-curve      { width:100%; height:auto; display:block; padding:0 10px; opacity:0.9; }
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

  /* ── Predict mode ──────────────────────────────────────────────────────── */
  .predict-btn {
    background: #0d0d14;
    border: 1px solid #1a1a2e;
    border-radius: 4px;
    color: #666;
    font-size: 0.7rem;
    padding: 3px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
    margin-left: auto;
  }
  .predict-btn:hover { color: #aaa; border-color: #333; }
  .predict-btn.predict-active {
    border-color: var(--accent, #00ff88);
    color: var(--accent, #00ff88);
    background: color-mix(in srgb, var(--accent, #00ff88) 8%, transparent);
  }
  .predict-score {
    font-size: 0.65rem;
    color: var(--accent, #00ff88);
    font-family: monospace;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--accent, #00ff88) 10%, transparent);
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--accent, #00ff88) 25%, transparent);
  }
  .predict-panel {
    background: #0a0a12;
    border: 1px solid #1a1a2e;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .predict-hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #0d0d16;
    border-bottom: 1px solid #1a1a2e;
  }
  .predict-title {
    font-size: 0.75rem;
    color: #e0e0e0;
    font-weight: 700;
    font-family: monospace;
  }
  .predict-hint { font-size: 0.6rem; color: #444; font-family: monospace; }
  .predict-phase {
    color: #888;
    background: #ffffff08;
    padding: 1px 6px;
    border-radius: 3px;
  }
  .predict-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
  }
  .predict-option {
    background: #08080e;
    border: 1px solid #1a1a2e;
    border-radius: 6px;
    color: #ccc;
    font-size: 0.8rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    padding: 8px 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }
  .predict-option:hover:not(:disabled) {
    border-color: #333;
    color: #fff;
    background: #0d0d18;
  }
  .predict-option:disabled { cursor: default; }
  .predict-option.option-correct {
    border-color: #4ade8066;
    background: #4ade8015;
    color: #4ade80;
  }
  .predict-option.option-wrong {
    border-color: #f8717166;
    background: #f8717115;
    color: #f87171;
  }
  .predict-explain {
    padding: 8px 12px;
    font-size: 0.7rem;
    color: #888;
    border-top: 1px solid #1a1a2e;
    font-family: monospace;
    line-height: 1.5;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 800px) {
    .main       { flex-direction:column; overflow-y:auto; }
    .vis-panel  { width:100%; }
    .mod        { padding:10px; }
  }
</style>
