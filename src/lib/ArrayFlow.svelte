<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc, tb } from './utils.js';
  import { makeAnimateBox, makeAnimateVal, animateElement } from './animations.js';

  const ACCENT = '#88aaff';

  const examples = [
    { label: 'push & pop',     code: 'let fruits = ["apple", "banana"];\n\nfruits.push("cherry");\nfruits.push("date");\nlet removed = fruits.pop();',                                                                                                                   complexity: { time: 'O(1) per operation', space: 'O(1)', timeWhy: 'push and pop operate on the END of the array. No elements need to shift — just add/remove at the last index. Constant time.', spaceWhy: 'push grows the array by 1 element. pop shrinks by 1. No extra arrays created.' } },
    { label: 'unshift & shift', code: 'let nums = [10, 20, 30];\n\nnums.unshift(5);\nlet first = nums.shift();',                                                                                                                                                        complexity: { time: 'O(n) per operation', space: 'O(1)', timeWhy: 'unshift inserts at the START — every existing element must shift right by one index. shift removes from the START — every element shifts left. Both are O(n).', spaceWhy: 'Operations are in-place. No new array is created.' } },
    { label: 'indexOf & splice', code: 'let colors = ["red", "green", "blue", "yellow"];\n\nlet idx = colors.indexOf("blue");\ncolors.splice(idx, 1);\ncolors.splice(1, 0, "purple");',                                                                              complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'indexOf scans from index 0 — worst case checks all n elements. splice shifts elements after the insertion/deletion point.', spaceWhy: 'All operations modify the array in-place.' } },
    { label: 'map (new array)',  code: 'let prices = [10, 20, 30];\n\nlet doubled = prices.map(function(p) {\n  return p * 2;\n});',                                                                                                                                    complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'map visits every element exactly once and applies the callback — linear time.', spaceWhy: 'map creates a brand new array of the same length. That is O(n) extra space.' } },
    { label: 'filter',          code: 'let scores = [45, 82, 67, 91, 33, 78];\n\nlet passing = scores.filter(function(s) {\n  return s >= 70;\n});',                                                                                                                   complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'filter checks every element against the predicate — visits all n elements.', spaceWhy: 'Creates a new array containing only elements that pass. Worst case: all pass → O(n) space.' } },
    { label: 'reduce (sum)',    code: 'let nums = [1, 2, 3, 4, 5];\n\nlet total = nums.reduce(function(acc, n) {\n  return acc + n;\n}, 0);',                                                                                                                          complexity: { time: 'O(n)', space: 'O(1)', timeWhy: 'reduce visits every element once, accumulating into a single value. Linear time.', spaceWhy: 'Only one accumulator variable — no new array created. Constant extra space.' } },
  ];

  const animateBox = makeAnimateBox(ACCENT);
  const animateVal = makeAnimateVal();

  // Track last operation across steps
  let _lastOp = { name: '', cost: '', end: '', fast: true };
  let _prevArrOps = 0;

  function mapStep(s, codeLines) {
    if (s.phase === 'start') { _lastOp = { name: '', cost: '', end: '', fast: true }; _prevArrOps = 0; }
    if ((s.arrOps || 0) > _prevArrOps && s.lineIndex >= 0) {
      const line = (codeLines && codeLines[s.lineIndex]) || '';
      if      (line.includes('.push('))    _lastOp = { name: 'push',    cost: 'O(1)', end: 'right', fast: true  };
      else if (line.includes('.pop('))     _lastOp = { name: 'pop',     cost: 'O(1)', end: 'right', fast: true  };
      else if (line.includes('.shift('))   _lastOp = { name: 'shift',   cost: 'O(n)', end: 'left',  fast: false };
      else if (line.includes('.unshift(')) _lastOp = { name: 'unshift', cost: 'O(n)', end: 'left',  fast: false };
      else if (line.includes('.splice('))  _lastOp = { name: 'splice',  cost: 'O(n)', end: 'mid',   fast: false };
      else if (line.includes('.indexOf(')) _lastOp = { name: 'indexOf', cost: 'O(n)', end: 'scan',  fast: false };
      else if (line.includes('.map('))     _lastOp = { name: 'map',     cost: 'O(n)', end: 'scan',  fast: false };
      else if (line.includes('.filter('))  _lastOp = { name: 'filter',  cost: 'O(n)', end: 'scan',  fast: false };
      else if (line.includes('.reduce('))  _lastOp = { name: 'reduce',  cost: 'O(n)', end: 'scan',  fast: false };
      _prevArrOps = s.arrOps || 0;
    }
    return {
      ...s,
      arrays:         extractArrays(s.vars || {}),
      arrOps:         s.arrOps || 0,
      highlightIndex: s.highlightIndex !== undefined ? s.highlightIndex : null,
      lastOp:         { ..._lastOp },
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
  desc="See how arrays live in contiguous memory — watch elements shift, grow, and transform"
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
    <text x="344" y="29" text-anchor="end" fill={sd.comps > 0 ? '#a78bfa' : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.comps || 0}</text>

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

  <!-- Array visualization -->
  {#snippet topPanel(sd)}
    {#if sd.arrays && Object.keys(sd.arrays).length > 0}
      {#each Object.entries(sd.arrays) as [arrName, arrVal]}
        {#key sd}
          {@const isShiftOp = sd.lastOp?.end === 'left'}
          {@const isScanOp  = sd.lastOp?.end === 'scan'}
          {@const isFastOp  = sd.lastOp?.fast}
          {@const opName    = sd.lastOp?.name}
          <div class="arr-card">
            <!-- Header -->
            <div class="arr-card-hdr">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="1" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.3"/>
                <rect x="5.5" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.5"/>
                <rect x="10" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.7"/>
              </svg>
              <span class="arr-card-title">{arrName}[]</span>
              {#if opName}
                <span class="op-badge" class:op-fast={isFastOp} class:op-slow={!isFastOp}>
                  .{opName}() · {sd.lastOp.cost}
                </span>
              {/if}
              <span class="arr-card-len">{arrVal.length} elements</span>
            </div>

            <!-- O(1) vs O(n) End Diagram -->
            <div class="end-diagram">
              <div class="end-box end-left" class:end-active={isShiftOp}>
                <span class="end-cost-label" style="color:{isShiftOp ? '#f87171' : '#333'}">O(n)</span>
                <div class="end-ops">
                  <span style="color:{isShiftOp ? '#f87171' : '#444'}">shift</span>
                  <span style="color:{isShiftOp ? '#f87171' : '#444'}">unshift</span>
                </div>
                <div class="end-arrow end-arrow-right" style="color:{isShiftOp ? '#f87171' : '#222'}">
                  all {arrVal.length} elements re-index →
                </div>
              </div>

              <div class="end-middle">
                <div class="memory-strip">
                  {#each arrVal as _, i}
                    <div class="mem-addr">
                      <span class="mem-addr-val">0x{(i * 8).toString(16).padStart(2,'0').toUpperCase()}</span>
                    </div>
                  {/each}
                  {#if arrVal.length === 0}
                    <span class="mem-empty">[ empty ]</span>
                  {/if}
                </div>
              </div>

              <div class="end-box end-right" class:end-active={sd.lastOp?.end === 'right'}>
                <div class="end-arrow end-arrow-left" style="color:{sd.lastOp?.end === 'right' ? '#4ade80' : '#222'}">
                  ← nothing moves
                </div>
                <div class="end-ops">
                  <span style="color:{sd.lastOp?.end === 'right' ? '#4ade80' : '#444'}">push</span>
                  <span style="color:{sd.lastOp?.end === 'right' ? '#4ade80' : '#444'}">pop</span>
                </div>
                <span class="end-cost-label" style="color:{sd.lastOp?.end === 'right' ? '#4ade80' : '#333'}">O(1)</span>
              </div>
            </div>

            <!-- Array cells -->
            <div class="arr-cells">
              {#each arrVal as elem, idx}
                {@const isHL = sd.highlight === arrName && sd.highlightIndex === idx}
                {@const isNewElem = (sd.lastOp?.name === 'push' && idx === arrVal.length - 1) || (sd.lastOp?.name === 'unshift' && idx === 0)}
                <div class="arr-cell" class:cell-hl={isHL} class:cell-scan={isScanOp}
                  use:animateElement={{ isNew: isNewElem }}
                >
                  <span class="cell-idx">[{idx}]</span>
                  <span class="cell-val" style="color:{tc(elem)}">{fv(elem)}</span>
                </div>
              {/each}
              {#if arrVal.length === 0}
                <div class="arr-empty">[ empty array ]</div>
              {/if}
            </div>

            <!-- Shift effect explanation when shift/unshift is active -->
            {#if isShiftOp && arrVal.length > 0}
              <div class="shift-panel">
                <span class="shift-title">WHY O(n): every element must move one index</span>
                <div class="shift-steps">
                  {#each Array(Math.min(arrVal.length + 1, 5)) as _, i}
                    <div class="shift-step">
                      <span class="ss-from">[{i + 1}]</span>
                      <span class="ss-arrow">→</span>
                      <span class="ss-to">[{i}]</span>
                    </div>
                  {/each}
                  {#if arrVal.length > 4}
                    <span class="ss-more">… {arrVal.length - 4} more</span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Scan operation explanation -->
            {#if isScanOp && arrVal.length > 1}
              <div class="scan-panel">
                <span class="scan-title">WHY O(n): must check each element in sequence</span>
                <div class="scan-cells">
                  {#each arrVal.slice(0, 6) as elem, i}
                    <div class="scan-cell">
                      <span class="scan-idx">[{i}]</span>
                      <span class="scan-arrow">↓ check</span>
                    </div>
                  {/each}
                  {#if arrVal.length > 6}<span class="ss-more">… {arrVal.length - 6} more</span>{/if}
                </div>
              </div>
            {/if}
          </div>
        {/key}
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
      <svg viewBox="0 0 260 140" class="ph-svg">
        <!-- Left O(n) label -->
        <text x="12" y="60" fill="rgba(255,255,255,0.55)" font-size="11" font-family="monospace" font-weight="700">O(n)</text>
        <text x="8"  y="70" fill="rgba(255,255,255,0.40)" font-size="8.5" font-family="monospace">shift</text>
        <text x="4"  y="80" fill="rgba(255,255,255,0.40)" font-size="8.5" font-family="monospace">unshift</text>
        <!-- Array cells -->
        <rect x="38" y="45" width="32" height="30" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="54" y="62" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="13" font-family="monospace">[0]</text>
        <rect x="74" y="45" width="32" height="30" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="90" y="62" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="13" font-family="monospace">[1]</text>
        <rect x="110" y="45" width="32" height="30" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="126" y="62" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="13" font-family="monospace">[2]</text>
        <rect x="146" y="45" width="32" height="30" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="162" y="62" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="13" font-family="monospace">[3]</text>
        <!-- Right O(1) label -->
        <text x="186" y="56" fill="rgba(255,255,255,0.55)" font-size="11" font-family="monospace" font-weight="700">O(1)</text>
        <text x="186" y="66" fill="rgba(255,255,255,0.40)" font-size="8.5" font-family="monospace">push</text>
        <text x="186" y="76" fill="rgba(255,255,255,0.40)" font-size="8.5" font-family="monospace">pop</text>
        <!-- Contiguous memory label -->
        <text x="105" y="100" text-anchor="middle" fill="rgba(255,255,255,0.38)" font-size="12" font-family="monospace">contiguous memory layout</text>
        <!-- Address hints -->
        <text x="54"  y="90" text-anchor="middle" fill="rgba(255,255,255,0.30)" font-size="8" font-family="monospace">0x00</text>
        <text x="90"  y="90" text-anchor="middle" fill="rgba(255,255,255,0.30)" font-size="8" font-family="monospace">0x08</text>
        <text x="126" y="90" text-anchor="middle" fill="rgba(255,255,255,0.30)" font-size="8" font-family="monospace">0x10</text>
        <text x="162" y="90" text-anchor="middle" fill="rgba(255,255,255,0.30)" font-size="8" font-family="monospace">0x18</text>
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

  .op-badge      { font-size:0.5rem; padding:2px 6px; border-radius:3px; font-family:monospace; font-weight:700; }
  .op-fast       { color:#4ade80; background:#4ade8018; border:1px solid #4ade8030; }
  .op-slow       { color:#f87171; background:#f8717118; border:1px solid #f8717130; }

  /* End diagram */
  .end-diagram   { display:flex; align-items:stretch; gap:0; padding:6px 8px; background:#07070f; border-bottom:1px solid #1a1a2e; }
  .end-box       { display:flex; flex-direction:column; align-items:center; gap:3px; padding:4px 8px; border-radius:5px; transition:all 0.3s; min-width:80px; border:1px solid transparent; }
  .end-left      { border-right:1px solid #1a1a2e; align-items:flex-start; }
  .end-right     { border-left:1px solid #1a1a2e; align-items:flex-end; }
  .end-active    { background:#ffffff06; border-color:#ffffff10 !important; }
  .end-cost-label { font-size:0.65rem; font-weight:900; font-family:monospace; letter-spacing:1px; }
  .end-ops       { display:flex; flex-direction:column; gap:1px; }
  .end-ops span  { font-size:0.5rem; font-family:monospace; letter-spacing:0.3px; }
  .end-arrow     { font-size:0.45rem; font-family:monospace; letter-spacing:0.2px; white-space:nowrap; }

  .end-middle    { flex:1; display:flex; align-items:center; justify-content:center; padding:0 4px; }
  .memory-strip  { display:flex; gap:2px; flex-wrap:wrap; justify-content:center; }
  .mem-addr      { display:flex; align-items:center; justify-content:center; width:28px; height:22px; border:1px solid #1a1a2e; border-radius:3px; background:#08080e; }
  .mem-addr-val  { font-size:0.38rem; color:#2a2a44; font-family:monospace; }
  .mem-empty     { font-size:0.5rem; color:#2a2a3e; font-family:monospace; }

  /* Array cells */
  .arr-cells     { display:flex; flex-wrap:wrap; gap:4px; padding:8px; }
  .arr-cell      { display:flex; flex-direction:column; align-items:center; background:#08080e; border:1px solid #1a1a2e; border-radius:5px; padding:4px 8px; min-width:46px; transition:all 0.3s; }
  .cell-hl       { border-color:#88aaff66; background:#88aaff12; box-shadow:0 0 10px #88aaff22, inset 0 0 0 1px #88aaff33; }
  .cell-scan     { border-color:#a78bfa22; }
  .cell-idx      { font-size:0.45rem; color:#333; font-family:monospace; }
  .cell-val      { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; }
  .arr-empty     { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  /* Shift panel */
  .shift-panel   { background:#f8717108; border-top:1px solid #f8717122; padding:6px 10px; }
  .shift-title   { font-size:0.45rem; color:#f87171; font-family:monospace; letter-spacing:0.3px; text-transform:uppercase; display:block; margin-bottom:4px; }
  .shift-steps   { display:flex; gap:6px; flex-wrap:wrap; }
  .shift-step    { display:flex; align-items:center; gap:2px; }
  .ss-from       { font-size:0.55rem; color:#666; font-family:monospace; }
  .ss-arrow      { font-size:0.55rem; color:#f87171; }
  .ss-to         { font-size:0.55rem; color:#f87171; font-family:monospace; font-weight:700; }
  .ss-more       { font-size:0.5rem; color:#444; font-family:monospace; align-self:center; }

  /* Scan panel */
  .scan-panel    { background:#a78bfa08; border-top:1px solid #a78bfa22; padding:6px 10px; }
  .scan-title    { font-size:0.45rem; color:#a78bfa; font-family:monospace; letter-spacing:0.3px; text-transform:uppercase; display:block; margin-bottom:4px; }
  .scan-cells    { display:flex; gap:8px; flex-wrap:wrap; }
  .scan-cell     { display:flex; flex-direction:column; align-items:center; gap:1px; }
  .scan-idx      { font-size:0.5rem; color:#666; font-family:monospace; }
  .scan-arrow    { font-size:0.45rem; color:#a78bfa; font-family:monospace; }

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
  .ph-svg  { width:260px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
