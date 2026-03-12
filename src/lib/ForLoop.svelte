<script>
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { interpret, parseCode } from './interpreter.js';
  import { dc, fv, tb, tc, totalBytes, byteSize, COMPLEXITY_BARS } from './utils.js';

  const examples = [
    {
      label: 'Count to 5',
      code: 'let sum = 0;\n\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}',
      complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'The loop runs n times (here n=5). Each iteration does constant work, so total time scales linearly with n.', spaceWhy: 'Only 2 variables (sum, i) regardless of how many iterations — fixed memory.' }
    },
    {
      label: 'Array search',
      code: 'let fruits = ["apple", "banana", "cherry"];\nlet found = false;\n\nfor (let i = 0; i < fruits.length; i++) {\n  if (fruits[i] === "cherry") {\n    found = true;\n  }\n}',
      complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'Worst case: checks every element in the array. If the target is last (or missing), all n elements are visited.', spaceWhy: 'Only a boolean flag and index variable — no extra arrays created.' }
    },
    {
      label: 'Accumulator',
      code: 'let total = 0;\nlet count = 0;\n\nfor (let i = 0; i < 4; i++) {\n  total = total + (i * 10);\n  count = count + 1;\n}',
      complexity: { time: 'O(n)', space: 'O(1)', timeWhy: '4 iterations, each doing 2 arithmetic operations. Time grows linearly with the loop bound.', spaceWhy: '3 variables total (total, count, i). No dynamic allocation.' }
    },
    {
      label: 'Countdown',
      code: 'let msg = "ready";\n\nfor (let i = 3; i > 0; i--) {\n  msg = i + "...";\n}\n\nmsg = "go!";',
      complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'Loop runs 3 times (decrementing). Constant work per iteration.', spaceWhy: 'One string variable overwritten each iteration — no growth.' }
    },
    {
      label: 'Nested (O(n²))',
      code: 'let grid = 0;\n\nfor (let r = 0; r < 3; r++) {\n  for (let c = 0; c < 3; c++) {\n    grid = grid + 1;\n  }\n}',
      complexity: { time: 'O(n²)', space: 'O(1)', timeWhy: 'Outer loop runs n times, inner loop runs n times for EACH outer iteration → n × n = n² total operations. This is quadratic growth.', spaceWhy: 'Only 3 variables (grid, r, c). Nested loops don\'t automatically use more memory — only more TIME.' }
    }
  ];

  let selectedExample = $state(0);
  let codeText = $state(examples[0].code);
  let currentStep = $state(-1);
  let totalSteps = $state(0);
  let executionSteps = $state([]);
  let isPlaying = $state(false);
  let autoTimer = $state(null);
  let hasRun = $state(false);
  let errorMsg = $state('');

  let codeLines = $derived(codeText.split('\n'));
  let stepData = $derived(
    currentStep >= 0 && currentStep < executionSteps.length
      ? executionSteps[currentStep]
      : null
  );
  let currentComplexity = $derived(examples[selectedExample].complexity);

  // ── AST-based interpreter using Acorn ──
  function executeCode(code) {
    const result = interpret(code, { trackLoops: true });
    if (result.error) throw new Error(result.error);

    // Map interpreter output to ForLoop's expected step field names
    return result.steps.map(s => ({
      lineIndex: s.lineIndex,
      nextLineIndex: s.nextLineIndex,
      vars: s.vars,
      output: s.output,
      highlight: s.highlight,
      phase: mapPhase(s.phase),
      brain: s.brain,
      memLabel: s.memLabel,
      memOps: s.memOps,
      comparisons: s.comps,
      loopIterations: s.loopIters || 0,
      conditionResult: s.cond !== undefined ? s.cond : (s.phase === 'loop-test' ? (s.brain && s.brain.includes('TRUE')) : undefined),
      changed: s.changed || null,
      done: s.done || false
    }));
  }

  function mapPhase(phase) {
    // Map AST interpreter phases to ForLoop's visual phases
    if (phase === 'loop-test') return 'loop-check';
    return phase;
  }

  function typeColor(val) { return tc(val); }
  function typeBadge(val) { return tb(val); }

  // GSAP actions
  function animateBox(node, p) {
    function run(s) {
      if (s === 'new') {
        gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', transformOrigin: 'bottom center' });
      } else if (s === 'changed') {
        gsap.fromTo(node, { borderColor: '#f59e0b' }, { borderColor: '#1a1a2e', duration: 1.2 });
      }
    }
    run(p.status);
    return { update(np) { run(np.status); } };
  }

  function animateVal(node, p) {
    function run(s, col) {
      if (s === 'new') {
        gsap.from(node, { scale: 0, opacity: 0, duration: 0.65, delay: 0.3, ease: 'back.out(2)' });
      } else if (s === 'changed') {
        gsap.fromTo(node, { color: '#fff', scale: 1.3 }, { color: col, scale: 1, duration: 0.8, ease: 'power2.out' });
      }
    }
    run(p.status, p.color);
    return { update(np) { run(np.status, np.color); } };
  }

  function animateBar(node, p) {
    gsap.to(node, {
      height: p.active ? p.h + '%' : (p.h * 0.3) + '%',
      opacity: p.active ? 1 : 0.2,
      duration: 0.6, ease: 'power2.out'
    });
    return { update(np) {
      gsap.to(node, {
        height: np.active ? np.h + '%' : (np.h * 0.3) + '%',
        opacity: np.active ? 1 : 0.2,
        duration: 0.6, ease: 'power2.out'
      });
    }};
  }

  // Derive variable diff status for animations
  let prevVars = $state({});
  let varDiff = $derived.by(() => {
    const diff = {};
    if (stepData && stepData.vars) {
      for (const k of Object.keys(stepData.vars)) {
        if (!(k in prevVars)) diff[k] = 'new';
        else if (JSON.stringify(prevVars[k]) !== JSON.stringify(stepData.vars[k])) diff[k] = 'changed';
        else diff[k] = 'same';
      }
    }
    return diff;
  });
  $effect(() => { if (stepData && stepData.vars) prevVars = { ...stepData.vars }; });

  // ── Controls ──
  function runCode() {
    errorMsg = '';
    try {
      executionSteps = executeCode(codeText);
      totalSteps = executionSteps.length;
      currentStep = 0;
      hasRun = true;
    } catch (e) {
      errorMsg = e.message;
    }
  }

  function goFirst() { if (hasRun) currentStep = 0; }
  function goPrev() { if (hasRun && currentStep > 0) currentStep--; }
  function goNext() { if (hasRun && currentStep < totalSteps - 1) currentStep++; }
  function goLast() { if (hasRun) currentStep = totalSteps - 1; }

  function toggleAutoPlay() {
    if (isPlaying) {
      clearInterval(autoTimer); autoTimer = null; isPlaying = false;
    } else {
      if (currentStep >= totalSteps - 1) currentStep = 0;
      isPlaying = true;
      autoTimer = setInterval(() => {
        if (currentStep < totalSteps - 1) { currentStep++; }
        else { clearInterval(autoTimer); autoTimer = null; isPlaying = false; }
      }, 1200);
    }
  }

  function loadExample(idx) {
    selectedExample = idx;
    codeText = examples[idx].code;
    hasRun = false; currentStep = -1; executionSteps = []; errorMsg = '';
    if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; }
  }

  function handleSlider(e) { currentStep = parseInt(e.target.value); }

  function editCode() {
    hasRun = false; currentStep = -1; executionSteps = []; errorMsg = '';
    if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; }
  }

  onMount(() => () => { if (autoTimer) clearInterval(autoTimer); });
</script>

<div class="module">
  <div class="top-bar">
    <a href="#/" class="back-link">← modules</a>
    <div class="title-group">
      <h2>for<span class="accent">Loop</span> <span class="subtitle">— Iteration</span></h2>
      <p class="desc">Watch the CPU execute loops iteration by iteration — see how repetition really works</p>
    </div>
  </div>

  <div class="examples-bar">
    <span class="examples-label">Examples:</span>
    {#each examples as ex, i}
      <button class="ex-btn" class:active={selectedExample === i} onclick={() => loadExample(i)}>{ex.label}</button>
    {/each}
  </div>

  <div class="main-layout">
    <!-- LEFT: Code Panel -->
    <div class="code-side">
      <div class="panel-head">
        <span class="panel-title">Source Code</span>
        <div class="panel-actions">
          {#if hasRun}
            <button class="edit-btn" onclick={editCode}>✎ Edit</button>
          {/if}
          <button class="run-btn" onclick={runCode}>▶ Visualize</button>
        </div>
      </div>

      {#if !hasRun}
        <textarea class="code-editor" bind:value={codeText} spellcheck="false"></textarea>
      {:else}
        <div class="code-display">
          {#each codeLines as line, i}
            <div class="code-line"
              class:line-executed={stepData && stepData.lineIndex === i}
              class:line-next={stepData && stepData.nextLineIndex === i}
              class:line-cond-true={stepData && stepData.lineIndex === i && stepData.conditionResult === true}
              class:line-cond-false={stepData && stepData.lineIndex === i && stepData.conditionResult === false}
            >
              <span class="ln">{i + 1}</span>
              <span class="arrow-col">
                {#if stepData && stepData.lineIndex === i}
                  <span class="arr-exec">▶</span>
                {:else if stepData && stepData.nextLineIndex === i}
                  <span class="arr-next">▸</span>
                {:else}
                  <span class="arr-none">&nbsp;</span>
                {/if}
              </span>
              <span class="line-text">{line || ' '}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if hasRun}
        <div class="legend-bar">
          <span class="leg"><span class="arr-exec">▶</span> executed</span>
          <span class="leg"><span class="arr-next">▸</span> next</span>
          {#if stepData && stepData.loopIterations > 0}
            <span class="leg iter-badge">⟳ iteration {stepData.loopIterations}</span>
          {/if}
        </div>

        <div class="controls">
          <button class="cb" onclick={goFirst} disabled={currentStep <= 0}>⟪ First</button>
          <button class="cb" onclick={goPrev} disabled={currentStep <= 0}>‹ Prev</button>
          <button class="cb" onclick={goNext} disabled={currentStep >= totalSteps - 1}>Next ›</button>
          <button class="cb" onclick={goLast} disabled={currentStep >= totalSteps - 1}>Last ⟫</button>
          <button class="cb auto-btn" onclick={toggleAutoPlay}>{isPlaying ? '⏸ Pause' : '⏵ Auto'}</button>
        </div>
        <div class="slider-row">
          <input type="range" class="slider" min="0" max={totalSteps - 1} value={currentStep} oninput={handleSlider} />
          <span class="step-count">Step {currentStep + 1} of {totalSteps}</span>
        </div>
      {/if}
    </div>

    <!-- RIGHT: Visual State Panel -->
    <div class="vis-panel">
      {#if stepData}

        <!-- ═══ CPU VISUAL DASHBOARD ═══ -->
        {#key currentStep}
          <div class="cpu-dash">
            <svg viewBox="0 0 360 130" class="cpu-svg">
              <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="#1a1a2e" stroke-width="1"/>

              <!-- Progress ring -->
              <circle cx="36" cy="40" r="22" fill="none" stroke="#1a1a2e" stroke-width="3"/>
              <circle cx="36" cy="40" r="22" fill="none" stroke={stepData.phase.startsWith('loop') ? '#ffcc66' : stepData.conditionResult === true ? '#4ade80' : stepData.conditionResult === false ? '#f87171' : stepData.done ? '#4ade80' : '#555'} stroke-width="3"
                stroke-dasharray={2 * Math.PI * 22}
                stroke-dashoffset={2 * Math.PI * 22 * (1 - (totalSteps > 1 ? currentStep / (totalSteps - 1) : 0))}
                stroke-linecap="round" transform="rotate(-90 36 40)"/>
              <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{currentStep + 1}</text>
              <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{totalSteps}</text>

              <!-- CPU chip with loop symbol -->
              <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} stroke-width="1.5"/>
              <rect x="80" y="26" width="28" height="28" rx="3" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} opacity="0.1"/>
              {#each [0,1,2] as p}
                <rect x={83 + p * 9} y="13" width="4" height="5" rx="1" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} opacity="0.4"/>
                <rect x={83 + p * 9} y="62" width="4" height="5" rx="1" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} opacity="0.4"/>
                <rect x="67" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} opacity="0.4"/>
                <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#555'} opacity="0.4"/>
              {/each}
              <text x="94" y="46" text-anchor="middle" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : stepData.phase === 'declare' ? '#4ade80' : stepData.phase === 'assign' ? '#f59e0b' : stepData.phase === 'condition' ? '#a78bfa' : stepData.done ? '#4ade80' : '#555'} font-size="16" font-weight="800" font-family="monospace">
                {stepData.phase === 'loop-init' ? '⊞' : stepData.phase === 'loop-check' ? '?' : stepData.phase === 'loop-update' ? '↻' : stepData.phase === 'loop-exit' ? '⏹' : stepData.phase === 'declare' ? '+' : stepData.phase === 'assign' ? '←' : stepData.phase === 'condition' ? '?' : stepData.phase === 'output' ? '▸' : stepData.done ? '✓' : '▷'}
              </text>

              <!-- Registers -->
              <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
              <text x="194" y="29" text-anchor="end" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#888'} font-size="10" font-weight="700" font-family="monospace">
                {stepData.lineIndex >= 0 ? 'LINE ' + (stepData.lineIndex + 1) : stepData.done ? 'END' : 'READY'}
              </text>

              <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
              <text x="194" y="55" text-anchor="end" fill={stepData.phase.startsWith('loop') ? '#ffcc66' : '#888'} font-size="8" font-weight="700" font-family="monospace">{stepData.phase.toUpperCase()}</text>

              <!-- Iteration counter -->
              <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke={stepData.loopIterations > 0 ? '#ffcc6633' : '#1a1a2e'} stroke-width="1"/>
              <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">ITER</text>
              <text x="344" y="29" text-anchor="end" fill={stepData.loopIterations > 0 ? '#ffcc66' : '#222'} font-size="12" font-weight="800" font-family="monospace">{stepData.loopIterations}</text>

              <!-- Result register -->
              <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">COND</text>
              {#if stepData.conditionResult === true}
                <circle cx="338" cy="51" r="5" fill="#4ade80"/>
                <text x="330" y="55" text-anchor="end" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">TRUE</text>
              {:else if stepData.conditionResult === false}
                <circle cx="338" cy="51" r="5" fill="#f87171"/>
                <text x="330" y="55" text-anchor="end" fill="#f87171" font-size="9" font-weight="700" font-family="monospace">FALSE</text>
              {:else}
                <text x="344" y="55" text-anchor="end" fill="#222" font-size="9" font-family="monospace">—</text>
              {/if}

              <!-- Gauges -->
              <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="133" y="69" width={Math.min(106, stepData.memOps * 10)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
              <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{stepData.memOps} WRITES</text>

              <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="247" y="69" width={Math.min(102, stepData.comparisons * 10)} height="14" rx="2" fill="#a78bfa" opacity="0.2"/>
              <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{stepData.comparisons} CHECKS</text>

              <!-- Stack -->
              <text x="10" y="78" fill="#333" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
              {#if !stepData.done}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#4ade8044" stroke-width="1"/>
                <text x="16" y="93" fill="#4ade80" font-size="7.5" font-weight="600" font-family="monospace">Global</text>
                <text x="112" y="93" text-anchor="end" fill="#333" font-size="6.5" font-family="monospace">{Object.keys(stepData.vars).length} vars</text>
              {:else}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="3 2"/>
                <text x="64" y="93" text-anchor="middle" fill="#222" font-size="7" font-family="monospace">empty</text>
              {/if}

              <text x="10" y="122" fill="#444" font-size="7.5" font-family="system-ui, sans-serif">{stepData.memLabel || ''}</text>
            </svg>
            {#if stepData.brain}
              <div class="cpu-explain">{stepData.brain}</div>
            {/if}
          </div>
        {/key}

        <!-- ═══ LOOP ITERATION VISUALIZER ═══ -->
        {#if stepData.loopIterations > 0 || stepData.phase.startsWith('loop')}
          {#key currentStep}
            <div class="loop-vis">
              <div class="loop-vis-hdr">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="#ffcc66" stroke-width="1.5"/>
                  <path d="M 9 4 L 11 7 L 9 10" fill="none" stroke="#ffcc66" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span class="loop-vis-title">LOOP PROGRESS</span>
                <span class="loop-vis-count">{stepData.loopIterations} iteration{stepData.loopIterations !== 1 ? 's' : ''}</span>
              </div>
              <svg viewBox="0 0 300 40" class="loop-track-svg">
                <!-- Track -->
                <rect x="10" y="15" width="280" height="10" rx="5" fill="#0d0d18" stroke="#1a1a2e" stroke-width="0.5"/>
                <!-- Fill based on iterations -->
                {#each Array(Math.min(stepData.loopIterations, 20)) as _, idx}
                  <rect x={10 + idx * 14} y="15" width="12" height="10" rx="3"
                    fill="#ffcc66" opacity={0.3 + (idx / Math.max(stepData.loopIterations, 1)) * 0.7}/>
                {/each}
                <!-- Labels -->
                <text x="10" y="36" fill="#333" font-size="6" font-family="monospace">1</text>
                <text x="290" y="36" text-anchor="end" fill="#ffcc66" font-size="6" font-family="monospace">{stepData.loopIterations}</text>
              </svg>
            </div>
          {/key}
        {/if}

        <!-- ═══ MEMORY HEAP ═══ -->
        {#if Object.keys(stepData.vars).length > 0}
          <div class="heap">
            <div class="heap-hdr">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#ffcc66" opacity="0.5"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#ffcc66" opacity="0.3"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#ffcc66" opacity="0.3"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#ffcc66" opacity="0.15"/>
              </svg>
              <span class="heap-label">MEMORY</span>
              <span class="heap-count">{Object.keys(stepData.vars).length} vars</span>
            </div>
            <div class="heap-grid">
              {#each Object.entries(stepData.vars) as [key, val]}
                <div class="heap-box" class:heap-flash={stepData.highlight === key} use:animateBox={{ status: varDiff[key] || 'same', step: currentStep }}>
                  <div class="heap-box-hdr">
                    <span class="heap-name">{key}</span>
                    <span class="heap-type" style="color:{typeColor(val)}">{typeBadge(val)}</span>
                  </div>
                  <div class="heap-val" style="color:{typeColor(val)}" use:animateVal={{ status: varDiff[key] || 'same', color: typeColor(val), step: currentStep }}>{fv(val)}</div>
                  {#if stepData.changed && stepData.changed.name === key}
                    <div class="heap-change">
                      <span class="heap-old">{fv(stepData.changed.from)}</span>
                      <span class="heap-arr">→</span>
                      <span class="heap-new" style="color:{typeColor(val)}">{fv(stepData.changed.to)}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- ═══ STDOUT ═══ -->
        {#if stepData.output && stepData.output.length > 0}
          <div class="out-card">
            <div class="out-hdr">
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" rx="2" fill="#111"/><text x="3" y="9" fill="#ffcc66" font-size="8" font-family="monospace">$</text></svg>
              <span>STDOUT</span>
            </div>
            {#each stepData.output as ln}
              <div class="out-ln">› {ln}</div>
            {/each}
          </div>
        {/if}

        <!-- ═══ COMPLEXITY ANALYSIS ═══ -->
        <div class="cx-card">
          <div class="cx-card-hdr">
            <span class="cx-card-title">COMPLEXITY ANALYSIS</span>
          </div>
          <div class="cx-chart">
            {#each [{ label: 'O(1)', h: 10, color: '#4ade80' }, { label: 'O(lg)', h: 25, color: '#a3e635' }, { label: 'O(n)', h: 45, color: '#facc15' }, { label: 'O(n·lg)', h: 70, color: '#fb923c' }, { label: 'O(n²)', h: 100, color: '#f87171' }] as b}
              <div class="cx-col">
                <div class="cx-bar" style="background:{b.color}" use:animateBar={{ active: currentComplexity.time === b.label, h: b.h, color: b.color, step: currentStep }}></div>
                <span class="cx-bar-lbl" style="color:{currentComplexity.time === b.label ? b.color : '#222'}">{b.label}</span>
              </div>
            {/each}
          </div>
          <div class="cx-detail">
            <div class="cx-detail-row">
              <span class="cx-detail-label">Time Complexity</span>
              <span class="cx-detail-badge cx-time-badge">{currentComplexity.time}</span>
            </div>
            <div class="cx-detail-why">{currentComplexity.timeWhy}</div>
            <div class="cx-detail-row">
              <span class="cx-detail-label">Space Complexity</span>
              <span class="cx-detail-badge cx-space-badge">{currentComplexity.space}</span>
            </div>
            <div class="cx-detail-why">{currentComplexity.spaceWhy}</div>
          </div>
          <div class="cx-live-stats">
            <span class="cx-stat"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#ffcc66"/></svg> {stepData.loopIterations} iterations</span>
            <span class="cx-stat"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg> {stepData.comparisons} checks</span>
            <span class="cx-stat"><svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg> {stepData.memOps} writes</span>
          </div>
        </div>

      {:else if !hasRun}
        <div class="vis-placeholder">
          <svg viewBox="0 0 200 140" class="ph-svg">
            <circle cx="100" cy="60" r="35" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="6 3"/>
            <path d="M 120 40 L 130 60 L 120 80" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
            <text x="100" y="65" text-anchor="middle" fill="#1a1a2e" font-size="10" font-family="monospace">i++</text>
            <text x="100" y="115" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">iteration loop</text>
          </svg>
          <p class="ph-text">Write code and click <strong>▶ Visualize</strong> to see loops execute step by step</p>
        </div>
      {/if}
    </div>
  </div>

  {#if errorMsg}
    <div class="error-bar">{errorMsg}</div>
  {/if}
</div>

<style>
  .module { width:100%; height:100%; display:flex; flex-direction:column; padding:14px 18px; gap:10px; overflow:hidden; font-family:'Inter','SF Pro',system-ui,sans-serif; }
  .top-bar { display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .back-link { font-size:0.75rem; color:#555; text-decoration:none; }
  .back-link:hover { color:#ffcc66; }
  .title-group { display:flex; flex-direction:column; }
  h2 { font-size:1.3rem; font-weight:700; color:#e0e0e0; margin:0; }
  .accent { color:#ffcc66; }
  .subtitle { font-weight:400; font-size:0.85rem; color:#555; }
  .desc { font-size:0.65rem; color:#444; margin:2px 0 0 0; }

  .examples-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .examples-label { font-size:0.65rem; color:#444; }
  .ex-btn { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#666; font-size:0.7rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all 0.2s; }
  .ex-btn:hover { border-color:#ffcc6644; color:#aaa; }
  .ex-btn.active { border-color:#ffcc6666; color:#ffcc66; background:#ffcc6610; }

  .main-layout { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }
  .code-side { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }

  .panel-head { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; font-size:0.65rem; color:#555; letter-spacing:0.5px; text-transform:uppercase; }
  .panel-title { color:#777; }
  .panel-actions { display:flex; gap:6px; }
  .run-btn { background:#ffcc66; color:#0a0a0f; border:none; border-radius:4px; padding:3px 12px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; }
  .run-btn:hover { background:#e6b84d; }
  .edit-btn { background:transparent; color:#666; border:1px solid #1a1a2e; border-radius:4px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; }
  .edit-btn:hover { color:#aaa; border-color:#333; }

  .code-editor { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; color:#e0e0e0; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; padding:10px 14px; resize:none; outline:none; tab-size:2; }
  .code-display { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:6px 0; overflow-y:auto; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; }
  .code-line { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .line-executed { background:#ffcc6618; }
  .line-next { background:#ff446612; }
  .line-cond-true { background:#00ff8825; }
  .line-cond-false { background:#ff446625; }
  .ln { width:30px; text-align:right; color:#2a2a3e; font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .arrow-col { width:20px; text-align:center; flex-shrink:0; }
  .arr-exec { color:#ffcc66; font-size:0.7rem; }
  .arr-next { color:#ff4466; font-size:0.7rem; }
  .arr-none { opacity:0; }
  .line-text { white-space:pre; color:#ccc; }

  .legend-bar { display:flex; gap:14px; padding:2px 6px; flex-shrink:0; align-items:center; }
  .leg { font-size:0.6rem; color:#444; display:flex; align-items:center; gap:4px; }
  .iter-badge { color:#ffcc66; background:#ffcc6612; padding:1px 8px; border-radius:3px; border:1px solid #ffcc6633; }

  .controls { display:flex; gap:4px; flex-shrink:0; }
  .cb { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#999; font-family:inherit; font-size:0.7rem; padding:5px 10px; cursor:pointer; transition:all 0.15s; }
  .cb:hover:not(:disabled) { border-color:#ffcc6644; color:#eee; }
  .cb:disabled { opacity:0.25; cursor:default; }
  .auto-btn { color:#ffcc66; border-color:#ffcc6633; }
  .slider-row { display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .slider { flex:1; accent-color:#ffcc66; }
  .step-count { font-size:0.7rem; color:#555; white-space:nowrap; }

  /* ═══ Visual panel ═══ */
  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* CPU dashboard */
  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }

  /* Loop iteration visualizer */
  .loop-vis { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .loop-vis-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .loop-vis-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .loop-vis-count { margin-left:auto; font-size:0.5rem; color:#ffcc66; font-family:monospace; }
  .loop-track-svg { width:100%; height:auto; display:block; }

  /* Heap memory */
  .heap { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .heap-hdr { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .heap-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-count { margin-left:auto; font-size:0.5rem; color:#333; font-family:monospace; }
  .heap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:6px; padding:8px; }
  .heap-box { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .heap-flash { border-color:#ffcc6644; background:#ffcc6608; box-shadow:inset 3px 0 0 #ffcc66; }
  .heap-box-hdr { display:flex; justify-content:space-between; align-items:center; }
  .heap-name { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .heap-type { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family:monospace; }
  .heap-val { font-size:0.85rem; font-weight:700; font-family:'SF Mono',monospace; }
  .heap-change { display:flex; align-items:center; gap:4px; margin-top:2px; }
  .heap-old { font-size:0.55rem; color:#555; font-family:monospace; text-decoration:line-through; }
  .heap-arr { font-size:0.5rem; color:#f59e0b; }
  .heap-new { font-size:0.55rem; font-family:monospace; font-weight:600; }

  /* stdout */
  .out-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .out-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .out-ln { padding:3px 10px; font-size:0.75rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

  /* Complexity */
  .cx-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .cx-card-hdr { padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .cx-card-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .cx-chart { display:flex; align-items:flex-end; gap:4px; height:60px; padding:8px 10px 0; }
  .cx-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .cx-bar { width:100%; border-radius:3px 3px 0 0; min-height:2px; transition:height 0.6s ease, opacity 0.6s ease; }
  .cx-bar-lbl { font-family:monospace; font-size:0.42rem; text-align:center; margin-top:2px; font-weight:600; }
  .cx-detail { padding:8px 10px; border-top:1px solid #1a1a2e; display:flex; flex-direction:column; gap:4px; }
  .cx-detail-row { display:flex; justify-content:space-between; align-items:center; }
  .cx-detail-label { font-size:0.68rem; color:#888; font-family:monospace; }
  .cx-detail-badge { font-size:0.65rem; font-family:monospace; font-weight:800; padding:2px 10px; border-radius:4px; }
  .cx-time-badge { color:#ffcc66; background:#ffcc6620; }
  .cx-space-badge { color:#88aaff; background:#88aaff20; }
  .cx-detail-why { font-size:0.68rem; color:#999; line-height:1.5; margin-bottom:6px; }
  .cx-live-stats { display:flex; gap:10px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-stat { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  /* Placeholder */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }
  .ph-text strong { color:#ffcc66; }

  .error-bar { background:#ff446612; border:1px solid #ff446633; border-radius:4px; color:#ff6644; font-size:0.78rem; padding:8px 12px; flex-shrink:0; }

  @media (max-width: 800px) {
    .main-layout { flex-direction:column; overflow-y:auto; }
    .vis-panel { width:100%; }
    .module { padding:10px; }
  }
</style>
