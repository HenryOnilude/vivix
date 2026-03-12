<script>
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { interpret } from './interpreter.js';
  import { dc, fv, tc, tb } from './utils.js';

  const examples = [
    { label: 'Object Literal', code: `let user = { name: "Alice", age: 25 };\nconsole.log(user.name);\nconsole.log(user.age);`, complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Creating an object literal and accessing properties by key are both O(1) — constant time. The JS engine uses a hash map internally, so property lookup does not depend on the number of keys.', spaceWhy: 'O(1) — the object stores a fixed number of key-value pairs. Memory is proportional to the number of properties, which is constant here (2 keys).' } },
    { label: 'Nested Objects', code: `let config = {\n  db: { host: "localhost", port: 5432 },\n  cache: { ttl: 300 }\n};\nlet dbHost = config.db.host;\nconsole.log(dbHost);`, complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Nested property access like config.db.host is still O(1) — each dot lookup is a hash map access. Two lookups chained together is still constant time.', spaceWhy: 'O(1) — nested objects are stored as references. The outer object holds pointers to inner objects on the heap.' } },
    { label: 'Dynamic Keys', code: `let scores = {};\nscores["math"] = 95;\nscores["science"] = 87;\nscores["english"] = 91;\nconsole.log(scores["math"]);`, complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Bracket notation obj["key"] performs the same hash lookup as dot notation. Adding a new key to an object is amortized O(1).', spaceWhy: 'O(1) — each property addition allocates a small constant amount of memory for the key-value pair in the hash map.' } },
    { label: 'Object.keys/values', code: `let car = { make: "Toyota", model: "Camry", year: 2024 };\nlet keys = Object.keys(car);\nlet vals = Object.values(car);\nconsole.log(keys);\nconsole.log(vals);`, complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'Object.keys() and Object.values() iterate over ALL properties to build a new array. If the object has n keys, both operations are O(n). They must visit every key-value pair.', spaceWhy: 'O(n) — both methods create a NEW array containing n elements (the keys or values). This is additional memory proportional to the object size.' } },
    { label: 'Destructuring', code: `let point = { x: 10, y: 20, z: 30 };\nlet { x, y } = point;\nconsole.log(x);\nconsole.log(y);`, complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Destructuring { x, y } = point is syntactic sugar for x = point.x; y = point.y. Each is an O(1) hash lookup. The number of destructured keys is fixed (not dependent on object size).', spaceWhy: 'O(1) — destructuring creates individual variables on the stack, each holding a copy/reference of the extracted value.' } },
    { label: 'Spread & Merge', code: `let defaults = { theme: "dark", lang: "en" };\nlet prefs = { lang: "fr", fontSize: 14 };\nlet merged = { ...defaults, ...prefs };\nconsole.log(merged.theme);\nconsole.log(merged.lang);`, complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'The spread operator {...obj} iterates over all enumerable properties. Merging two objects with spread copies every key-value pair from both, making it O(n + m) where n and m are the sizes of each object.', spaceWhy: 'O(n+m) — a completely new object is allocated containing all keys from both source objects. The originals remain unchanged.' } }
  ];

  let selectedExample = $state(0);
  let codeText = $state(examples[0].code);
  let hasRun = $state(false);
  let currentStep = $state(-1);
  let totalSteps = $state(0);
  let executionSteps = $state([]);
  let isPlaying = $state(false);
  let autoTimer = null;
  let errorMsg = $state('');

  let codeLines = $derived(codeText.split('\n'));
  let stepData = $derived(
    hasRun && currentStep >= 0 && currentStep < executionSteps.length
      ? executionSteps[currentStep] : null
  );
  let currentComplexity = $derived(examples[selectedExample].complexity);

  // ── AST-based interpreter using Acorn ──
  function executeCode(code) {
    const result = interpret(code, { trackObjects: true });
    if (result.error) throw new Error(result.error);

    return result.steps.map(s => ({
      lineIndex: s.lineIndex,
      nextLineIndex: s.nextLineIndex,
      vars: s.vars,
      output: s.output,
      highlight: s.highlight,
      highlightKey: s.highlightKey || null,
      phase: s.phase,
      brain: s.brain,
      memLabel: s.memLabel,
      memOps: s.memOps,
      comps: s.comps,
      objOps: s.objOps || 0,
      changed: s.changed || null,
      done: s.done || false
    }));
  }

  // GSAP actions
  function animateBox(node, p) {
    function run(s) {
      if (s === 'new') gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', transformOrigin: 'bottom center' });
      else if (s === 'changed') gsap.fromTo(node, { borderColor: '#c084fc' }, { borderColor: '#1a1a2e', duration: 1.2 });
    }
    run(p.status);
    return { update(np) { run(np.status); } };
  }

  function animateVal(node, p) {
    function run(s, col) {
      if (s === 'new') gsap.from(node, { scale: 0, opacity: 0, duration: 0.65, delay: 0.3, ease: 'back.out(2)' });
      else if (s === 'changed') gsap.fromTo(node, { color: '#fff', scale: 1.3 }, { color: col, scale: 1, duration: 0.8, ease: 'power2.out' });
    }
    run(p.status, p.color);
    return { update(np) { run(np.status, np.color); } };
  }

  function animateBar(node, p) {
    gsap.to(node, { height: p.active ? p.h + '%' : (p.h * 0.3) + '%', opacity: p.active ? 1 : 0.2, duration: 0.6, ease: 'power2.out' });
    return { update(np) { gsap.to(node, { height: np.active ? np.h + '%' : (np.h * 0.3) + '%', opacity: np.active ? 1 : 0.2, duration: 0.6, ease: 'power2.out' }); }};
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
      <h2>obj<span class="accent">Explorer</span> <span class="subtitle">— Objects</span></h2>
      <p class="desc">See how key-value pairs are stored in hash maps on the heap — property access, nesting, spread, destructuring</p>
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
            <div class="code-line" class:line-executed={stepData && stepData.lineIndex === i} class:line-next={stepData && stepData.nextLineIndex === i}>
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

        <!-- CPU DASHBOARD -->
        {#key currentStep}
          <div class="cpu-dash">
            <svg viewBox="0 0 360 130" class="cpu-svg">
              <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="#1a1a2e" stroke-width="1"/>
              <circle cx="36" cy="40" r="22" fill="none" stroke="#1a1a2e" stroke-width="3"/>
              <circle cx="36" cy="40" r="22" fill="none" stroke={stepData.phase.startsWith('obj-') ? '#c084fc' : stepData.done ? '#4ade80' : '#555'} stroke-width="3"
                stroke-dasharray={2 * Math.PI * 22}
                stroke-dashoffset={2 * Math.PI * 22 * (1 - (totalSteps > 1 ? currentStep / (totalSteps - 1) : 0))}
                stroke-linecap="round" transform="rotate(-90 36 40)"/>
              <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{currentStep + 1}</text>
              <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{totalSteps}</text>

              <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} stroke-width="1.5"/>
              <rect x="80" y="26" width="28" height="28" rx="3" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} opacity="0.1"/>
              {#each [0,1,2] as p}
                <rect x={83 + p * 9} y="13" width="4" height="5" rx="1" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} opacity="0.4"/>
                <rect x={83 + p * 9} y="62" width="4" height="5" rx="1" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} opacity="0.4"/>
                <rect x="67" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} opacity="0.4"/>
                <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#555'} opacity="0.4"/>
              {/each}
              <text x="94" y="46" text-anchor="middle" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : stepData.phase === 'declare' ? '#4ade80' : stepData.done ? '#4ade80' : '#555'} font-size="14" font-weight="800" font-family="monospace">
                {stepData.phase === 'obj-create' ? '{}' : stepData.phase === 'obj-set' ? '.=' : stepData.phase === 'obj-access' ? '.→' : stepData.phase === 'obj-destruct' ? '{,}' : stepData.phase === 'obj-spread' ? '...' : stepData.phase === 'obj-method' ? 'O.k' : stepData.phase === 'declare' ? '+' : stepData.phase === 'output' ? '▸' : stepData.done ? '✓' : '▷'}
              </text>

              <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
              <text x="194" y="29" text-anchor="end" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#888'} font-size="10" font-weight="700" font-family="monospace">
                {stepData.lineIndex >= 0 ? 'LINE ' + (stepData.lineIndex + 1) : stepData.done ? 'END' : 'READY'}
              </text>

              <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
              <text x="194" y="55" text-anchor="end" fill={stepData.phase.startsWith('obj-') ? '#c084fc' : '#888'} font-size="7" font-weight="700" font-family="monospace">{stepData.phase.toUpperCase()}</text>

              <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e" stroke={stepData.objOps > 0 ? '#c084fc33' : '#1a1a2e'} stroke-width="1"/>
              <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OBJ-OPS</text>
              <text x="272" y="29" text-anchor="end" fill={stepData.objOps > 0 ? '#c084fc' : '#222'} font-size="12" font-weight="800" font-family="monospace">{stepData.objOps}</text>

              <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
              <text x="344" y="29" text-anchor="end" fill="#c084fc" font-size="9" font-weight="700" font-family="monospace">{stepData.highlight || '—'}</text>

              <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">HEAP</text>
              <text x="344" y="55" text-anchor="end" fill="#888" font-size="8" font-weight="700" font-family="monospace">{Object.entries(stepData.vars).filter(([k,v]) => typeof v === 'object' && v !== null).length} objects</text>

              <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="133" y="69" width={Math.min(106, stepData.memOps * 10)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
              <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{stepData.memOps} WRITES</text>

              <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="247" y="69" width={Math.min(102, stepData.objOps * 15)} height="14" rx="2" fill="#c084fc" opacity="0.2"/>
              <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{stepData.objOps} OBJ OPS</text>

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

        <!-- OBJECT VISUALIZATION -->
        {#each Object.entries(stepData.vars).filter(([k,v]) => typeof v === 'object' && v !== null && !Array.isArray(v)) as [objName, objVal]}
          <div class="obj-card">
            <div class="obj-card-hdr">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <text x="1" y="11" fill="#c084fc" font-size="11" font-family="monospace" font-weight="700">{'{'}</text>
                <text x="8" y="11" fill="#c084fc" font-size="11" font-family="monospace" font-weight="700" opacity="0.4">{'}'}</text>
              </svg>
              <span class="obj-card-title">{objName}</span>
              <span class="obj-card-count">{Object.keys(objVal).length} keys</span>
            </div>
            <div class="obj-props">
              {#each Object.entries(objVal) as [key, val]}
                <div class="obj-prop" class:prop-hl={stepData.highlight === objName && stepData.highlightKey === key}>
                  <span class="prop-key">"{key}"</span>
                  <span class="prop-sep">:</span>
                  {#if typeof val === 'object' && val !== null}
                    <span class="prop-val" style="color:#c084fc">{JSON.stringify(val)}</span>
                  {:else}
                    <span class="prop-val" style="color:{tc(val)}">{fv(val)}</span>
                  {/if}
                  <span class="prop-type" style="color:{tc(val)}">{tb(val)}</span>
                </div>
              {/each}
              {#if Object.keys(objVal).length === 0}
                <div class="obj-empty">{'{ }'} empty object</div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- SCALAR VARS -->
        {#if Object.entries(stepData.vars).filter(([k,v]) => typeof v !== 'object' || v === null || Array.isArray(v)).length > 0}
          <div class="heap">
            <div class="heap-hdr">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#c084fc" opacity="0.5"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#c084fc" opacity="0.3"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#c084fc" opacity="0.3"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#c084fc" opacity="0.15"/>
              </svg>
              <span class="heap-label">SCALARS & ARRAYS</span>
            </div>
            <div class="heap-grid">
              {#each Object.entries(stepData.vars).filter(([k,v]) => typeof v !== 'object' || v === null || Array.isArray(v)) as [key, val]}
                <div class="heap-box" class:heap-flash={stepData.highlight === key} use:animateBox={{ status: varDiff[key] || 'same', step: currentStep }}>
                  <div class="heap-box-hdr">
                    <span class="heap-name">{key}</span>
                    <span class="heap-type" style="color:{tc(val)}">{tb(val)}</span>
                  </div>
                  <div class="heap-val" style="color:{tc(val)}">{fv(val)}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- STDOUT -->
        {#if stepData.output && stepData.output.length > 0}
          <div class="out-card">
            <div class="out-hdr">
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" rx="2" fill="#111"/><text x="3" y="9" fill="#c084fc" font-size="8" font-family="monospace">$</text></svg>
              <span>STDOUT</span>
            </div>
            {#each stepData.output as ln}
              <div class="out-ln">› {ln}</div>
            {/each}
          </div>
        {/if}

        <!-- COMPLEXITY -->
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
            <span class="cx-stat"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#c084fc"/></svg> {stepData.objOps} obj ops</span>
            <span class="cx-stat"><svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg> {stepData.memOps} writes</span>
          </div>
        </div>

      {:else if !hasRun}
        <div class="vis-placeholder">
          <svg viewBox="0 0 200 140" class="ph-svg">
            <text x="70" y="45" fill="#1a1a2e" font-size="24" font-family="monospace" font-weight="700">{'{'}</text>
            <text x="85" y="65" fill="#1a1a2e" font-size="8" font-family="monospace">k: v</text>
            <text x="85" y="80" fill="#1a1a2e" font-size="8" font-family="monospace">k: v</text>
            <text x="110" y="95" fill="#1a1a2e" font-size="24" font-family="monospace" font-weight="700">{'}'}</text>
            <text x="100" y="125" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">key-value hash map</text>
          </svg>
          <p class="ph-text">Write code and click <strong>▶ Visualize</strong> to see objects in action</p>
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
  .back-link:hover { color:#c084fc; }
  .title-group { display:flex; flex-direction:column; }
  h2 { font-size:1.3rem; font-weight:700; color:#e0e0e0; margin:0; }
  .accent { color:#c084fc; }
  .subtitle { font-weight:400; font-size:0.85rem; color:#555; }
  .desc { font-size:0.65rem; color:#444; margin:2px 0 0 0; }
  .examples-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .examples-label { font-size:0.65rem; color:#444; }
  .ex-btn { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#666; font-size:0.7rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all 0.2s; }
  .ex-btn:hover { border-color:#c084fc44; color:#aaa; }
  .ex-btn.active { border-color:#c084fc66; color:#c084fc; background:#c084fc10; }
  .main-layout { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }
  .code-side { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .panel-head { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; font-size:0.65rem; color:#555; letter-spacing:0.5px; text-transform:uppercase; }
  .panel-title { color:#777; }
  .panel-actions { display:flex; gap:6px; }
  .run-btn { background:#c084fc; color:#0a0a0f; border:none; border-radius:4px; padding:3px 12px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; }
  .run-btn:hover { background:#a855f7; }
  .edit-btn { background:transparent; color:#666; border:1px solid #1a1a2e; border-radius:4px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; }
  .edit-btn:hover { color:#aaa; border-color:#333; }
  .code-editor { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; color:#e0e0e0; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; padding:10px 14px; resize:none; outline:none; tab-size:2; }
  .code-display { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:6px 0; overflow-y:auto; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; }
  .code-line { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .line-executed { background:#c084fc18; }
  .line-next { background:#ff446612; }
  .ln { width:30px; text-align:right; color:#2a2a3e; font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .arrow-col { width:20px; text-align:center; flex-shrink:0; }
  .arr-exec { color:#c084fc; font-size:0.7rem; }
  .arr-next { color:#ff4466; font-size:0.7rem; }
  .arr-none { opacity:0; }
  .line-text { white-space:pre; color:#ccc; }
  .legend-bar { display:flex; gap:14px; padding:2px 6px; flex-shrink:0; align-items:center; }
  .leg { font-size:0.6rem; color:#444; display:flex; align-items:center; gap:4px; }
  .controls { display:flex; gap:4px; flex-shrink:0; }
  .cb { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#999; font-family:inherit; font-size:0.7rem; padding:5px 10px; cursor:pointer; transition:all 0.15s; }
  .cb:hover:not(:disabled) { border-color:#c084fc44; color:#eee; }
  .cb:disabled { opacity:0.25; cursor:default; }
  .auto-btn { color:#c084fc; border-color:#c084fc33; }
  .slider-row { display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .slider { flex:1; accent-color:#c084fc; }
  .step-count { font-size:0.7rem; color:#555; white-space:nowrap; }

  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }
  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }

  .obj-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .obj-card-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .obj-card-title { font-size:0.65rem; color:#c084fc; font-family:'SF Mono',monospace; font-weight:700; }
  .obj-card-count { margin-left:auto; font-size:0.5rem; color:#444; font-family:monospace; }
  .obj-props { padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
  .obj-prop { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .prop-hl { border-color:#c084fc44; background:#c084fc08; box-shadow:inset 3px 0 0 #c084fc; }
  .prop-key { font-size:0.7rem; color:#e0e0e0; font-family:'SF Mono',monospace; font-weight:600; }
  .prop-sep { font-size:0.6rem; color:#333; }
  .prop-val { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; flex:1; }
  .prop-type { font-size:0.42rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; margin-left:auto; }
  .obj-empty { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  .heap { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .heap-hdr { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .heap-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:6px; padding:8px; }
  .heap-box { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .heap-flash { border-color:#c084fc44; background:#c084fc08; box-shadow:inset 3px 0 0 #c084fc; }
  .heap-box-hdr { display:flex; justify-content:space-between; align-items:center; }
  .heap-name { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .heap-type { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family:monospace; }
  .heap-val { font-size:0.85rem; font-weight:700; font-family:'SF Mono',monospace; }

  .out-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .out-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .out-ln { padding:3px 10px; font-size:0.75rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

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
  .cx-time-badge { color:#c084fc; background:#c084fc20; }
  .cx-space-badge { color:#88aaff; background:#88aaff20; }
  .cx-detail-why { font-size:0.68rem; color:#999; line-height:1.5; margin-bottom:6px; }
  .cx-live-stats { display:flex; gap:10px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-stat { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }
  .ph-text strong { color:#c084fc; }

  .error-bar { background:#ff446612; border:1px solid #ff446633; border-radius:4px; color:#ff6644; font-size:0.78rem; padding:8px 12px; flex-shrink:0; }
  @media (max-width: 800px) { .main-layout { flex-direction:column; overflow-y:auto; } .vis-panel { width:100%; } .module { padding:10px; } }
</style>
