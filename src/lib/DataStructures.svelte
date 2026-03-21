<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc, tb } from './utils.js';

  const ACCENT = '#f472b6';

  const examples = [
    { label: 'Stack (LIFO)',         code: 'let stack = [];\nstack.push(10);\nstack.push(20);\nstack.push(30);\nlet top = stack.pop();\nconsole.log(top);\nconsole.log(stack);',                                                                                                                                                                                                                complexity: { time: 'O(1)', space: 'O(n)', timeWhy: 'Stack push and pop both operate on the END of the array — no shifting required. Each operation is O(1) constant time regardless of stack size.', spaceWhy: 'O(n) — the stack grows linearly with the number of elements pushed. Each element occupies one slot in memory.' } },
    { label: 'Queue (FIFO)',         code: 'let queue = [];\nqueue.push("A");\nqueue.push("B");\nqueue.push("C");\nlet first = queue.shift();\nconsole.log(first);\nconsole.log(queue);',                                                                                                                                                                                                           complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'Queue enqueue (push) is O(1), but dequeue (shift) is O(n) because ALL remaining elements must shift left by one index. For a proper O(1) queue, use a linked list or circular buffer.', spaceWhy: 'O(n) — the queue stores n elements. After shift(), the array is compacted, but no extra space is wasted.' } },
    { label: 'Stack: Balanced Parens', code: 'let s = [];\nlet str = "((()))";\nlet i = 0;\nlet ch = str[0];\ns.push(ch);\nch = str[1];\ns.push(ch);\nch = str[2];\ns.push(ch);\nch = str[3];\ns.pop();\nch = str[4];\ns.pop();\nch = str[5];\ns.pop();\nlet valid = s.length === 0;\nconsole.log(valid);',                                                                             complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'We scan each character once — O(n). Each push/pop is O(1), but we do it n times. Total: O(n) where n is string length.', spaceWhy: 'O(n) worst case — if the string is all opening parens, the stack grows to size n before any pops.' } },
    { label: 'Priority Queue',      code: 'let pq = [];\npq.push({ val: "low", pri: 3 });\npq.push({ val: "high", pri: 1 });\npq.push({ val: "med", pri: 2 });\npq.sort(function(a, b) {\n  return a.pri - b.pri;\n});\nlet next = pq.shift();\nconsole.log(next.val);',                                                                                                                  complexity: { time: 'O(n·lg)', space: 'O(n)', timeWhy: 'Sorting the queue after each insert is O(n log n). A real priority queue uses a binary heap for O(log n) insert and O(log n) extract-min. This naive approach is for illustration.', spaceWhy: 'O(n) — stores n elements. The sort is in-place so no extra space beyond the array itself.' } },
    { label: 'Map (key-value)',      code: 'let map = {};\nmap["alice"] = 100;\nmap["bob"] = 85;\nmap["carol"] = 92;\nlet score = map["alice"];\nconsole.log(score);\nlet has = "bob" in map;\nconsole.log(has);',                                                                                                                                                                               complexity: { time: 'O(1)', space: 'O(n)', timeWhy: 'Hash map insertion and lookup are O(1) amortized. The key is hashed to find the bucket directly — no scanning required. "in" operator is also O(1).', spaceWhy: 'O(n) — one entry per key-value pair. The hash map also maintains internal buckets, but space is proportional to the number of entries.' } },
    { label: 'Set (unique)',         code: 'let seen = {};\nlet arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];\nlet unique = [];\nlet val = arr[0];\nseen[val] = true;\nunique.push(val);\nval = arr[1];\nseen[val] = true;\nunique.push(val);\nval = arr[2];\nseen[val] = true;\nunique.push(val);\nval = arr[3];\nconsole.log("skip duplicate: " + val);\nval = arr[4];\nseen[val] = true;\nunique.push(val);\nconsole.log(unique);', complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'Each element is checked and inserted into the set (hash map) in O(1). Over n elements, total is O(n). This is the classic deduplication pattern.', spaceWhy: 'O(n) — worst case all elements are unique, so both the set and the result array hold n items.' } },
  ];

  /** Add DataStructures-specific fields */
  function mapStep(s) {
    return {
      ...s,
      dsOps:          s.dsOps || 0,
      highlightIndex: s.highlightIndex !== undefined ? s.highlightIndex : null,
      highlightKey:   s.highlightKey || null,
    };
  }
</script>

<!-- ── DataStructures module ─────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="data"
  titleAccent="Struct"
  subtitle="— Data Structures"
  desc="Stacks, queues, maps, and sets — see how data is organized for efficient access and modification"
  interpreterOptions={{ trackDS: true }}
  {mapStep}
  showHeap={false}
>

  <!-- CPU right-column registers: DS-OPS + COMPS + TARGET -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e"
      stroke={sd.dsOps > 0 ? '#f472b633' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">DS-OPS</text>
    <text x="272" y="29" text-anchor="end" fill={sd.dsOps > 0 ? ACCENT : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.dsOps}</text>

    <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">COMPS</text>
    <text x="344" y="29" text-anchor="end" fill={sd.comps > 0 ? '#a78bfa' : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.comps}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="10" font-weight="700" font-family="monospace">{sd.highlight || '—'}</text>
  {/snippet}

  <!-- CPU right gauge: DS ops -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, sd.dsOps * 12)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.dsOps} DS OPS</text>
  {/snippet}

  <!-- Stack/queue/map/set visualization + scalar vars -->
  {#snippet topPanel(sd)}
    <!-- Array-based structures (stack, queue) -->
    {#each Object.entries(sd.vars || {}).filter(([, v]) => Array.isArray(v)) as [arrName, arrVal]}
      <div class="ds-card">
        <div class="ds-card-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="2" y="1"   width="10" height="3" rx="1" fill={ACCENT} opacity="0.8"/>
            <rect x="2" y="5.5" width="10" height="3" rx="1" fill={ACCENT} opacity="0.5"/>
            <rect x="2" y="10"  width="10" height="3" rx="1" fill={ACCENT} opacity="0.25"/>
          </svg>
          <span class="ds-card-title">{arrName}[]</span>
          <span class="ds-card-len">len: {arrVal.length}</span>
        </div>
        <div class="ds-elements">
          {#if arrVal.length > 0}
            {#each arrVal as elem, idx}
              <div class="ds-elem"
                class:ds-elem-top={idx === arrVal.length - 1}
                class:ds-elem-hl={sd.highlight === arrName && sd.highlightIndex === idx}
              >
                <span class="ds-idx">[{idx}]</span>
                <span class="ds-val" style="color:{tc(elem)}">{fv(elem)}</span>
                {#if idx === arrVal.length - 1}<span class="ds-tag">← top</span>{/if}
                {#if idx === 0}<span class="ds-tag front">← front</span>{/if}
              </div>
            {/each}
          {:else}
            <div class="ds-empty">[ empty ]</div>
          {/if}
        </div>
      </div>
    {/each}

    <!-- Object-based structures (map, set) -->
    {#each Object.entries(sd.vars || {}).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v)) as [objName, objVal]}
      <div class="ds-card">
        <div class="ds-card-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <text x="1" y="11" fill={ACCENT} font-size="11" font-family="monospace" font-weight="700">#</text>
          </svg>
          <span class="ds-card-title">{objName}</span>
          <span class="ds-card-len">{Object.keys(objVal).length} entries</span>
        </div>
        <div class="ds-entries">
          {#each Object.entries(objVal) as [key, val]}
            <div class="ds-entry" class:ds-entry-hl={sd.highlight === objName && sd.highlightKey === key}>
              <span class="ds-key">{fv(key)}</span>
              <span class="ds-arrow">→</span>
              <span class="ds-val" style="color:{tc(val)}">{fv(val)}</span>
            </div>
          {/each}
          {#if Object.keys(objVal).length === 0}
            <div class="ds-empty">{'{ }'} empty</div>
          {/if}
        </div>
      </div>
    {/each}

    <!-- Scalar variables -->
    {#if Object.entries(sd.vars || {}).some(([, v]) => typeof v !== 'object' || v === null)}
      <div class="scalars-card">
        <div class="scalars-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="1" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.5"/>
            <rect x="8" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="1" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="8" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.15"/>
          </svg>
          <span class="scalars-label">VARIABLES</span>
        </div>
        <div class="scalars-grid">
          {#each Object.entries(sd.vars || {}).filter(([, v]) => typeof v !== 'object' || v === null) as [key, val]}
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
      {sd.dsOps} DS ops
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.comps || 0} comps
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
        <rect x="65" y="20" width="70" height="16" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="31" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">push → top</text>
        <rect x="65" y="40" width="70" height="16" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="51" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">item 2</text>
        <rect x="65" y="60" width="70" height="16" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="71" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">item 1</text>
        <rect x="65" y="80" width="70" height="16" rx="3" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="91" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">bottom</text>
        <text x="100" y="120" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">stack • queue • map • set</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see data structures in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* DS cards (arrays) */
  .ds-card      { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .ds-card-hdr  { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .ds-card-title { font-size:0.65rem; color:#f472b6; font-family:'SF Mono',monospace; font-weight:700; }
  .ds-card-len  { margin-left:auto; font-size:0.5rem; color:#444; font-family:monospace; }
  .ds-elements  { display:flex; flex-direction:column; gap:2px; padding:6px 8px; }
  .ds-elem      { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .ds-elem-top  { border-color:#f472b644; }
  .ds-elem-hl   { background:#f472b612; box-shadow:inset 3px 0 0 #f472b6; }
  .ds-idx       { font-size:0.5rem; color:#333; font-family:monospace; min-width:20px; }
  .ds-val       { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; }
  .ds-tag       { font-size:0.42rem; color:#f472b6; font-family:monospace; margin-left:auto; letter-spacing:0.5px; }
  .ds-tag.front { color:#4ade80; }
  .ds-empty     { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  /* DS entries (objects) */
  .ds-entries   { display:flex; flex-direction:column; gap:2px; padding:6px 8px; }
  .ds-entry     { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .ds-entry-hl  { border-color:#f472b644; background:#f472b608; box-shadow:inset 3px 0 0 #f472b6; }
  .ds-key       { font-size:0.7rem; color:#e0e0e0; font-family:'SF Mono',monospace; font-weight:600; }
  .ds-arrow     { font-size:0.55rem; color:#333; }

  /* Scalar vars */
  .scalars-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scalars-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scalars-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .scalars-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:6px; padding:8px; }
  .sc-box        { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .sc-flash      { border-color:#f472b644; background:#f472b608; box-shadow:inset 3px 0 0 #f472b6; }
  .sc-hdr        { display:flex; justify-content:space-between; align-items:center; }
  .sc-name       { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .sc-type       { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family:monospace; }
  .sc-val        { font-size:0.85rem; font-weight:700; font-family:'SF Mono',monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
