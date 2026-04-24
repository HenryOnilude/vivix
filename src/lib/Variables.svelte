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
>

  <!-- CPU right-column registers: TARGET + HEAP -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="'Geist Mono', monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="29" text-anchor="end" fill={sd.highlight ? '#fbbf24' : '#222'} font-size="10" font-weight="700" font-family="'Geist Mono', monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="'Geist Mono', monospace" letter-spacing="0.5">HEAP</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="9" font-weight="700" font-family="'Geist Mono', monospace">~{sd.bytes ?? 0}B</text>
  {/snippet}

  <!-- CPU right gauge: new bytes -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.newBytes || 0) * 4)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="'Geist Mono', monospace">{sd.newBytes || 0}B NEW</text>
  {/snippet}

  <!-- Byte map — byte-square grid per variable -->
  {#snippet bottomPanel(sd)}
    {@const varArr = Object.entries(sd.vars || {})}
    {#if varArr.length > 0}
      {#key sd}
        <div class="bytemap-card">
          <div class="bytemap-hdr">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="4" height="4" rx="1" fill={ACCENT} opacity="0.7"/>
              <rect x="7" y="1" width="4" height="4" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="1" y="7" width="4" height="4" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="7" y="7" width="4" height="4" rx="1" fill={ACCENT} opacity="0.3"/>
            </svg>
            <span class="bytemap-title">MEMORY MAP</span>
            <span class="bytemap-total">~{sd.bytes ?? 0}B used</span>
          </div>

          <div class="bytemap-body">
            {#each varArr as [name, val]}
              {@const tp    = typeof val}
              {@const bytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? Math.min((String(val).length * 2) + 16, 64) : 8}
              {@const rawBytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? (String(val).length * 2) + 16 : 8}
              {@const color = tc(val)}
              {@const isActive = sd.highlight === name}
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
                <span class="byterow-size" style="color:{isActive ? color : '#444'}">{rawBytes}B</span>
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
  .bytemap-hdr   { display:flex; align-items:center; gap:6px; padding:5px 10px; background:var(--a11y-surface2); border-bottom:1px solid var(--a11y-border); }
  .bytemap-title { font-size:0.55rem; color:#555; font-family: var(--font-code); letter-spacing:1.5px; font-weight:700; }
  .bytemap-total { margin-left:auto; font-size:0.5rem; color:#38bdf8; font-family: var(--font-code); }

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
  .byte-legend   { display:flex; flex-wrap:wrap; gap:8px; padding:5px 10px 7px; background:#07070f; border-top:1px solid #1a1a2e; }
  .leg-item      { display:flex; align-items:center; gap:4px; }
  .leg-sq        { width:8px; height:8px; border-radius:1.5px; flex-shrink:0; opacity:0.7; }
  .leg-label     { font-size:0.45rem; color:#444; font-family: var(--font-code); }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family: var(--font-code); }
</style>
