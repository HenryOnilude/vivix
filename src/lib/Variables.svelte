<script>
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { interpret } from './interpreter.js';
  import { dc, fv, tc, tb, totalBytes, byteSize, COMPLEXITY_BARS } from './utils.js';
  import { animateBar } from './animations.js';

  const ACCENT = '#38bdf8';
  const examples = [
    { label: 'Numbers', code: 'let age = 25;\nlet price = 9.99;\nlet year = 2024;', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) means "constant time" — each let statement is a single operation. The CPU reads the value, allocates a memory slot, and writes to it. 3 declarations = 3 operations, but that\'s still constant — it doesn\'t grow with any input. Whether you declare 1 variable or 10, there are no loops or recursion.', spaceWhy: 'O(1) — 3 numbers, each stored as a 64-bit IEEE 754 double (8 bytes). Total: 24 bytes of fixed memory. No arrays, no objects, no dynamic allocation. The memory footprint is known before the program even runs.' } },
    { label: 'Strings', code: 'let name = "Alice";\nlet greeting = "Hello, " + name + "!";\nlet empty = "";', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — string concatenation with fixed-length strings is constant time. "Hello, " + "Alice" + "!" produces a new string in one step. If the strings were variable-length (like user input of length n), concatenation would be O(n) because every character must be copied. But with literals, it\'s constant.', spaceWhy: 'O(1) — 3 string variables. In JavaScript, strings are immutable and stored on the heap. "Alice" = 10 bytes (2 bytes per char in UTF-16), "Hello, Alice!" = 26 bytes. Fixed and predictable.' } },
    { label: 'Booleans', code: 'let isLoggedIn = true;\nlet hasPermission = false;\nlet isActive = true;', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — boolean assignment is the simplest possible operation. The CPU stores a single bit of information (true/false), though JavaScript engines typically use 4 bytes for alignment. Three assignments = three constant-time operations.', spaceWhy: 'O(1) — 3 booleans. In theory 3 bits, in practice ~12 bytes due to memory alignment and V8 object headers. No dynamic allocation.' } },
    { label: 'Reassignment', code: 'let score = 0;\nscore = 10;\nscore = score + 5;\nscore = score * 2;', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — 1 declaration + 3 reassignments = 4 constant-time operations. Each reassignment overwrites the previous value in the same memory slot. The arithmetic (+ 5, * 2) are single CPU instructions. No loops, no growth.', spaceWhy: 'O(1) — only 1 variable (score) exists throughout. Reassignment reuses the same memory — it does NOT create a new variable. Old values are simply overwritten and lost.' } },
    { label: 'Type mixing', code: 'let x = 42;\nlet y = "hello";\nlet z = true;\nlet w = null;\nlet v = undefined;', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — 5 declarations, each constant time. JavaScript is dynamically typed, so the engine tags each value with its type at runtime. This type-tagging adds a tiny overhead per variable but is still O(1) — it doesn\'t scale with input.', spaceWhy: 'O(1) — 5 variables of different types. number: 8 bytes, string: 10+ bytes, boolean: 4 bytes, null: 8 bytes (tagged pointer), undefined: 8 bytes. Total ~38 bytes, fixed.' } },
    { label: 'const vs let', code: 'const PI = 3.14159;\nconst APP_NAME = "VisualJS";\nlet counter = 0;\ncounter = counter + 1;\ncounter = counter + 1;', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — const and let both take the same time to declare. The difference is semantic: const prevents reassignment (caught at parse time), let allows it. Neither affects runtime complexity. 2 consts + 1 let + 2 reassignments = 5 ops, constant.', spaceWhy: 'O(1) — const does NOT use less memory than let. Both allocate the same space. The "const" keyword is a compile-time constraint, not a memory optimization. 3 variables = fixed space.' } }
  ];

  let selEx = $state(0);
  let codeText = $state(examples[0].code);
  let step = $state(-1);
  let total = $state(0);
  let steps = $state([]);
  let playing = $state(false);
  let timer = $state(null);
  let hasRun = $state(false);
  let err = $state('');

  let lines = $derived(codeText.split('\n'));
  let sd = $derived(step >= 0 && step < steps.length ? steps[step] : null);
  let prev = $derived(step > 0 && step < steps.length ? steps[step - 1] : null);
  let cx = $derived(examples[selEx].cx);

  let varDiff = $derived.by(() => {
    if (!sd) return {};
    const c = sd.vars || {}, p = prev ? (prev.vars || {}) : {}, r = {};
    for (const k of Object.keys(c)) {
      if (!(k in p)) r[k] = 'new';
      else if (JSON.stringify(p[k]) !== JSON.stringify(c[k])) r[k] = 'changed';
      else r[k] = 'same';
    }
    return r;
  });

  let varArr = $derived(sd ? Object.entries(sd.vars || {}) : []);

  // GSAP actions
  function animateBox(node, p) {
    function run(s) {
      if (s === 'new') {
        gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', transformOrigin: 'bottom center' });
      } else if (s === 'changed') {
        gsap.timeline()
          .to(node, { boxShadow: '0 0 20px rgba(56,189,248,0.6)', scale: 1.05, duration: 0.25 })
          .to(node, { boxShadow: '0 0 0px transparent', scale: 1, duration: 0.8, ease: 'elastic.out(1,0.4)' });
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
        gsap.fromTo(node,
          { color: '#fff', textShadow: '0 0 20px #38bdf880', scale: 1.2 },
          { color: col, textShadow: '0 0 0px transparent', scale: 1, duration: 1.0, ease: 'power2.out' }
        );
      }
    }
    run(p.status, p.color);
    return { update(np) { run(np.status, np.color); } };
  }

  const bars = [
    { label: 'O(1)', h: 10, color: '#4ade80' },
    { label: 'O(lg)', h: 25, color: '#a3e635' },
    { label: 'O(n)', h: 45, color: '#facc15' },
    { label: 'O(n·lg)', h: 70, color: '#fb923c' },
    { label: 'O(n²)', h: 100, color: '#f87171' },
  ];

  // ── AST-based interpreter using Acorn ──
  function execute(code) {
    const result = interpret(code, {});
    if (result.error) throw new Error(result.error);

    // Map to Variables' short field names
    return result.steps.map(s => {
      const bytes = totalBytes(s.vars || {});
      const hlVal = s.highlight && s.vars ? s.vars[s.highlight] : null;
      const newB = hlVal !== null && hlVal !== undefined ? byteSize(hlVal) : 0;
      return {
        li: s.lineIndex, nli: s.nextLineIndex,
        vars: s.vars, out: s.output,
        hl: s.highlight, ph: s.phase,
        hint: s.memLabel || '',
        brain: s.brain,
        mo: s.memOps, bytes, newBytes: s.phase === 'assign' ? 0 : newB,
        changed: s.changed || null,
        done: s.done || false
      };
    });
  }

  function phColor(ph) { if (ph === 'declare') return '#4ade80'; if (ph === 'assign') return '#f59e0b'; if (ph === 'output') return '#38bdf8'; if (ph === 'done') return '#4ade80'; return '#555'; }

  function runCode() { err = ''; try { steps = execute(codeText); total = steps.length; step = 0; hasRun = true; } catch(e) { err = e.message; } }
  function goFirst() { if (hasRun) step = 0; }
  function goPrev() { if (hasRun && step > 0) step--; }
  function goNext() { if (hasRun && step < total - 1) step++; }
  function goLast() { if (hasRun) step = total - 1; }
  function toggleAuto() {
    if (playing) { clearInterval(timer); timer = null; playing = false; }
    else { if (step >= total - 1) step = 0; playing = true; timer = setInterval(() => { if (step < total - 1) step++; else { clearInterval(timer); timer = null; playing = false; } }, 2200); }
  }
  function loadEx(idx) { selEx = idx; codeText = examples[idx].code; hasRun = false; step = -1; steps = []; err = ''; if (playing) { clearInterval(timer); timer = null; playing = false; } }
  function editCode() { hasRun = false; step = -1; steps = []; err = ''; if (playing) { clearInterval(timer); timer = null; playing = false; } }
  onMount(() => () => { if (timer) clearInterval(timer); });
</script>

<div class="mod">
  <header class="hdr">
    <a href="#/" class="back">← modules</a>
    <h2>var<span class="ac">Store</span> <span class="sub">— Variables & Memory</span></h2>
  </header>

  <div class="ex-bar">
    <span class="ex-lbl">Examples:</span>
    {#each examples as ex, i}
      <button class="ex-btn" class:act={selEx === i} onclick={() => loadEx(i)}>{ex.label}</button>
    {/each}
  </div>

  <div class="main">
    <!-- LEFT: CODE PANEL -->
    <div class="code-panel">
      <div class="ph">
        <span class="pt">Source Code</span>
        <div class="pa">
          {#if hasRun}<button class="eb" onclick={editCode}>✎ Edit</button>{/if}
          <button class="rb" onclick={runCode}>▶ Visualize</button>
        </div>
      </div>

      {#if !hasRun}
        <textarea class="editor" bind:value={codeText} spellcheck="false"></textarea>
      {:else}
        <div class="code-disp">
          {#each lines as line, i}
            <div class="cl"
              class:cl-exec={sd && sd.li === i}
              class:cl-next={sd && sd.nli === i}
            >
              <span class="ln">{i+1}</span>
              <span class="ac-col">
                {#if sd && sd.li === i}<span class="ae">▶</span>
                {:else if sd && sd.nli === i}<span class="an">▸</span>
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
          <button class="cb" onclick={goPrev} disabled={step <= 0}>‹</button>
          <button class="cb abtn" onclick={toggleAuto}>{playing ? '⏸' : '⏵'}</button>
          <button class="cb" onclick={goNext} disabled={step >= total - 1}>›</button>
          <button class="cb" onclick={goLast} disabled={step >= total - 1}>⟫</button>
          <span class="sc">{step+1}/{total}</span>
        </div>
        <input type="range" class="slider" min="0" max={total-1} value={step} oninput={e => step = +e.target.value} />
      {/if}
    </div>

    <!-- RIGHT: VISUAL STATE PANEL -->
    <div class="vis-panel">
      {#if sd}

        <!-- ═══ CPU VISUAL DASHBOARD ═══ -->
        {#key step}
          <div class="cpu-dash">
            <svg viewBox="0 0 360 130" class="cpu-svg">
              <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="#1a1a2e" stroke-width="1"/>

              <!-- Progress ring -->
              <circle cx="36" cy="40" r="22" fill="none" stroke="#1a1a2e" stroke-width="3"/>
              <circle cx="36" cy="40" r="22" fill="none" stroke={phColor(sd.ph)} stroke-width="3"
                stroke-dasharray={2 * Math.PI * 22}
                stroke-dashoffset={2 * Math.PI * 22 * (1 - (total > 1 ? step / (total - 1) : 0))}
                stroke-linecap="round" transform="rotate(-90 36 40)"/>
              <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{step + 1}</text>
              <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{total}</text>

              <!-- CPU chip -->
              <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={phColor(sd.ph)} stroke-width="1.5"/>
              <rect x="80" y="26" width="28" height="28" rx="3" fill={phColor(sd.ph)} opacity="0.1"/>
              {#each [0,1,2] as p}
                <rect x={83 + p * 9} y="13" width="4" height="5" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x={83 + p * 9} y="62" width="4" height="5" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x="67" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
              {/each}
              <text x="94" y="46" text-anchor="middle" fill={phColor(sd.ph)} font-size="16" font-weight="800" font-family="monospace">
                {sd.ph === 'declare' ? '+' : sd.ph === 'assign' ? '←' : sd.ph === 'output' ? '▸' : sd.ph === 'done' ? '✓' : '▷'}
              </text>

              <!-- Register boxes -->
              <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
              <text x="194" y="29" text-anchor="end" fill={phColor(sd.ph)} font-size="10" font-weight="700" font-family="monospace">
                {sd.li >= 0 ? 'LINE ' + (sd.li + 1) : sd.ph === 'start' ? 'READY' : 'END'}
              </text>

              <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
              <text x="194" y="55" text-anchor="end" fill={phColor(sd.ph)} font-size="9" font-weight="700" font-family="monospace">{sd.ph.toUpperCase()}</text>

              <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
              <text x="344" y="29" text-anchor="end" fill={sd.hl ? '#fbbf24' : '#222'} font-size="10" font-weight="700" font-family="monospace">{sd.hl || '—'}</text>

              <!-- Bytes gauge -->
              <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">HEAP</text>
              <text x="344" y="55" text-anchor="end" fill="#38bdf8" font-size="9" font-weight="700" font-family="monospace">~{sd.bytes}B</text>

              <!-- Memory writes gauge -->
              <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="133" y="69" width={Math.min(106, sd.mo * 18)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
              <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.mo} WRITES</text>

              <!-- New bytes indicator -->
              <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="247" y="69" width={Math.min(102, (sd.newBytes || 0) * 4)} height="14" rx="2" fill="#38bdf8" opacity="0.2"/>
              <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.newBytes || 0}B NEW</text>

              <!-- Stack -->
              <text x="10" y="78" fill="#333" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
              {#if !sd.done}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#4ade8044" stroke-width="1"/>
                <text x="16" y="93" fill="#4ade80" font-size="7.5" font-weight="600" font-family="monospace">Global</text>
                <text x="112" y="93" text-anchor="end" fill="#333" font-size="6.5" font-family="monospace">{Object.keys(sd.vars || {}).length} vars</text>
              {:else}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="3 2"/>
                <text x="64" y="93" text-anchor="middle" fill="#222" font-size="7" font-family="monospace">empty</text>
              {/if}

              <text x="10" y="122" fill="#444" font-size="8" font-family="system-ui, sans-serif">{sd.hint}</text>
            </svg>
            {#if sd.brain}
              <div class="cpu-explain">{sd.brain}</div>
            {/if}
          </div>
        {/key}

        <!-- ═══ MEMORY VISUALIZATION ═══ -->
        {#if varArr.length > 0}
          <div class="mem-card">
            <div class="mem-hdr">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#38bdf8" opacity="0.5"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#38bdf8" opacity="0.3"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#38bdf8" opacity="0.3"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#38bdf8" opacity="0.15"/>
              </svg>
              <span class="mem-title">MEMORY — HEAP</span>
              <span class="mem-count">{varArr.length} slot{varArr.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="mem-grid">
              {#each varArr as [name, val]}
                {@const status = varDiff[name] || 'same'}
                {@const color = tc(val)}
                <div class="mem-box" use:animateBox={{ status, step }}>
                  <div class="mem-addr">
                    <span class="mem-addr-hex">0x{(name.charCodeAt(0) * 256 + (name.charCodeAt(1) || 0)).toString(16).padStart(4, '0')}</span>
                    <span class="mem-type-badge" style="background:{color}22;color:{color}">{tb(val)}</span>
                  </div>
                  <div class="mem-name">{name}</div>
                  <div class="mem-val" style="color:{color}" use:animateVal={{ status, color, step }}>
                    {fv(val)}
                  </div>
                  {#if sd.changed && sd.changed.name === name}
                    <div class="mem-change">
                      <span class="mem-old">{fv(sd.changed.from)}</span>
                      <span class="mem-arrow">→</span>
                      <span class="mem-new" style="color:{color}">{fv(sd.changed.to)}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- ═══ MEMORY MAP (byte visualization) ═══ -->
        {#if varArr.length > 0}
          {#key step}
            <div class="bytemap-card">
              <div class="bytemap-hdr">
                <span class="bytemap-title">BYTE MAP</span>
                <span class="bytemap-total">~{sd.bytes}B total</span>
              </div>
              <svg viewBox="0 0 300 {Math.max(30, varArr.length * 24 + 10)}" class="bytemap-svg">
                {#each varArr as [name, val], idx}
                  {@const tp = typeof val}
                  {@const bytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? (String(val).length * 2) + 16 : 8}
                  {@const maxBytes = 40}
                  {@const barW = Math.min(250, (bytes / maxBytes) * 250)}
                  {@const color = tc(val)}
                  <rect x="40" y={idx * 24 + 4} width={barW} height="16" rx="3" fill={color} opacity="0.2"/>
                  <rect x="40" y={idx * 24 + 4} width={barW} height="16" rx="3" fill="none" stroke={color} stroke-width="0.5" opacity="0.4"/>
                  <text x="36" y={idx * 24 + 15} text-anchor="end" fill="#555" font-size="7.5" font-family="monospace">{name}</text>
                  <text x={44 + barW} y={idx * 24 + 15} fill="#444" font-size="6.5" font-family="monospace">{bytes}B</text>
                {/each}
              </svg>
            </div>
          {/key}
        {/if}

        <!-- ═══ STDOUT ═══ -->
        {#if sd.out && sd.out.length > 0}
          <div class="out-card">
            <div class="out-hdr">
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" rx="2" fill="#111"/><text x="3" y="9" fill="#38bdf8" font-size="8" font-family="monospace">$</text></svg>
              <span>STDOUT</span>
            </div>
            {#each sd.out as line}
              <div class="out-ln">› {line}</div>
            {/each}
          </div>
        {/if}

        <!-- ═══ COMPLEXITY ANALYSIS ═══ -->
        <div class="cx-card">
          <div class="cx-hdr">
            <span class="cx-title">COMPLEXITY ANALYSIS</span>
          </div>
          <div class="cx-chart">
            {#each bars as b}
              <div class="cx-col">
                <div class="cx-bar" style="background:{b.color}" use:animateBar={{ active: cx.time === b.label || (b.label === 'O(1)' && cx.time === 'O(1)'), h: b.h, color: b.color, step }}></div>
                <span class="cx-lbl" style="color:{(cx.time === b.label || (b.label === 'O(1)' && cx.time === 'O(1)')) ? b.color : '#222'}">{b.label}</span>
              </div>
            {/each}
          </div>
          <div class="cx-detail-grid">
            <div class="cx-detail-row">
              <div class="cx-detail-label">Time Complexity</div>
              <div class="cx-detail-badge" style="background:{bars.find(b => b.label.startsWith(cx.time.slice(0,3)))?.color || '#4ade80'}20;color:{bars.find(b => b.label.startsWith(cx.time.slice(0,3)))?.color || '#4ade80'}">{cx.time}</div>
            </div>
            <div class="cx-detail-why">{cx.timeWhy}</div>
            <div class="cx-detail-row">
              <div class="cx-detail-label">Space Complexity</div>
              <div class="cx-detail-badge" style="background:{bars.find(b => b.label.startsWith(cx.space.slice(0,3)))?.color || '#4ade80'}20;color:{bars.find(b => b.label.startsWith(cx.space.slice(0,3)))?.color || '#4ade80'}">{cx.space}</div>
            </div>
            <div class="cx-detail-why">{cx.spaceWhy}</div>
          </div>
          <div class="cx-stats">
            <span class="cx-s"><svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg> {sd.mo} memory writes</span>
            <span class="cx-s"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#38bdf8"/></svg> ~{sd.bytes} bytes used</span>
          </div>
        </div>

      {:else if !hasRun}
        <div class="vis-placeholder">
          <svg viewBox="0 0 200 140" class="ph-svg">
            <rect x="30" y="20" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
            <text x="60" y="44" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">x = 42</text>
            <rect x="110" y="20" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
            <text x="140" y="44" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">y = "hi"</text>
            <rect x="70" y="80" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
            <text x="100" y="104" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">z = true</text>
          </svg>
          <p class="ph-text">Write code and click <strong>▶ Visualize</strong> to see how variables are stored in memory</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .mod { width:100%; height:100%; display:flex; flex-direction:column; padding:14px 18px; gap:10px; overflow:hidden; font-family:'Inter','SF Pro',system-ui,sans-serif; }
  .hdr { display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .back { font-size:0.75rem; color:#555; text-decoration:none; }
  .back:hover { color:#38bdf8; }
  h2 { font-size:1.3rem; font-weight:700; color:#e0e0e0; margin:0; }
  .ac { color:#38bdf8; }
  .sub { font-weight:400; font-size:0.85rem; color:#555; }

  .ex-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex-shrink:0; }
  .ex-lbl { font-size:0.65rem; color:#444; }
  .ex-btn { background:#0d0d14; border:1px solid #1a1a2e; border-radius:4px; color:#666; font-size:0.7rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all 0.2s; }
  .ex-btn:hover { border-color:#38bdf844; color:#aaa; }
  .ex-btn.act { border-color:#38bdf866; color:#38bdf8; background:#38bdf810; }

  .main { flex:1; display:flex; gap:14px; min-height:0; overflow:hidden; }

  /* Code panel */
  .code-panel { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ph { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; }
  .pt { font-size:0.65rem; color:#555; letter-spacing:0.5px; text-transform:uppercase; }
  .pa { display:flex; gap:6px; }
  .rb { background:#38bdf8; color:#0a0a0f; border:none; border-radius:4px; padding:3px 12px; font-family:inherit; font-size:0.65rem; font-weight:700; cursor:pointer; }
  .rb:hover { background:#2da0d8; }
  .eb { background:transparent; color:#666; border:1px solid #1a1a2e; border-radius:4px; padding:3px 10px; font-family:inherit; font-size:0.65rem; cursor:pointer; }
  .eb:hover { color:#aaa; border-color:#333; }

  .editor { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; color:#e0e0e0; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; padding:10px 14px; resize:none; outline:none; tab-size:2; }
  .code-disp { flex:1; background:#0a0a12; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:6px 0; overflow-y:auto; font-family:'SF Mono','Fira Code','Consolas',monospace; font-size:0.85rem; line-height:1.8; }
  .cl { display:flex; align-items:center; padding:0 10px 0 0; transition:background 0.25s; min-height:1.8em; }
  .cl-exec { background:#38bdf818; }
  .cl-next { background:#f59e0b12; }
  .ln { width:30px; text-align:right; color:#2a2a3e; font-size:0.72rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .ac-col { width:20px; text-align:center; flex-shrink:0; }
  .ae { color:#38bdf8; font-size:0.7rem; }
  .an { color:#f59e0b; font-size:0.7rem; }
  .ax { opacity:0; }
  .lt { white-space:pre; color:#ccc; }

  .ctrls { display:flex; gap:4px; flex-shrink:0; }
  .cb { background:#0a0a12; border:1px solid #1a1a2e; border-radius:4px; color:#888; font-size:0.8rem; padding:3px 10px; cursor:pointer; }
  .cb:hover:not(:disabled) { border-color:#38bdf844; color:#eee; }
  .cb:disabled { opacity:0.2; cursor:default; }
  .abtn { color:#38bdf8; border-color:#38bdf833; }
  .sc { font-size:0.6rem; color:#333; margin-left:6px; font-family:monospace; }
  .slider { width:100%; accent-color:#38bdf8; margin-top:2px; }

  /* ═══ Visual panel ═══ */
  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* CPU dashboard */
  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }

  /* Memory card */
  .mem-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .mem-hdr { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .mem-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .mem-count { margin-left:auto; font-size:0.5rem; color:#333; font-family:monospace; }
  .mem-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:6px; padding:8px; }
  .mem-box { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; }
  .mem-addr { display:flex; justify-content:space-between; align-items:center; }
  .mem-addr-hex { font-size:0.45rem; color:#222; font-family:monospace; }
  .mem-type-badge { font-size:0.42rem; font-weight:700; padding:1px 5px; border-radius:3px; font-family:monospace; letter-spacing:0.5px; }
  .mem-name { font-size:0.85rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .mem-val { font-size:0.9rem; font-weight:700; font-family:'SF Mono',monospace; display:inline-block; }
  .mem-change { display:flex; align-items:center; gap:4px; margin-top:2px; }
  .mem-old { font-size:0.55rem; color:#555; font-family:monospace; text-decoration:line-through; }
  .mem-arrow { font-size:0.5rem; color:#f59e0b; }
  .mem-new { font-size:0.55rem; font-family:monospace; font-weight:600; }

  /* Byte map */
  .bytemap-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .bytemap-hdr { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .bytemap-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .bytemap-total { font-size:0.5rem; color:#38bdf8; font-family:monospace; }
  .bytemap-svg { width:100%; height:auto; display:block; padding:4px 0; }

  /* stdout */
  .out-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .out-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .out-ln { padding:3px 10px; font-size:0.75rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

  /* Complexity */
  .cx-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .cx-hdr { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .cx-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .cx-chart { display:flex; align-items:flex-end; gap:4px; height:60px; padding:8px 10px 0; }
  .cx-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .cx-bar { width:100%; border-radius:3px 3px 0 0; min-height:2px; }
  .cx-lbl { font-family:monospace; font-size:0.42rem; text-align:center; margin-top:2px; font-weight:600; }
  .cx-detail-grid { padding:8px 10px; border-top:1px solid #1a1a2e; display:flex; flex-direction:column; gap:4px; }
  .cx-detail-row { display:flex; justify-content:space-between; align-items:center; }
  .cx-detail-label { font-size:0.68rem; color:#888; font-family:monospace; }
  .cx-detail-badge { font-size:0.65rem; font-family:monospace; font-weight:800; padding:2px 10px; border-radius:4px; }
  .cx-detail-why { font-size:0.68rem; color:#999; line-height:1.5; margin-bottom:6px; }
  .cx-stats { display:flex; gap:14px; padding:5px 10px; border-top:1px solid #1a1a2e; }
  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  /* Placeholder */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }
  .ph-text strong { color:#38bdf8; }

  .err { background:#ef444412; border:1px solid #ef444433; border-radius:4px; color:#ef4444; font-size:0.72rem; padding:5px 10px; flex-shrink:0; }

  @media (max-width: 800px) {
    .main { flex-direction:column; overflow-y:auto; }
    .vis-panel { width:100%; }
    .mod { padding:10px; }
  }
</style>
