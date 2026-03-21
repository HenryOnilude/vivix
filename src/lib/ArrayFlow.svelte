<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc, tb } from './utils.js';
  import { makeAnimateBox, makeAnimateVal } from './animations.js';

  const ACCENT = '#88aaff';

  const examples = [
    { label: 'push & pop',     code: 'let fruits = ["apple", "banana"];\n\nfruits.push("cherry");\nfruits.push("date");\nlet removed = fruits.pop();',                                                                                                   complexity: { time: 'O(1) per operation', space: 'O(1)', timeWhy: 'push and pop operate on the END of the array. No elements need to shift — just add/remove at the last index. Constant time.', spaceWhy: 'push grows the array by 1 element. pop shrinks by 1. No extra arrays created.' } },
    { label: 'unshift & shift', code: 'let nums = [10, 20, 30];\n\nnums.unshift(5);\nlet first = nums.shift();',                                                                                                                                        complexity: { time: 'O(n) per operation', space: 'O(1)', timeWhy: 'unshift inserts at the START — every existing element must shift right by one index. shift removes from the START — every element shifts left. Both are O(n).', spaceWhy: 'Operations are in-place. No new array is created.' } },
    { label: 'indexOf & splice', code: 'let colors = ["red", "green", "blue", "yellow"];\n\nlet idx = colors.indexOf("blue");\ncolors.splice(idx, 1);\ncolors.splice(1, 0, "purple");',                                                              complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'indexOf scans from index 0 — worst case checks all n elements. splice shifts elements after the insertion/deletion point.', spaceWhy: 'All operations modify the array in-place.' } },
    { label: 'map (new array)',  code: 'let prices = [10, 20, 30];\n\nlet doubled = prices.map(function(p) {\n  return p * 2;\n});',                                                                                                                    complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'map visits every element exactly once and applies the callback — linear time.', spaceWhy: 'map creates a brand new array of the same length. That is O(n) extra space.' } },
    { label: 'filter',          code: 'let scores = [45, 82, 67, 91, 33, 78];\n\nlet passing = scores.filter(function(s) {\n  return s >= 70;\n});',                                                                                                   complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'filter checks every element against the predicate — visits all n elements.', spaceWhy: 'Creates a new array containing only elements that pass. Worst case: all pass → O(n) space.' } },
    { label: 'reduce (sum)',    code: 'let nums = [1, 2, 3, 4, 5];\n\nlet total = nums.reduce(function(acc, n) {\n  return acc + n;\n}, 0);',                                                                                                          complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'reduce visits every element once, accumulating into a single value. Linear time.', spaceWhy: 'Only one accumulator variable — no new array created. Constant extra space.' } },
  ];

  const animateBox = makeAnimateBox(ACCENT);
  const animateVal = makeAnimateVal();

  /** Add ArrayFlow-specific fields */
  function mapStep(s) {
    return {
      ...s,
      arrays:         extractArrays(s.vars || {}),
      arrOps:         s.arrOps || 0,
      highlightIndex: s.highlightIndex !== undefined ? s.highlightIndex : null,
    };
  }

  function extractArrays(vars) {
    const arrs = {};
    for (const [k, v] of Object.entries(vars)) {
      if (Array.isArray(v)) arrs[k] = [...v];
    }
    return arrs;
  }
</script>

<!-- ── ArrayFlow module ─────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="array"
  titleAccent="Flow"
  subtitle="— Arrays"
  desc="See how arrays are stored in memory and watch elements shift, grow, and transform"
  interpreterOptions={{ trackArrays: true }}
  {mapStep}
  showHeap={false}
>

  <!-- CPU right-column registers: ARR-OPS + COMPS + TARGET -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e"
      stroke={sd.arrOps > 0 ? '#88aaff33' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">ARR-OPS</text>
    <text x="272" y="29" text-anchor="end" fill={sd.arrOps > 0 ? ACCENT : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.arrOps}</text>

    <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">COMPS</text>
    <text x="344" y="29" text-anchor="end" fill={sd.comps > 0 ? '#a78bfa' : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.comps}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="10" font-weight="700" font-family="monospace">{sd.highlight || '—'}</text>
  {/snippet}

  <!-- CPU right gauge: array ops -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, sd.arrOps * 15)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.arrOps} ARRAY OPS</text>
  {/snippet}

  <!-- Array visualization + scalar heap (replaces default heap) -->
  {#snippet topPanel(sd)}
    <!-- Array cards -->
    {#if sd.arrays && Object.keys(sd.arrays).length > 0}
      {#each Object.entries(sd.arrays) as [arrName, arrVal]}
        <div class="arr-card">
          <div class="arr-card-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="1" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.3"/>
              <rect x="5.5" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="10" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.7"/>
            </svg>
            <span class="arr-card-title">{arrName}[]</span>
            <span class="arr-card-len">length: {arrVal.length}</span>
          </div>
          <div class="arr-cells">
            {#each arrVal as elem, idx}
              <div class="arr-cell" class:cell-hl={sd.highlight === arrName && sd.highlightIndex === idx}>
                <span class="cell-idx">[{idx}]</span>
                <span class="cell-val" style="color:{tc(elem)}">{fv(elem)}</span>
              </div>
            {/each}
            {#if arrVal.length === 0}
              <div class="arr-empty">[ empty array ]</div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}

    <!-- Scalar vars (non-array) -->
    {#if Object.entries(sd.vars || {}).some(([, v]) => !Array.isArray(v))}
      <div class="scalars-card">
        <div class="scalars-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="1" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.5"/>
            <rect x="8" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="1" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="8" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.15"/>
          </svg>
          <span class="scalars-label">SCALARS</span>
        </div>
        <div class="scalars-grid">
          {#each Object.entries(sd.vars || {}).filter(([, v]) => !Array.isArray(v)) as [key, val]}
            <div class="sc-box" class:sc-flash={sd.highlight === key}>
              <div class="sc-hdr">
                <span class="sc-name">{key}</span>
                <span class="sc-type" style="color:{tc(val)}">{tb(val)}</span>
              </div>
              <div class="sc-val" style="color:{tc(val)}">{fv(val)}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.arrOps} array ops
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.comps || 0} comparisons
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 200 140" class="ph-svg">
        <rect x="30" y="50" width="25" height="25" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <rect x="60" y="50" width="25" height="25" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <rect x="90" y="50" width="25" height="25" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <rect x="120" y="50" width="25" height="25" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="42"  y="67" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">0</text>
        <text x="72"  y="67" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">1</text>
        <text x="102" y="67" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">2</text>
        <text x="132" y="67" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">3</text>
        <text x="100" y="110" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">contiguous memory</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see arrays in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Array cards */
  .arr-card      { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .arr-card-hdr  { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .arr-card-title { font-size:0.65rem; color:#88aaff; font-family:'SF Mono',monospace; font-weight:700; }
  .arr-card-len  { margin-left:auto; font-size:0.5rem; color:#444; font-family:monospace; }
  .arr-cells     { display:flex; flex-wrap:wrap; gap:4px; padding:8px; }
  .arr-cell      { display:flex; flex-direction:column; align-items:center; background:#08080e; border:1px solid #1a1a2e; border-radius:5px; padding:4px 8px; min-width:42px; transition:all 0.3s; }
  .cell-hl       { border-color:#88aaff66; background:#88aaff12; box-shadow:0 0 10px #88aaff22, inset 0 0 0 1px #88aaff33; }
  .cell-idx      { font-size:0.45rem; color:#333; font-family:monospace; }
  .cell-val      { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; }
  .arr-empty     { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  /* Scalar vars */
  .scalars-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scalars-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scalars-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .scalars-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:6px; padding:8px; }
  .sc-box        { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .sc-flash      { border-color:#88aaff44; background:#88aaff08; box-shadow:inset 3px 0 0 #88aaff; }
  .sc-hdr        { display:flex; justify-content:space-between; align-items:center; }
  .sc-name       { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .sc-type       { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family:monospace; }
  .sc-val        { font-size:0.85rem; font-weight:700; font-family:'SF Mono',monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
