<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc, tb, totalBytes, byteSize, COMPLEXITY_BARS } from './utils.js';
  import { animateBar } from './animations.js';

  const ACCENT = '#38bdf8';

  const examples = [
    { label: 'Numbers',      code: 'let age = 25;\nlet price = 9.99;\nlet year = 2024;',                                                                                   cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) means "constant time" — each let statement is a single operation. The CPU reads the value, allocates a memory slot, and writes to it. 3 declarations = 3 operations, but that\'s still constant — it doesn\'t grow with any input. Whether you declare 1 variable or 10, there are no loops or recursion.',                                                                                                               spaceWhy: 'O(1) — 3 numbers, each stored as a 64-bit IEEE 754 double (8 bytes). Total: 24 bytes of fixed memory. No arrays, no objects, no dynamic allocation. The memory footprint is known before the program even runs.' } },
    { label: 'Strings',      code: 'let name = "Alice";\nlet greeting = "Hello, " + name + "!";\nlet empty = "";',                                                         cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — string concatenation with fixed-length strings is constant time. "Hello, " + "Alice" + "!" produces a new string in one step. If the strings were variable-length (like user input of length n), concatenation would be O(n) because every character must be copied. But with literals, it\'s constant.',                                                                                                                         spaceWhy: 'O(1) — 3 string variables. In JavaScript, strings are immutable and stored on the heap. "Alice" = 10 bytes (2 bytes per char in UTF-16), "Hello, Alice!" = 26 bytes. Fixed and predictable.' } },
    { label: 'Booleans',     code: 'let isLoggedIn = true;\nlet hasPermission = false;\nlet isActive = true;',                                                             cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — boolean assignment is the simplest possible operation. The CPU stores a single bit of information (true/false), though JavaScript engines typically use 4 bytes for alignment. Three assignments = three constant-time operations.',                                                                                                                                                                                        spaceWhy: 'O(1) — 3 booleans. In theory 3 bits, in practice ~12 bytes due to memory alignment and V8 object headers. No dynamic allocation.' } },
    { label: 'Reassignment', code: 'let score = 0;\nscore = 10;\nscore = score + 5;\nscore = score * 2;',                                                                   cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — 1 declaration + 3 reassignments = 4 constant-time operations. Each reassignment overwrites the previous value in the same memory slot. The arithmetic (+ 5, * 2) are single CPU instructions. No loops, no growth.',                                                                                                                                                                                               spaceWhy: 'O(1) — only 1 variable (score) exists throughout. Reassignment reuses the same memory — it does NOT create a new variable. Old values are simply overwritten and lost.' } },
    { label: 'Type mixing',  code: 'let x = 42;\nlet y = "hello";\nlet z = true;\nlet w = null;\nlet v = undefined;',                                                     cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — 5 declarations, each constant time. JavaScript is dynamically typed, so the engine tags each value with its type at runtime. This type-tagging adds a tiny overhead per variable but is still O(1) — it doesn\'t scale with input.',                                                                                                                                                                                    spaceWhy: 'O(1) — 5 variables of different types. number: 8 bytes, string: 10+ bytes, boolean: 4 bytes, null: 8 bytes (tagged pointer), undefined: 8 bytes. Total ~38 bytes, fixed.' } },
    { label: 'const vs let', code: 'const PI = 3.14159;\nconst APP_NAME = "Vivix";\nlet counter = 0;\ncounter = counter + 1;\ncounter = counter + 1;',                 cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — const and let both take the same time to declare. The difference is semantic: const prevents reassignment (caught at parse time), let allows it. Neither affects runtime complexity. 2 consts + 1 let + 2 reassignments = 5 ops, constant.',                                                                                                                                                                          spaceWhy: 'O(1) — const does NOT use less memory than let. Both allocate the same space. The "const" keyword is a compile-time constraint, not a memory optimization. 3 variables = fixed space.' } },
  ];

  function mapStep(s) {
    const bytes   = totalBytes(s.vars || {});
    const hlVal   = s.highlight && s.vars ? s.vars[s.highlight] : null;
    const newBytes = (hlVal !== null && hlVal !== undefined && s.phase !== 'assign')
      ? byteSize(hlVal)
      : 0;
    return { ...s, bytes, newBytes };
  }

  /** Classify a JavaScript value into its V8 storage category.
   *  Returns { tag, label, region, color, why }.
   *    region = 'stack'   — value lives inline in the stack frame slot
   *    region = 'heap'    — value lives on the heap, slot holds a pointer
   *    region = 'singleton' — true / false / null / undefined share global heap slots
   */
  function classify(v) {
    if (v === null)      return { tag: 'null',   label: 'null ref',     region: 'singleton', color: '#94a3b8', why: 'shared singleton — no per-variable allocation' };
    if (v === undefined) return { tag: 'undef',  label: 'undefined',    region: 'singleton', color: '#94a3b8', why: 'shared singleton — no per-variable allocation' };
    if (typeof v === 'boolean') return { tag: 'bool', label: 'Boolean',  region: 'singleton', color: '#fbbf24', why: 'shared true/false singletons on the heap' };
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= -(2**30) && v < 2**30) {
        return { tag: 'SMI', label: 'SMI',       region: 'stack', color: '#4ade80', why: 'fits in 31 bits — tagged inline, no heap allocation' };
      }
      return { tag: 'HeapNum', label: 'HeapNumber', region: 'heap', color: '#60a5fa', why: 'float or large int — boxed as a 16-byte heap object' };
    }
    if (typeof v === 'string')  return { tag: 'Str',    label: 'SeqString',   region: 'heap', color: '#c084fc', why: 'strings are immutable heap-allocated char arrays' };
    if (Array.isArray(v))       return { tag: 'Arr',    label: 'JSArray',     region: 'heap', color: '#f472b6', why: 'array body lives on the heap; slot holds the pointer' };
    if (typeof v === 'object')  return { tag: 'Obj',    label: 'JSObject',    region: 'heap', color: '#f472b6', why: 'object lives on the heap; slot holds the pointer' };
    return { tag: '?', label: 'unknown', region: 'stack', color: '#666', why: '' };
  }
</script>

<svelte:head>
  <title>JavaScript Variable Scope & Heap Visualizer | Vivix</title>
  <meta name="description" content="See exactly where JavaScript variables are stored in heap memory. Step through every declaration and watch the engine allocate memory in real-time." />
</svelte:head>

<!-- ── Variables module ─────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="variables"
  titlePrefix="var"
  titleAccent="Store"
  subtitle="— Variables & Memory"
  {mapStep}
  dataFlow
  interpreterOptions={{ trackVar: true }}
  moduleCaption="V8's storage decision for each variable — stack-inline (SMI) vs heap-boxed (HeapNumber, SeqString, JSObject)"
>

  <!-- Memory-layout visual: stack frame on left, heap region on right.
       Each variable is rendered as a labelled chip in its actual V8 storage
       location, with the currently-written variable pulsing.
       This is what makes the MODULE cell genuinely educational at Deep Dive
       level: you can SEE which writes touch the heap and which don't. -->
  {#snippet cpuModuleVisual(sd)}
    {@const entries = Object.entries(sd.vars || {})}
    {@const active  = sd.highlight}
    {@const W = 520}
    {@const H = 110}
    {@const stackX = 6}
    {@const stackW = 220}
    {@const heapX  = stackX + stackW + 32}
    {@const heapW  = W - heapX - 6}
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- STACK region -->
      <rect x={stackX} y="14" width={stackW} height={H - 22} rx="6"
        fill="#0b0b14" stroke="#1a1a2e" stroke-width="1"/>
      <text x={stackX + 8} y="10" fill="#e2e8f0" font-size="7.5" font-weight="700"
        font-family="'Geist Mono', monospace" letter-spacing="1">STACK FRAME</text>
      <text x={stackX + stackW - 8} y="10" text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace">inline tagged pointers</text>

      <!-- HEAP region -->
      <rect x={heapX} y="14" width={heapW} height={H - 22} rx="6"
        fill="#0b0b14" stroke="#1a1a2e" stroke-width="1"/>
      <text x={heapX + 8} y="10" fill="#e2e8f0" font-size="7.5" font-weight="700"
        font-family="'Geist Mono', monospace" letter-spacing="1">HEAP</text>
      <text x={heapX + heapW - 8} y="10" text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace">boxed objects</text>

      <!-- Divider gap arrow -->
      <line x1={stackX + stackW + 6} y1={H/2} x2={heapX - 6} y2={H/2}
        stroke="#334155" stroke-width="1" stroke-dasharray="2 2"/>

      {#if entries.length === 0}
        <text x={W/2} y={H/2 + 4} text-anchor="middle" fill="#94a3b8" font-size="9"
          font-family="'Geist Mono', monospace">no variables declared yet</text>
      {:else}
        {#each entries as [name, val], i}
          {@const c = classify(val)}
          {@const isActive = name === active}
          {@const slotH = 18}
          {@const slotY = 22 + i * (slotH + 4)}

          <!-- Stack-side slot (always rendered — this IS the variable binding) -->
          <rect x={stackX + 8} y={slotY} width={stackW - 16} height={slotH} rx="3"
            fill={isActive ? `${c.color}1f` : '#08080e'}
            stroke={isActive ? c.color : '#1a1a2e'}
            stroke-width={isActive ? 1.5 : 1}/>
          <text x={stackX + 14} y={slotY + 12} fill={isActive ? c.color : '#f1f5f9'}
            font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{name}</text>
          <text x={stackX + stackW - 14} y={slotY + 12} text-anchor="end"
            fill={isActive ? c.color : '#94a3b8'}
            font-size="7.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">
            {c.region === 'stack' ? `${c.tag} · inline` : `→ ${c.tag}`}
          </text>

          {#if c.region !== 'stack'}
            <!-- Pointer arrow into heap -->
            <line x1={stackX + stackW - 4} y1={slotY + slotH/2}
              x2={heapX + 4} y2={slotY + slotH/2}
              stroke={isActive ? c.color : '#334155'} stroke-width={isActive ? 1.5 : 1}
              marker-end="url(#var-arrow-{isActive ? 'a' : 'i'})"/>

            <!-- Heap-side box -->
            <rect x={heapX + 8} y={slotY} width={heapW - 16} height={slotH} rx="3"
              fill={isActive ? `${c.color}1f` : '#08080e'}
              stroke={isActive ? c.color : '#1a1a2e'}
              stroke-width={isActive ? 1.5 : 1}/>
            <text x={heapX + 14} y={slotY + 12} fill={isActive ? c.color : '#f1f5f9'}
              font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{c.label}</text>
            <text x={heapX + heapW - 14} y={slotY + 12} text-anchor="end"
              fill={isActive ? c.color : '#94a3b8'}
              font-size="7.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.3">
              {byteSize(val)}B
            </text>
          {/if}
        {/each}
      {/if}

      <!-- Active variable's "why" caption — the depth payoff -->
      {#if active && sd.vars && active in sd.vars}
        {@const c = classify(sd.vars[active])}
        <text x={W/2} y={H - 4} text-anchor="middle" fill={c.color} font-size="8"
          font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.3">
          {active} → {c.why}
        </text>
      {/if}

      <!-- Arrow markers -->
      <defs>
        <marker id="var-arrow-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#38bdf8"/>
        </marker>
        <marker id="var-arrow-i" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#334155"/>
        </marker>
      </defs>
    </svg>
  {/snippet}

  <!-- CPU right-column registers: TARGET + HEAP -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="12" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="22" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="32" text-anchor="end" fill={sd.highlight ? '#fbbf24' : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="42" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="52" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">HEAP</text>
    <text x="344" y="62" text-anchor="end" fill={ACCENT} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">~{sd.bytes ?? 0}B</text>
  {/snippet}

  <!-- CPU right gauge: new bytes -->
  {#snippet cpuGauge(sd)}
    <rect x="210" y="72" width="140" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="211" y="73" width={Math.min(138, (sd.newBytes || 0) * 5)} height="14" rx="2" fill={ACCENT} opacity="0.25"/>
    <text x="280" y="83" text-anchor="middle" fill={ACCENT} font-size="9" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="0.5">{sd.newBytes || 0}B NEW</text>
  {/snippet}

  <!-- Byte map — byte-square grid per variable -->
  {#snippet bottomPanel(sd)}
    {@const varArr = Object.entries(sd.vars || {})}
    {#if varArr.length > 0}
      {#key sd}
        {@const isApprox = varArr.some(([, v]) => typeof v === 'string' || (v !== null && typeof v === 'object'))}
        <div class="bytemap-card">
          <div class="bytemap-hdr">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="4" height="4" rx="1" fill={ACCENT} opacity="0.7"/>
              <rect x="7" y="1" width="4" height="4" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="1" y="7" width="4" height="4" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="7" y="7" width="4" height="4" rx="1" fill={ACCENT} opacity="0.3"/>
            </svg>
            <span class="bytemap-title">MEMORY MAP</span>
            <span class="bytemap-total" title="Total heap memory allocated by your variables">{isApprox ? '~' : ''}{sd.bytes ?? 0}B used so far</span>
          </div>
          <p class="bytemap-caption">Each square = 1 byte of memory. A number always takes 8 bytes. Strings grow with their length.</p>

          <div class="bytemap-body">
            {#each varArr as [name, val]}
              {@const tp    = typeof val}
              {@const bytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? Math.min((String(val).length * 2) + 16, 64) : 8}
              {@const rawBytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? (String(val).length * 2) + 16 : 8}
              {@const color = tc(val)}
              {@const isActive = sd.highlight === name}
              {@const sizeExplain = tp === 'number'
                ? 'Always 8B — JavaScript numbers are 64-bit floats'
                : tp === 'boolean'
                  ? '4B — stored as an integer internally'
                  : tp === 'string'
                    ? `16B base + 2B per character (UTF-16) — here ${String(val).length} char${String(val).length === 1 ? '' : 's'} × 2B + 16B = ${rawBytes}B`
                    : tp === 'undefined' || val === null
                      ? '8B — fixed-size pointer-tag for null/undefined'
                      : '8B — pointer-tag (object lives elsewhere on the heap)'}
              <div class="byterow" class:byterow-active={isActive}>
                <div class="byterow-meta">
                  <span class="byterow-name" style="color:{isActive ? '#fbbf24' : '#888'}">{name}</span>
                  <span class="byterow-type" style="color:{color}">{tp === 'object' && val === null ? 'null' : tp === 'undefined' ? 'undef' : tp}</span>
                </div>
                <div class="byte-squares">
                  {#each Array(Math.min(bytes, 32)) as _, bi}
                    <div
                      class="byte-sq"
                      class:byte-sq-active={isActive}
                      style="background:{color}; opacity:{isActive ? (0.5 + (bi / Math.min(bytes, 32)) * 0.5) : (0.15 + (bi / Math.min(bytes, 32)) * 0.25)}"
                    ></div>
                  {/each}
                  {#if bytes > 32}
                    <span class="bytes-overflow">+{rawBytes - 32}B</span>
                  {/if}
                </div>
                <span class="byterow-size" title={sizeExplain} style="color:{isActive ? color : '#444'}">{rawBytes}B</span>
              </div>
            {/each}
          </div>

          <!-- Type legend -->
          <div class="byte-legend">
            <span class="leg-item">
              <span class="leg-sq" style="background:#ffcc66"></span>
              <span class="leg-label">number · 8B</span>
            </span>
            <span class="leg-item">
              <span class="leg-sq" style="background:#ff8866"></span>
              <span class="leg-label">string · 2n+16B</span>
            </span>
            <span class="leg-item">
              <span class="leg-sq" style="background:#4ade80"></span>
              <span class="leg-label">bool · 4B</span>
            </span>
            <span class="leg-item">
              <span class="leg-sq" style="background:#94a3b8"></span>
              <span class="leg-label">null/undef · 8B</span>
            </span>
          </div>
        </div>
      {/key}
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} memory writes
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      ~{sd.bytes ?? 0} bytes used
    </span>
  {/snippet}

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 220" class="ph-svg">
        <rect x="60"  y="60" width="110" height="52" rx="5" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.55)" stroke-width="2.5" stroke-dasharray="6 3"/>
        <text x="115" y="92" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">x = 42</text>
        <rect x="230" y="60" width="110" height="52" rx="5" fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.55)" stroke-width="2.5" stroke-dasharray="6 3"/>
        <text x="285" y="92" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">y = "hi"</text>
        <rect x="145" y="138" width="110" height="52" rx="5" fill="rgba(251,191,36,0.06)" stroke="rgba(251,191,36,0.55)" stroke-width="2.5" stroke-dasharray="6 3"/>
        <text x="200" y="170" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">z = true</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see variables in memory</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Byte map */
  .bytemap-card  { background:var(--a11y-surface1); border:1px solid var(--a11y-border); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .bytemap-hdr   { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--a11y-surface2); border-bottom:1px solid var(--a11y-border); }
  .bytemap-title { font-size:0.95rem; color:#e0e0e0; font-family: var(--font-code); letter-spacing:1px; font-weight:700; }
  .bytemap-total { margin-left:auto; font-size:0.78rem; color:#38bdf8; font-family: var(--font-code); font-weight:600; }
  .bytemap-caption {
    margin:0; padding:8px 12px 0;
    font-family: var(--font-ui);
    font-size:0.85rem;
    color:rgba(255,255,255,0.7);
    line-height:1.5;
  }

  .bytemap-body  { padding:6px 8px; display:flex; flex-direction:column; gap:5px; }

  .byterow       { display:flex; align-items:center; gap:8px; padding:4px 6px; border-radius:5px; transition:all 0.3s; }
  .byterow-active { background:#38bdf808; box-shadow:inset 3px 0 0 #38bdf8; }

  .byterow-meta  { display:flex; flex-direction:column; gap:1px; min-width:60px; }
  .byterow-name  { font-size:0.7rem; font-weight:700; font-family: var(--font-code); }
  .byterow-type  { font-size:0.42rem; font-family: var(--font-code); letter-spacing:0.3px; }

  .byte-squares  { display:flex; flex-wrap:wrap; gap:1.5px; flex:1; }
  .byte-sq       { width:7px; height:12px; border-radius:1px; transition:all 0.3s; flex-shrink:0; }
  .byte-sq-active { box-shadow:0 0 3px currentColor; }
  .bytes-overflow { font-size:0.45rem; color:#444; font-family: var(--font-code); align-self:center; margin-left:2px; }

  .byterow-size  { font-size:0.55rem; font-family: var(--font-code); font-weight:700; min-width:32px; text-align:right; }

  /* Type legend */
  .byte-legend   { display:flex; flex-wrap:wrap; gap:10px 14px; padding:8px 10px 10px; background:#07070f; border-top:1px solid #1a1a2e; }
  .leg-item      { display:flex; align-items:center; gap:6px; }
  .leg-sq        { width:13px; height:13px; border-radius:2px; flex-shrink:0; opacity:0.85; }
  .leg-label     { font-size:13px; color:rgba(255,255,255,0.72); font-family: var(--font-code); }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  /* Footer live-stats row — raised to match legend readability */
  .cx-s { display:flex; align-items:center; gap:5px; font-size:13px; color:rgba(255,255,255,0.72); font-family: var(--font-code); }
</style>
