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
    { label: 'const vs let', code: 'const PI = 3.14159;\nconst APP_NAME = "VisualJS";\nlet counter = 0;\ncounter = counter + 1;\ncounter = counter + 1;',                 cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — const and let both take the same time to declare. The difference is semantic: const prevents reassignment (caught at parse time), let allows it. Neither affects runtime complexity. 2 consts + 1 let + 2 reassignments = 5 ops, constant.',                                                                                                                                                                          spaceWhy: 'O(1) — const does NOT use less memory than let. Both allocate the same space. The "const" keyword is a compile-time constraint, not a memory optimization. 3 variables = fixed space.' } },
  ];

  /**
   * Augment each raw step with Variables-specific fields:
   *   bytes    — total heap bytes across all current variables
   *   newBytes — bytes just allocated by this step (0 for reassignments)
   */
  function mapStep(s) {
    const bytes   = totalBytes(s.vars || {});
    const hlVal   = s.highlight && s.vars ? s.vars[s.highlight] : null;
    const newBytes = (hlVal !== null && hlVal !== undefined && s.phase !== 'assign')
      ? byteSize(hlVal)
      : 0;
    return { ...s, bytes, newBytes };
  }
</script>

<!-- ── Variables module ─────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="var"
  titleAccent="Store"
  subtitle="— Variables & Memory"
  {mapStep}
>

  <!-- CPU right-column registers: TARGET + HEAP -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="29" text-anchor="end" fill={sd.highlight ? '#fbbf24' : '#222'} font-size="10" font-weight="700" font-family="monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">HEAP</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="9" font-weight="700" font-family="monospace">~{sd.bytes ?? 0}B</text>
  {/snippet}

  <!-- CPU right gauge: new bytes -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.newBytes || 0) * 4)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.newBytes || 0}B NEW</text>
  {/snippet}

  <!-- Below heap: byte map visualisation -->
  {#snippet bottomPanel(sd)}
    {@const varArr = Object.entries(sd.vars || {})}
    {#if varArr.length > 0}
      {#key sd}
        <div class="bytemap-card">
          <div class="bytemap-hdr">
            <span class="bytemap-title">BYTE MAP</span>
            <span class="bytemap-total">~{sd.bytes ?? 0}B total</span>
          </div>
          <svg viewBox="0 0 300 {Math.max(30, varArr.length * 24 + 10)}" class="bytemap-svg">
            {#each varArr as [name, val], idx}
              {@const tp    = typeof val}
              {@const bytes = tp === 'number' ? 8 : tp === 'boolean' ? 4 : tp === 'string' ? (String(val).length * 2) + 16 : 8}
              {@const barW  = Math.min(250, (bytes / 40) * 250)}
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
      <svg viewBox="0 0 200 140" class="ph-svg">
        <rect x="30"  y="20" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
        <text x="60"  y="44" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">x = 42</text>
        <rect x="110" y="20" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
        <text x="140" y="44" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">y = "hi"</text>
        <rect x="70"  y="80" width="60" height="40" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
        <text x="100" y="104" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">z = true</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see variables in memory</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .bytemap-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .bytemap-hdr   { display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .bytemap-title { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .bytemap-total { font-size:0.5rem; color:#38bdf8; font-family:monospace; }
  .bytemap-svg   { width:100%; height:auto; display:block; padding:4px 0; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
