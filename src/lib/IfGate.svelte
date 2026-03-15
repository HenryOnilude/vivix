<script>
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { interpret } from './interpreter.js';
  import { dc, fv, tc, tb, totalBytes, byteSize } from './utils.js';
  import { animateBar, animatePath, animateBall, animateArrow } from './animations.js';
  import CodeEditor from './CodeEditor.svelte';

  const ACCENT = '#ff8866';
  const examples = [
    { label: 'Age check', code: 'let age = 22;\nlet canDrink = false;\n\nif (age >= 21) {\n  canDrink = true;\n}', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) means "constant time" — no matter how large your data grows, this code always does the same amount of work. Here we have exactly 1 comparison (age >= 21). Whether age is 5 or 5 billion, the CPU performs a single check. There are no loops, no recursion, and no data-dependent branching. This is the fastest possible time complexity — like checking one light switch.', spaceWhy: 'O(1) means "constant space" — the memory used does not grow with input. We allocate exactly 2 variables (age, canDrink) taking ~12 bytes total. No arrays, no objects, no dynamic allocation. Even if you ran this a million times, each run uses the same fixed amount of memory.' } },
    { label: 'Login gate', code: 'let isLoggedIn = true;\nlet role = "admin";\nlet access = "denied";\n\nif (isLoggedIn && role === "admin") {\n  access = "granted";\n}', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'Still O(1) despite having 2 comparisons joined by &&. Why? Because "constant" means a fixed number of operations regardless of input size — 2 checks is still constant, just like 1 check. The && operator also uses short-circuit evaluation: if isLoggedIn is false, JavaScript skips the second check entirely. This is an optimization the CPU makes automatically.', spaceWhy: 'O(1) — we store exactly 3 variables (isLoggedIn, role, access). The string "admin" takes a few bytes, but the total memory is fixed and doesn\'t depend on any input size. No new memory is allocated inside the if-block — we only reassign an existing variable.' } },
    { label: 'Temperature', code: 'let temp = 38.5;\nlet status = "normal";\n\nif (temp > 37.5) {\n  status = "fever";\n}', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — one numeric comparison (temp > 37.5) executes in a single CPU cycle. Floating-point comparisons are handled by the CPU\'s FPU (Floating Point Unit) and take the same time whether comparing 0.1 or 999999.9. No loops or recursion means the execution path is always the same length.', spaceWhy: 'O(1) — 2 variables using fixed memory. A number (temp) uses 8 bytes (64-bit double), a string (status) uses a few bytes for the characters. The reassignment status = "fever" reuses the same variable slot — no new allocation happens.' } },
    { label: 'Discount', code: 'let price = 100;\nlet isMember = true;\nlet discount = 0;\n\nif (isMember) {\n  discount = price * 0.2;\n  price = price - discount;\n}', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — even though the if-block contains 2 statements (multiply + subtract), the total work is still constant. O(1) doesn\'t mean "exactly 1 operation" — it means the number of operations is bounded by a constant. Here: 1 boolean check + 1 multiplication + 1 subtraction = 3 ops max. This count never changes no matter what values the variables hold.', spaceWhy: 'O(1) — 3 variables (price, isMember, discount) are allocated at the start. Inside the if-block, we compute new values but store them in existing variables. No new variables are created, no arrays grow, no objects are constructed. Total memory: ~20 bytes, always.' } },
    { label: 'if / else', code: 'let score = 45;\nlet result = "";\n\nif (score >= 50) {\n  result = "pass";\n} else {\n  result = "fail";\n}', cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — exactly one branch executes, never both. Whether the if-path or the else-path runs, each contains just 1 assignment. The CPU evaluates the condition (1 comparison), then jumps to one branch. The skipped branch costs zero time — those instructions are never fetched. This is why if/else doesn\'t double the time: it\'s always "check + one path".', spaceWhy: 'O(1) — 2 variables regardless of which branch runs. Both branches write to the same variable (result), so no extra memory is needed for else. The string "pass" or "fail" is the same size. Memory usage is identical whether score is 0 or 100.' } }
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
          .to(node, { boxShadow: '0 0 20px rgba(255,136,102,0.6)', scale: 1.05, duration: 0.25 })
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
          { color: '#fff', textShadow: '0 0 20px #ff886680', scale: 1.2 },
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
    const lines = code.split('\n');
    const result = interpret(code, {});
    if (result.error) throw new Error(result.error);

    return result.steps.map(s => {
      // Extract condRaw/condSub for branch flowchart
      let condRaw = '', condSub = '';
      if (s.phase === 'condition' && s.lineIndex >= 0 && s.lineIndex < lines.length) {
        const srcLine = lines[s.lineIndex].trim();
        const m = srcLine.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
        if (m) {
          condRaw = m[1];
          condSub = condRaw;
          for (const [k, v] of Object.entries(s.vars || {})) {
            condSub = condSub.replace(new RegExp(`\\b${k}\\b`, 'g'), fv(v));
          }
        }
      }

      return {
        li: s.lineIndex, nli: s.nextLineIndex,
        vars: s.vars, out: s.output,
        hl: s.highlight, ph: s.phase,
        hint: s.memLabel || '',
        brain: s.brain,
        mo: s.memOps, co: s.comps,
        cond: s.cond !== undefined ? s.cond : undefined,
        condRaw, condSub,
        changed: s.changed || null,
        done: s.done || false
      };
    });
  }

  function phColor(ph) { if (ph === 'declare') return '#4ade80'; if (ph === 'assign') return '#f59e0b'; if (ph === 'condition' || ph === 'else-enter') return '#a78bfa'; if (ph === 'skip') return '#6b7280'; if (ph === 'output') return '#38bdf8'; if (ph === 'done') return '#4ade80'; return '#555'; }

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
    <h2>if<span class="ac">Gate</span> <span class="sub">— Conditionals</span></h2>
  </header>

  <nav class="ex-bar">
    {#each examples as ex, i}
      <button class="ex" class:active={selEx === i} onclick={() => loadEx(i)}>{ex.label}</button>
    {/each}
  </nav>

  <div class="layout">
    <!-- CODE PANEL -->
    <div class="code-panel">
      <div class="ph">
        <span class="pt">SOURCE CODE</span>
        <div class="pa">
          {#if hasRun}<button class="eb" onclick={editCode}>✎</button>{/if}
          <button class="rb" onclick={runCode}>▶ Visualize</button>
        </div>
      </div>
      {#if !hasRun}
        <CodeEditor bind:value={codeText} accent="#ff8866" />
      {:else}
        <div class="code-view">
          {#each lines as ln, i}
            <div class="cl"
              class:cl-exec={sd && sd.li === i}
              class:cl-next={sd && sd.nli === i}
              class:cl-true={sd && sd.li === i && sd.cond === true}
              class:cl-false={sd && sd.li === i && sd.cond === false}
            >
              <span class="lnum">{i + 1}</span>
              <span class="larr">
                {#if sd && sd.li === i}<span class="ae">▶</span>
                {:else if sd && sd.nli === i}<span class="an">▸</span>
                {:else}&nbsp;{/if}
              </span>
              <span class="ltxt">{ln || ' '}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#if hasRun}
        <div class="ctrls">
          <button class="cb" onclick={goFirst} disabled={step<=0}>⟪</button>
          <button class="cb" onclick={goPrev} disabled={step<=0}>‹</button>
          <button class="cb abtn" onclick={toggleAuto}>{playing ? '⏸' : '▶'}</button>
          <button class="cb" onclick={goNext} disabled={step>=total-1}>›</button>
          <button class="cb" onclick={goLast} disabled={step>=total-1}>⟫</button>
          <span class="sc">{step+1}/{total}</span>
        </div>
        <input type="range" class="slider" min="0" max={total-1} value={step} oninput={e => step = +e.target.value} />
      {/if}
    </div>

    <!-- ═══ RIGHT: VISUAL STATE PANEL ═══ -->
    <div class="vis-panel">
      {#if sd}

        <!-- ═══ CPU VISUAL DASHBOARD ═══ -->
        {#key step}
          <div class="cpu-dash">
            <svg viewBox="0 0 360 130" class="cpu-svg">
              <!-- Background -->
              <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="#1a1a2e" stroke-width="1"/>

              <!-- Progress ring (left) -->
              <circle cx="36" cy="40" r="22" fill="none" stroke="#1a1a2e" stroke-width="3"/>
              <circle cx="36" cy="40" r="22" fill="none" stroke={phColor(sd.ph)} stroke-width="3"
                stroke-dasharray={2 * Math.PI * 22}
                stroke-dashoffset={2 * Math.PI * 22 * (1 - (total > 1 ? step / (total - 1) : 0))}
                stroke-linecap="round" transform="rotate(-90 36 40)"/>
              <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{step + 1}</text>
              <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{total}</text>

              <!-- CPU chip icon -->
              <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={phColor(sd.ph)} stroke-width="1.5"/>
              <rect x="80" y="26" width="28" height="28" rx="3" fill={phColor(sd.ph)} opacity="0.1"/>
              <!-- Pins -->
              {#each [0,1,2] as p}
                <rect x={83 + p * 9} y="13" width="4" height="5" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x={83 + p * 9} y="62" width="4" height="5" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x="67" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
                <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.ph)} opacity="0.4"/>
              {/each}
              <!-- Operation symbol inside CPU -->
              <text x="94" y="46" text-anchor="middle" fill={phColor(sd.ph)} font-size="16" font-weight="800" font-family="monospace">
                {sd.ph === 'declare' ? '+' : sd.ph === 'assign' ? '←' : sd.ph === 'condition' ? '?' : sd.ph === 'skip' ? '⤳' : sd.ph === 'else-enter' ? '↵' : sd.ph === 'output' ? '▸' : sd.ph === 'done' ? '✓' : '▷'}
              </text>

              <!-- Register boxes (right of CPU) -->
              <!-- PC register -->
              <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
              <text x="194" y="29" text-anchor="end" fill={phColor(sd.ph)} font-size="10" font-weight="700" font-family="monospace">
                {sd.li >= 0 ? 'LINE ' + (sd.li + 1) : sd.ph === 'start' ? 'READY' : 'END'}
              </text>

              <!-- OP register -->
              <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
              <text x="194" y="55" text-anchor="end" fill={phColor(sd.ph)} font-size="9" font-weight="700" font-family="monospace">{sd.ph.toUpperCase()}</text>

              <!-- TARGET register (what variable is being touched) -->
              <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
              <text x="344" y="29" text-anchor="end" fill={sd.hl ? '#fbbf24' : '#222'} font-size="10" font-weight="700" font-family="monospace">{sd.hl || '—'}</text>

              <!-- RESULT register (for conditions) -->
              <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
              <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">RESULT</text>
              {#if sd.ph === 'condition'}
                <circle cx="338" cy="51" r="5" fill={sd.cond ? '#4ade80' : '#f87171'}/>
                <text x="330" y="55" text-anchor="end" fill={sd.cond ? '#4ade80' : '#f87171'} font-size="9" font-weight="700" font-family="monospace">{sd.cond ? 'TRUE' : 'FALSE'}</text>
              {:else if sd.changed}
                <text x="344" y="55" text-anchor="end" fill="#f59e0b" font-size="9" font-weight="600" font-family="monospace">{fv(sd.changed.to)}</text>
              {:else}
                <text x="344" y="55" text-anchor="end" fill="#222" font-size="9" font-family="monospace">—</text>
              {/if}

              <!-- Mini stats bar (bottom) -->
              <!-- Memory ops gauge -->
              <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="133" y="69" width={Math.min(106, sd.mo * 18)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
              <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.mo} WRITES</text>
              <!-- Comparisons gauge -->
              <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
              <rect x="247" y="69" width={Math.min(102, sd.co * 25)} height="14" rx="2" fill="#a78bfa" opacity="0.2"/>
              <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.co} COMPARES</text>

              <!-- Call stack visual (bottom left) -->
              <text x="10" y="78" fill="#333" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
              {#if !sd.done}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#4ade8044" stroke-width="1"/>
                <text x="16" y="93" fill="#4ade80" font-size="7.5" font-weight="600" font-family="monospace">Global</text>
                <text x="112" y="93" text-anchor="end" fill="#333" font-size="6.5" font-family="monospace">{Object.keys(sd.vars || {}).length} vars</text>
              {:else}
                <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="3 2"/>
                <text x="64" y="93" text-anchor="middle" fill="#222" font-size="7" font-family="monospace">empty</text>
              {/if}

              <!-- Hint line at very bottom -->
              <text x="10" y="122" fill="#444" font-size="8" font-family="system-ui, sans-serif">{sd.hint}</text>
            </svg>
            {#if sd.brain}
              <div class="cpu-explain">{sd.brain}</div>
            {/if}
          </div>
        {/key}

        <!-- ═══ BRANCH FLOWCHART — large visual (condition steps only) ═══ -->
        {#if sd.ph === 'condition'}
          {#key step}
            <div class="branch-card">
              <svg viewBox="0 0 300 170" class="branch-svg">
                <defs>
                  <filter id="gl" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/>
                  </filter>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80" stop-opacity="0.3"/><stop offset="100%" stop-color="#4ade80" stop-opacity="0.05"/></linearGradient>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171" stop-opacity="0.3"/><stop offset="100%" stop-color="#f87171" stop-opacity="0.05"/></linearGradient>
                </defs>

                <!-- Diamond -->
                <polygon points="150,8 195,40 150,72 105,40" fill="#0d0d18" stroke={sd.cond ? '#4ade80' : '#f87171'} stroke-width="2.5"/>
                <text x="150" y="38" text-anchor="middle" fill="#e0e0e0" font-size="9" font-weight="600" font-family="monospace">{sd.condRaw.length > 20 ? sd.condRaw.slice(0,18)+'…' : sd.condRaw}</text>
                <text x="150" y="50" text-anchor="middle" fill="#666" font-size="7" font-family="monospace">{sd.condSub}</text>

                <!-- TRUE path -->
                <path use:animatePath={step} d="M 127 62 C 100 85, 65 95, 60 120" fill="none" stroke={sd.cond ? '#4ade80' : '#1a1a2e'} stroke-width={sd.cond ? 2.5 : 1} stroke-linecap="round"/>
                <!-- FALSE path -->
                <path use:animatePath={step} d="M 173 62 C 200 85, 235 95, 240 120" fill="none" stroke={!sd.cond ? '#f87171' : '#1a1a2e'} stroke-width={!sd.cond ? 2.5 : 1} stroke-linecap="round"/>

                <!-- T/F labels -->
                <text x="88" y="78" fill={sd.cond ? '#4ade80' : '#333'} font-size="10" font-weight="800" font-family="monospace">T</text>
                <text x="206" y="78" fill={!sd.cond ? '#f87171' : '#333'} font-size="10" font-weight="800" font-family="monospace">F</text>

                <!-- IF block -->
                <rect x="15" y="120" width="90" height="38" rx="6" fill={sd.cond ? 'url(#tg)' : '#0a0a12'} stroke={sd.cond ? '#4ade80' : '#1a1a2e'} stroke-width={sd.cond ? 2 : 1}/>
                <text x="60" y="140" text-anchor="middle" fill={sd.cond ? '#4ade80' : '#333'} font-size="11" font-weight="700" font-family="monospace">if {'{'} {'}'}</text>
                {#if sd.cond}<text x="60" y="153" text-anchor="middle" fill="#4ade8088" font-size="7" font-family="monospace">EXECUTE</text>{/if}

                <!-- ELSE block -->
                <rect x="195" y="120" width="90" height="38" rx="6" fill={!sd.cond ? 'url(#fg)' : '#0a0a12'} stroke={!sd.cond ? '#f87171' : '#1a1a2e'} stroke-width={!sd.cond ? 2 : 1}/>
                <text x="240" y="140" text-anchor="middle" fill={!sd.cond ? '#f87171' : '#333'} font-size="11" font-weight="700" font-family="monospace">else {'{'} {'}'}</text>
                {#if !sd.cond}<text x="240" y="153" text-anchor="middle" fill="#f8717188" font-size="7" font-family="monospace">EXECUTE</text>{/if}

                <!-- Result badge -->
                <rect x={sd.cond ? 30 : 210} y="105" width="50" height="16" rx="8" fill={sd.cond ? '#4ade8030' : '#f8717130'}/>
                <text x={sd.cond ? 55 : 235} y="116" text-anchor="middle" fill={sd.cond ? '#4ade80' : '#f87171'} font-size="8" font-weight="700" font-family="monospace">{sd.cond ? '✓ TRUE' : '✗ FALSE'}</text>

                <!-- Animated ball -->
                <circle r="6" fill={sd.cond ? '#4ade80' : '#f87171'} filter="url(#gl)" use:animateBall={{ taken: sd.cond, step }}/>
              </svg>
            </div>
          {/key}
        {/if}

        <!-- ═══ MEMORY HEAP DIAGRAM — visual boxes ═══ -->
        <div class="heap">
          <div class="heap-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#ff886688" stroke-width="1.5"/><rect x="4" y="4" width="6" height="6" rx="1" fill="#ff886644"/></svg>
            <span class="heap-label">HEAP MEMORY</span>
            <span class="heap-count">{varArr.length} variable{varArr.length !== 1 ? 's' : ''}</span>
          </div>
          {#if varArr.length > 0}
            <div class="heap-grid">
              {#each varArr as [name, val], idx (name)}
                <div class="heap-cell" use:animateBox={{ status: varDiff[name] || 'same', step }}>
                  <!-- Address bar -->
                  <div class="cell-addr">0x{(0x4A00 + idx * 8).toString(16).toUpperCase()}</div>
                  <!-- Name + Type -->
                  <div class="cell-head">
                    <span class="cell-name">{name}</span>
                    <span class="cell-type" style="color:{tc(val)};border-color:{tc(val)}33">{tb(val)}</span>
                  </div>
                  <!-- Value register -->
                  <div class="cell-val-wrap">
                    <div class="cell-val" use:animateVal={{ status: varDiff[name] || 'same', color: tc(val), step }}>
                      <span style="color:{tc(val)}">{fv(val)}</span>
                    </div>
                  </div>
                  <!-- Change indicator arrow -->
                  {#if sd.changed && sd.changed.name === name}
                    <div class="cell-delta" use:animateArrow={step}>
                      <span class="delta-old">{fv(sd.changed.from)}</span>
                      <svg width="18" height="10" viewBox="0 0 18 10"><path d="M2 5h10M10 2l4 3-4 3" fill="none" stroke="#ff8866" stroke-width="1.5" stroke-linecap="round"/></svg>
                      <span class="delta-new">{fv(sd.changed.to)}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="heap-empty">
              <svg width="120" height="48" viewBox="0 0 120 48">
                <rect x="10" y="4" width="100" height="40" rx="6" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="6 3"/>
                <text x="60" y="28" text-anchor="middle" fill="#222" font-size="11" font-family="monospace">No allocations</text>
              </svg>
            </div>
          {/if}
        </div>

        <!-- ═══ STDOUT ═══ -->
        {#if sd.out && sd.out.length > 0}
          <div class="out-panel">
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
            <span class="cx-s"><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg> {sd.co} comparisons</span>
            <span class="cx-s"><svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg> {sd.mo} memory writes</span>
          </div>
        </div>

      {:else if !hasRun}
        <div class="vis-placeholder">
          <svg viewBox="0 0 200 160" class="ph-svg">
            <polygon points="100,20 140,50 100,80 60,50" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
            <text x="100" y="55" text-anchor="middle" fill="#1a1a2e" font-size="10" font-family="monospace">condition?</text>
            <path d="M 80 70 Q 50 100 40 130" fill="none" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="4 2"/>
            <path d="M 120 70 Q 150 100 160 130" fill="none" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="4 2"/>
            <rect x="10" y="130" width="60" height="22" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="4 2"/>
            <rect x="130" y="130" width="60" height="22" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="4 2"/>
            <text x="40" y="145" text-anchor="middle" fill="#1a1a2e" font-size="8">if {'{'} {'}'}</text>
            <text x="160" y="145" text-anchor="middle" fill="#1a1a2e" font-size="8">else {'{'} {'}'}</text>
          </svg>
          <p class="ph-text">Click <strong>▶ Visualize</strong> to see the execution flow</p>
        </div>
      {/if}
    </div>
  </div>
  {#if err}<div class="err">{err}</div>{/if}
</div>

<style>
  .mod { width:100%; height:100%; display:flex; flex-direction:column; padding:12px 16px; gap:6px; overflow:hidden; font-family:'Inter',system-ui,sans-serif; }
  .hdr { display:flex; align-items:center; gap:12px; flex-shrink:0; }
  .back { font-size:0.7rem; color:#444; text-decoration:none; }
  .back:hover { color:#ff8866; }
  h2 { font-size:1.15rem; font-weight:700; color:#e0e0e0; margin:0; }
  .ac { color:#ff8866; }
  .sub { font-weight:400; font-size:0.75rem; color:#444; }

  .ex-bar { display:flex; gap:4px; flex-shrink:0; }
  .ex { background:#0a0a12; border:1px solid #1a1a2e; border-radius:4px; color:#444; font-size:0.65rem; padding:3px 10px; cursor:pointer; font-family:inherit; transition:all .2s; }
  .ex:hover { border-color:#ff886644; color:#999; }
  .ex.active { border-color:#ff886666; color:#ff8866; background:#ff886610; }

  .layout { flex:1; display:flex; gap:10px; min-height:0; overflow:hidden; }

  /* Code panel */
  .code-panel { flex:1; display:flex; flex-direction:column; gap:0; min-width:0; }
  .ph { display:flex; justify-content:space-between; align-items:center; padding:4px 10px; background:#111118; border:1px solid #1a1a2e; border-radius:6px 6px 0 0; }
  .pt { font-size:0.55rem; color:#555; letter-spacing:.5px; text-transform:uppercase; font-family:monospace; }
  .pa { display:flex; gap:5px; }
  .rb { background:#ff8866; color:#0a0a0f; border:none; border-radius:4px; padding:3px 12px; font-size:0.6rem; font-weight:700; cursor:pointer; }
  .rb:hover { background:#e67040; }
  .eb { background:transparent; color:#555; border:1px solid #1a1a2e; border-radius:4px; padding:2px 8px; font-size:0.6rem; cursor:pointer; }

  .editor { flex:1; background:#08080e; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; color:#e0e0e0; font-family:'SF Mono','Fira Code',monospace; font-size:0.82rem; line-height:1.8; padding:10px 14px; resize:none; outline:none; tab-size:2; }
  .code-view { flex:1; background:#08080e; border:1px solid #1a1a2e; border-top:none; border-radius:0 0 6px 6px; padding:4px 0; overflow-y:auto; font-family:'SF Mono','Fira Code',monospace; font-size:0.82rem; line-height:1.8; }
  .cl { display:flex; align-items:center; padding:0 8px 0 0; min-height:1.8em; transition:background .2s; }
  .cl-exec { background:#ff886622; }
  .cl-next { background:#ff886610; }
  .cl-true { background:#4ade8022; }
  .cl-false { background:#f8717122; }
  .lnum { width:26px; text-align:right; color:#222; font-size:0.65rem; padding-right:4px; flex-shrink:0; user-select:none; }
  .larr { width:16px; text-align:center; flex-shrink:0; }
  .ae { color:#ff8866; font-size:0.6rem; }
  .an { color:#ff4466; font-size:0.6rem; }
  .ltxt { white-space:pre; color:#bbb; }

  .ctrls { display:flex; gap:3px; flex-shrink:0; align-items:center; margin-top:4px; }
  .cb { background:#0a0a12; border:1px solid #1a1a2e; border-radius:4px; color:#888; font-size:0.8rem; padding:3px 10px; cursor:pointer; }
  .cb:hover:not(:disabled) { border-color:#ff886644; color:#eee; }
  .cb:disabled { opacity:0.2; cursor:default; }
  .abtn { color:#ff8866; border-color:#ff886633; }
  .sc { font-size:0.6rem; color:#333; margin-left:6px; font-family:monospace; }
  .slider { width:100%; accent-color:#ff8866; margin-top:2px; }

  /* ═══ Visual panel ═══ */
  .vis-panel { width:480px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; overflow-y:auto; overflow-x:hidden; padding-right:2px; }

  /* CPU visual dashboard */
  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }

  /* Branch flowchart */
  .branch-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; padding:6px; flex-shrink:0; }
  .branch-svg { width:100%; height:auto; display:block; }

  /* Heap memory */
  .heap { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .heap-hdr { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .heap-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .heap-count { margin-left:auto; font-size:0.5rem; color:#333; font-family:monospace; }
  .heap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:6px; padding:8px; }
  .heap-cell { background:#08080e; border:2px solid #1a1a2e; border-radius:8px; padding:0; overflow:hidden; transition:border-color .3s; position:relative; }
  .heap-cell:hover { border-color:#2a2a4e; }
  .cell-addr { background:#0d0d16; padding:2px 8px; font-size:0.42rem; color:#222; font-family:monospace; letter-spacing:0.5px; border-bottom:1px solid #1a1a2e; }
  .cell-head { display:flex; justify-content:space-between; align-items:center; padding:6px 10px 2px; }
  .cell-name { font-size:0.82rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .cell-type { font-size:0.45rem; padding:1px 5px; border-radius:3px; border:1px solid; font-family:monospace; letter-spacing:0.5px; font-weight:600; }
  .cell-val-wrap { padding:4px 10px 8px; }
  .cell-val { background:#050508; border:1px solid #1a1a2e; border-radius:6px; padding:8px 10px; text-align:center; font-family:'SF Mono',monospace; font-size:1.2rem; font-weight:800; }
  .cell-delta { display:flex; align-items:center; gap:4px; padding:2px 10px 6px; justify-content:center; }
  .delta-old { font-size:0.6rem; color:#555; text-decoration:line-through; font-family:monospace; }
  .delta-new { font-size:0.6rem; color:#4ade80; font-weight:700; font-family:monospace; }
  .heap-empty { display:flex; justify-content:center; padding:12px; }

  /* Stdout */
  .out-panel { background:#050508; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .out-hdr { display:flex; align-items:center; gap:6px; padding:4px 10px; background:#0a0a12; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#444; font-family:monospace; letter-spacing:1px; font-weight:700; }
  .out-ln { padding:4px 12px; font-size:0.78rem; color:#e0e0e0; font-family:'SF Mono',monospace; }

  /* Complexity */
  .cx-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .cx-hdr { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .cx-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .cx-badge { font-size:0.75rem; font-family:monospace; font-weight:800; }
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
  .ph-text strong { color:#ff8866; }

  .err { background:#ef444412; border:1px solid #ef444433; border-radius:4px; color:#ef4444; font-size:0.72rem; padding:5px 10px; flex-shrink:0; }

  @media (max-width:800px) {
    .layout { flex-direction:column; overflow-y:auto; }
    .vis-panel { width:100%; }
  }
</style>
