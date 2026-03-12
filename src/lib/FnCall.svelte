<script>
  import { onMount } from 'svelte';
  import { interpret } from './interpreter.js';
  import { dc, fv, tc, tb } from './utils.js';
  import { animateBar, animateFrame, animateVar } from './animations.js';

  const examples = [
    {
      label: 'Simple function',
      code: 'function double(x) {\n  let result = x * 2;\n  return result;\n}\n\nlet answer = double(21);',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One multiplication and one assignment — constant work regardless of input value.', spaceWhy: 'One local variable plus the parameter. The call stack grows by one frame then shrinks back.' }
    },
    {
      label: 'Two functions',
      code: 'function add(a, b) {\n  return a + b;\n}\n\nfunction multiply(a, b) {\n  return a * b;\n}\n\nlet sum = add(3, 4);\nlet product = multiply(5, 6);',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Each function does one arithmetic op. Two calls = 2 × O(1) = still O(1).', spaceWhy: 'Each call adds one frame with 2 params. Frames freed after return — never more than 1 extra frame at a time.' }
    },
    {
      label: 'Nested calls',
      code: 'function square(n) {\n  return n * n;\n}\n\nfunction sumOfSquares(a, b) {\n  let s1 = square(a);\n  let s2 = square(b);\n  return s1 + s2;\n}\n\nlet result = sumOfSquares(3, 4);',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'sumOfSquares calls square twice. Each does constant work. Total: O(1).', spaceWhy: 'Max stack depth = 2 frames (Global → sumOfSquares → square). Still constant.' }
    },
    {
      label: 'With condition',
      code: 'function checkAge(age) {\n  if (age >= 18) {\n    return "adult";\n  }\n  return "minor";\n}\n\nlet status = checkAge(25);',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One comparison + one return. The if-branch does not add loops — constant time.', spaceWhy: 'One parameter, no local vars. One stack frame created and destroyed.' }
    },
    {
      label: 'Greeting builder',
      code: 'function greet(name) {\n  let msg = "Hello, " + name + "!";\n  return msg;\n}\n\nlet g1 = greet("Alice");\nlet g2 = greet("Bob");',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'String concatenation with fixed-length strings is constant. Two calls = 2 × O(1).', spaceWhy: 'Each call allocates one string. After return, locals are garbage collected.' }
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
    currentStep >= 0 && currentStep < executionSteps.length ? executionSteps[currentStep] : null
  );
  let currentComplexity = $derived(examples[selectedExample].complexity);

  // ── AST-based interpreter using Acorn ──
  function executeCode(code) {
    const result = interpret(code, { trackCalls: true });
    if (result.error) throw new Error(result.error);

    return result.steps.map(s => ({
      lineIndex: s.lineIndex,
      nextLineIndex: s.nextLineIndex,
      vars: s.vars,
      output: s.output,
      highlight: s.highlight,
      phase: s.phase,
      brain: s.brain,
      memLabel: s.memLabel,
      memOps: s.memOps,
      comps: s.comps,
      calls: s.calls || 0,
      maxDepth: s.maxDepth || 1,
      stack: s.stack || ['Global'],
      frames: s.frames || { Global: dc(s.vars || {}) },
      conditionResult: s.cond !== undefined ? s.cond : undefined,
      changed: s.changed || null,
      done: s.done || false
    }));
  }

  function runCode() {
    errorMsg = '';
    try { executionSteps = executeCode(codeText); totalSteps = executionSteps.length; currentStep = 0; hasRun = true; } catch (e) { errorMsg = e.message; }
  }
  function goFirst() { if (hasRun) currentStep = 0; }
  function goPrev() { if (hasRun && currentStep > 0) currentStep--; }
  function goNext() { if (hasRun && currentStep < totalSteps - 1) currentStep++; }
  function goLast() { if (hasRun) currentStep = totalSteps - 1; }
  function toggleAutoPlay() {
    if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; }
    else { if (currentStep >= totalSteps - 1) currentStep = 0; isPlaying = true; autoTimer = setInterval(() => { if (currentStep < totalSteps - 1) currentStep++; else { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }, 1500); }
  }
  function loadExample(idx) { selectedExample = idx; codeText = examples[idx].code; hasRun = false; currentStep = -1; executionSteps = []; errorMsg = ''; if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }
  function handleSlider(e) { currentStep = parseInt(e.target.value); }
  function editCode() { hasRun = false; currentStep = -1; executionSteps = []; errorMsg = ''; if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }
  onMount(() => () => { if (autoTimer) clearInterval(autoTimer); });
</script>

<div class="module">
  <div class="top-bar">
    <a href="#/" class="back-link">← modules</a>
    <div class="title-group">
      <h2>fn<span class="accent">Call</span> <span class="subtitle">— Functions</span></h2>
      <p class="desc">Watch the call stack grow and shrink as functions execute, return, and pass values</p>
    </div>
  </div>

  <div class="examples-bar">
    <span class="examples-label">Examples:</span>
    {#each examples as ex, i}
      <button class="ex-btn" class:active={selectedExample === i} onclick={() => loadExample(i)}>{ex.label}</button>
    {/each}
  </div>

  <div class="main-layout">
    <div class="code-side">
      <div class="panel-head">
        <span class="panel-title">Source Code</span>
        <div class="panel-actions">
          {#if hasRun}<button class="edit-btn" onclick={editCode}>✎ Edit</button>{/if}
          <button class="run-btn" onclick={runCode}>▶ Visualize</button>
        </div>
      </div>
      {#if !hasRun}
        <textarea class="code-editor" bind:value={codeText} spellcheck="false"></textarea>
      {:else}
        <div class="code-display">
          {#each codeLines as line, i}
            <div class="code-line" class:line-executed={stepData && stepData.lineIndex === i} class:line-next={stepData && stepData.nextLineIndex === i} class:line-cond-true={stepData && stepData.lineIndex === i && stepData.conditionResult === true} class:line-cond-false={stepData && stepData.lineIndex === i && stepData.conditionResult === false}>
              <span class="ln">{i + 1}</span>
              <span class="arrow-col">
                {#if stepData && stepData.lineIndex === i}<span class="arr-exec">▶</span>
                {:else if stepData && stepData.nextLineIndex === i}<span class="arr-next">▸</span>
                {:else}<span class="arr-none">&nbsp;</span>{/if}
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
          {#if stepData}<span class="leg stack-badge">stack: {stepData.stack.length}</span>{/if}
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
              <circle cx="36" cy="40" r="22" fill="none" stroke={stepData.phase.startsWith('fn-') ? '#ff8866' : stepData.conditionResult === true ? '#4ade80' : stepData.conditionResult === false ? '#f87171' : stepData.done ? '#4ade80' : '#555'} stroke-width="3"
                stroke-dasharray={2 * Math.PI * 22}
                stroke-dashoffset={2 * Math.PI * 22 * (1 - (totalSteps > 1 ? currentStep / (totalSteps - 1) : 0))}
                stroke-linecap="round" transform="rotate(-90 36 40)"/>
              <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{currentStep + 1}</text>
              <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{totalSteps}</text>

              <!-- CPU chip -->
              <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} stroke-width="1.5"/>
              <rect x="80" y="26" width="28" height="28" rx="3" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} opacity="0.1"/>
              {#each [0,1,2] as p}
                <rect x={83 + p * 9} y="13" width="4" height="5" rx="1" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} opacity="0.4"/>
                <rect x={83 + p * 9} y="62" width="4" height="5" rx="1" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} opacity="0.4"/>
                <rect x="67" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} opacity="0.4"/>
                <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#555'} opacity="0.4"/>
              {/each}
              <text x="94" y="46" text-anchor="middle" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : stepData.phase === 'declare' ? '#4ade80' : stepData.phase === 'assign' ? '#f59e0b' : stepData.done ? '#4ade80' : '#555'} font-size="16" font-weight="800" font-family="monospace">
                {stepData.phase === 'fn-call' ? 'ƒ↓' : stepData.phase === 'fn-return' ? '↑R' : stepData.phase === 'fn-return-assign' ? '←R' : stepData.phase === 'fn-declare' ? 'ƒ+' : stepData.phase === 'declare' ? '+' : stepData.phase === 'assign' ? '←' : stepData.phase === 'condition' ? '?' : stepData.phase === 'output' ? '▸' : stepData.done ? '✓' : '▷'}
              </text>

              <!-- Registers -->
              <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
              <text x="194" y="29" text-anchor="end" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#888'} font-size="10" font-weight="700" font-family="monospace">
                {stepData.lineIndex >= 0 ? 'LINE ' + (stepData.lineIndex + 1) : stepData.done ? 'END' : 'READY'}
              </text>

              <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
              <text x="194" y="55" text-anchor="end" fill={stepData.phase.startsWith('fn-') ? '#ff8866' : '#888'} font-size="7" font-weight="700" font-family="monospace">{stepData.phase.toUpperCase()}</text>

              <!-- Stack depth -->
              <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e" stroke={stepData.stack.length > 1 ? '#ff886633' : '#1a1a2e'} stroke-width="1"/>
              <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">DEPTH</text>
              <text x="272" y="29" text-anchor="end" fill={stepData.stack.length > 1 ? '#ff8866' : '#222'} font-size="12" font-weight="800" font-family="monospace">{stepData.stack.length}</text>

              <!-- Calls counter -->
              <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">CALLS</text>
              <text x="344" y="29" text-anchor="end" fill={stepData.calls > 0 ? '#a78bfa' : '#222'} font-size="12" font-weight="800" font-family="monospace">{stepData.calls}</text>

              <!-- Active frame -->
              <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">FRAME</text>
              <text x="344" y="55" text-anchor="end" fill="#ff8866" font-size="10" font-weight="700" font-family="monospace">{stepData.stack[stepData.stack.length - 1]}</text>

              <!-- Gauges -->
              <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="133" y="69" width={Math.min(106, stepData.memOps * 10)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
              <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{stepData.memOps} WRITES</text>

              <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="247" y="69" width={Math.min(102, stepData.maxDepth * 25)} height="14" rx="2" fill="#ff8866" opacity="0.2"/>
              <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">MAX {stepData.maxDepth}</text>

              <!-- Stack visual -->
              <text x="10" y="78" fill="#333" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
              {#each [...stepData.stack].reverse() as frame, i}
                {#if i < 3}
                  <rect x="10" y={82 + i * 14} width="108" height="12" rx="3" fill="#0d0d18" stroke={i === 0 ? '#ff886644' : '#1a1a2e'} stroke-width="1"/>
                  <text x="16" y={91 + i * 14} fill={i === 0 ? '#ff8866' : '#4ade80'} font-size="7" font-weight="600" font-family="monospace">{frame}</text>
                  {#if i === 0}<text x="112" y={91 + i * 14} text-anchor="end" fill="#333" font-size="5" font-family="monospace">active</text>{/if}
                {/if}
              {/each}
            </svg>
            {#if stepData.brain}
              <div class="cpu-explain">{stepData.brain}</div>
            {/if}
          </div>
        {/key}

        <!-- ═══ VISUAL CALL STACK ═══ -->
        <div class="stack-card">
          <div class="stack-card-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="1" width="10" height="3" rx="1" fill="#ff8866" opacity="0.7"/>
              <rect x="2" y="5.5" width="10" height="3" rx="1" fill="#ff8866" opacity="0.4"/>
              <rect x="2" y="10" width="10" height="3" rx="1" fill="#ff8866" opacity="0.2"/>
            </svg>
            <span class="stack-card-title">CALL STACK</span>
            <span class="stack-card-depth">depth: {stepData.stack.length}</span>
          </div>
          <div class="stack-frames">
            {#each [...stepData.stack].reverse() as frame, i}
              <div class="stk-frame" class:stk-active={i === 0} class:stk-global={frame === 'Global'} use:animateFrame={{ isNew: stepData.phase === 'fn-call' && i === 0, step: currentStep }}>
                <div class="stk-frame-top">
                  <span class="stk-name">{frame}</span>
                  {#if i === 0}<span class="stk-active-badge">← active</span>{/if}
                </div>
                {#if stepData.frames[frame]}
                  <div class="stk-vars">
                    {#each Object.entries(stepData.frames[frame]) as [key, val]}
                      <div class="stk-var" class:stk-var-flash={stepData.highlight === key}>
                        <span class="stk-var-name">{key}</span>
                        <span class="stk-var-type" style="color:{tc(val)}">{tb(val)}</span>
                        <span class="stk-var-val" style="color:{tc(val)}" use:animateVar={{ flash: stepData.highlight === key, color: tc(val), step: currentStep }}>{fv(val)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- ═══ STDOUT ═══ -->
        {#if stepData.output && stepData.output.length > 0}
          <div class="out-card">
            <div class="out-hdr">
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" rx="2" fill="#111"/><text x="3" y="9" fill="#ff8866" font-size="8" font-family="monospace">$</text></svg>
              <span>STDOUT</span>
            </div>
            {#each stepData.output as ln}
              <div class="out-ln">› {ln}</div>
            {/each}
          </div>
        {/if}

        <!-- ═══ COMPLEXITY ANALYSIS ═══ -->
        <div class="cx-card">
          <div class="cx-card-hdr"><span class="cx-card-title">COMPLEXITY ANALYSIS</span></div>
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
            <span class="cx-stat"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#ff8866"/></svg> {stepData.calls} calls</span>
            <span class="cx-stat"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg> depth {stepData.maxDepth}</span>
            <span class="cx-stat"><svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg> {stepData.memOps} writes</span>
          </div>
        </div>

      {:else if !hasRun}
        <div class="vis-placeholder">
          <svg viewBox="0 0 200 140" class="ph-svg">
            <rect x="60" y="20" width="80" height="30" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
            <text x="100" y="40" text-anchor="middle" fill="#1a1a2e" font-size="9" font-family="monospace">ƒ double(x)</text>
            <line x1="100" y1="50" x2="100" y2="70" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
            <rect x="60" y="70" width="80" height="30" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
            <text x="100" y="90" text-anchor="middle" fill="#1a1a2e" font-size="9" font-family="monospace">return x * 2</text>
            <line x1="100" y1="100" x2="100" y2="120" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
            <text x="100" y="133" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">call → execute → return</text>
          </svg>
          <p class="ph-text">Write code and click <strong>▶ Visualize</strong> to see function calls in action</p>
        </div>
      {/if}
    </div>
  </div>

  {#if errorMsg}<div class="error-bar">{errorMsg}</div>{/if}
</div>

<style>
  .module { width:100%; height:100%; display:flex; flex-direction:column; padding:14px 18px; gap:10px; overflow:hidden; font-family:'Inter','SF Pro',system-ui,sans-serif; }
  .top-bar { display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .back-link { font-size:0.75rem; color:#555; text-decoration:none; }
  .back-link:hover { color:#ff8866; }
  .title-group { display:flex; flex-direction:column; }
  h2 { font-size:1.3rem; font-weight:700; color:#e0e0e0; margin:0; }
  .accent { color:#ff8866; }
  .subtitle { font-weight:400; font-size:0.85rem; color:#555; }
  .desc { font-size:0.65rem; color:#444; margin:2px 0 0 0; }
  .examples-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .examples-label { font-size:0.65rem; color:#444; }
  .ex-btn { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#666; font-size:0.7rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all 0.2s; }
  .ex-btn:hover { border-color:#ff886644; color:#aaa; }
  .ex-btn.active { border-color:#ff886666; color:#ff8866; background:#ff886610; }
  .main-layout { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }
  .code-side { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }

  .panel-head { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; font-size:0.65rem; color:#555; letter-spacing:0.5px; text-transform:uppercase; }
  .panel-title { color:#777; }
  .panel-actions { display:flex; gap:6px; }
  .run-btn { background:#ff8866; color:#0a0a0f; border:none; border-radius:4px; padding:3px 12px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; }
  .run-btn:hover { background:#e6734d; }
  .edit-btn { background:transparent; color:#666; border:1px solid #1a1a2e; border-radius:4px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; }
  .edit-btn:hover { color:#aaa; border-color:#333; }

  .code-editor { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; color:#e0e0e0; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; padding:10px 14px; resize:none; outline:none; tab-size:2; }
  .code-display { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:6px 0; overflow-y:auto; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; }
  .code-line { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .line-executed { background:#ff886618; }
  .line-next { background:#ff446612; }
  .line-cond-true { background:#00ff8825; }
  .line-cond-false { background:#ff446625; }
  .ln { width:30px; text-align:right; color:#2a2a3e; font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .arrow-col { width:20px; text-align:center; flex-shrink:0; }
  .arr-exec { color:#ff8866; font-size:0.7rem; }
  .arr-next { color:#ff4466; font-size:0.7rem; }
  .arr-none { opacity:0; }
  .line-text { white-space:pre; color:#ccc; }

  .legend-bar { display:flex; gap:14px; padding:2px 6px; flex-shrink:0; align-items:center; }
  .leg { font-size:0.6rem; color:#444; display:flex; align-items:center; gap:4px; }
  .stack-badge { color:#ff8866; background:#ff886612; padding:1px 8px; border-radius:3px; border:1px solid #ff886633; }
  .controls { display:flex; gap:4px; flex-shrink:0; }
  .cb { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#999; font-family:inherit; font-size:0.7rem; padding:5px 10px; cursor:pointer; transition:all 0.15s; }
  .cb:hover:not(:disabled) { border-color:#ff886644; color:#eee; }
  .cb:disabled { opacity:0.25; cursor:default; }
  .auto-btn { color:#ff8866; border-color:#ff886633; }
  .slider-row { display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .slider { flex:1; accent-color:#ff8866; }
  .step-count { font-size:0.7rem; color:#555; white-space:nowrap; }

  /* ═══ Visual panel ═══ */
  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }

  /* Call stack card */
  .stack-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .stack-card-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .stack-card-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .stack-card-depth { margin-left:auto; font-size:0.5rem; color:#ff8866; font-family:monospace; }
  .stack-frames { padding:6px; display:flex; flex-direction:column; gap:4px; }
  .stk-frame { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:6px 8px; transition:all 0.3s; }
  .stk-active { border-color:#ff886644; background:#ff886608; }
  .stk-global { border-color:#4ade8022; }
  .stk-frame-top { display:flex; justify-content:space-between; align-items:center; }
  .stk-name { font-size:0.78rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .stk-active-badge { font-size:0.45rem; color:#ff8866; font-family:monospace; letter-spacing:0.5px; }
  .stk-vars { display:flex; flex-direction:column; gap:2px; margin-top:4px; padding-top:4px; border-top:1px solid #1a1a2e; }
  .stk-var { display:flex; align-items:center; gap:6px; padding:2px 4px; border-radius:3px; transition:all 0.3s; }
  .stk-var-flash { background:#ff886618; box-shadow:inset 2px 0 0 #ff8866; }
  .stk-var-name { font-size:0.72rem; color:#88aaff; font-weight:600; font-family:'SF Mono',monospace; }
  .stk-var-type { font-size:0.45rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; }
  .stk-var-val { margin-left:auto; font-size:0.72rem; font-weight:600; font-family:'SF Mono',monospace; }

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
  .cx-time-badge { color:#ff8866; background:#ff886620; }
  .cx-space-badge { color:#88aaff; background:#88aaff20; }
  .cx-detail-why { font-size:0.68rem; color:#999; line-height:1.5; margin-bottom:6px; }
  .cx-live-stats { display:flex; gap:10px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-stat { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  /* Placeholder */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }
  .ph-text strong { color:#ff8866; }

  .error-bar { background:#ff446612; border:1px solid #ff446633; border-radius:4px; color:#ff6644; font-size:0.78rem; padding:8px 12px; flex-shrink:0; }
  @media (max-width: 800px) { .main-layout { flex-direction:column; overflow-y:auto; } .vis-panel { width:100%; } .module { padding:10px; } }
</style>
