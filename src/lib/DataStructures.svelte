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
    { label: 'Set (unique)',         code: 'let seen = {};\nlet arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];\nlet unique = [];\nlet val = arr[0];\nseen[val] = true;\nunique.push(val);\nval = arr[1];\nseen[val] = true;\nunique.push(val);\nval = arr[2];\nseen[val] = true;\nunique.push(val);\nval = arr[3];\nconsole.log("skip duplicate: " + val);\nval = arr[4];\nseen[val] = true;\nunique.push(val);\nconsole.log(unique);', complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'Each element is checked and inserted into the set (hash map) in O(1). Over n elements, total is O(n). This is the classic deduplication pattern.', spaceWhy: 'O(n) worst case all elements are unique, so both the set and the result array hold n items.' } },
  ];

  function mapStep(s) {
    return {
      ...s,
      dsOps:          s.dsOps || 0,
      highlightIndex: s.highlightIndex !== undefined ? s.highlightIndex : null,
      highlightKey:   s.highlightKey || null,
    };
  }

  // Detect if array looks like a stack or queue based on example label
  function dsType(arrName, vars, phase) {
    // heuristic: arrays named 'stack' or 's' → stack, 'queue' → queue, else generic
    const n = arrName.toLowerCase();
    if (n === 'stack' || n === 's' || n === 'pq') return 'stack';
    if (n === 'queue' || n === 'q') return 'queue';
    return 'array';
  }
</script>

<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="data-structures"
  titlePrefix="data"
  titleAccent="Struct"
  subtitle="— Data Structures"
  desc="Stacks, queues, maps, and sets — see how data is organized for efficient access and modification"
  interpreterOptions={{ trackDS: true }}
  {mapStep}
  showHeap={false}
  moduleCaption="LIFO vs FIFO — stacks add and remove from the same end (push/pop), queues add at one end and remove from the other (push/shift)"
>

  <!-- LIFO/FIFO arrow diagram showing access pattern -->
  {#snippet cpuModuleVisual(sd)}
    {@const vars = sd.vars || {}}
    {@const arrEntry = Object.entries(vars).find(([, v]) => Array.isArray(v))}
    {@const arrName = arrEntry ? arrEntry[0] : ''}
    {@const arr = arrEntry ? arrEntry[1] : []}
    {@const type = arrName ? dsType(arrName, vars, sd.phase) : 'array'}
    {@const isStack = type === 'stack'}
    {@const isQueue = type === 'queue'}
    {@const dsOps = sd.dsOps || 0}
    {@const W = 520}
    {@const H = 110}

    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- Header -->
      <text x="12" y="14" fill="#e2e8f0" font-size="7.5" font-weight="700"
        font-family="'Geist Mono', monospace" letter-spacing="1">
        {isStack ? 'STACK · LIFO' : isQueue ? 'QUEUE · FIFO' : 'DATA STRUCTURE'}
      </text>
      <text x="510" y="14" text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace">
        {arrName ? `${arrName} · ${arr.length} item${arr.length === 1 ? '' : 's'}` : 'no structure yet'}
      </text>

      {#if !arrEntry}
        <text x={W/2} y={H/2} text-anchor="middle" fill="#94a3b8" font-size="9"
          font-family="'Geist Mono', monospace">no array-based structure declared yet</text>
      {:else}
        {@const cellW = 50}
        {@const cellH = 24}
        {@const stripX = 80}
        {@const stripY = 38}
        {@const visible = arr.slice(0, 7)}

        <!-- Items in the structure -->
        {#each visible as val, i}
          {@const cx = stripX + i * (cellW + 4)}
          <rect x={cx} y={stripY} width={cellW} height={cellH} rx="3"
            fill="#0b0b14" stroke="#1a1a2e" stroke-width="1"/>
          <text x={cx + cellW/2} y={stripY + 16} text-anchor="middle"
            fill="#f1f5f9" font-size="9" font-weight="700"
            font-family="'Geist Mono', monospace">
            {typeof val === 'string' ? `"${val.length > 4 ? val.slice(0,3) + '…' : val}"`
            : typeof val === 'object' && val !== null ? '{}'
            : String(val).length > 5 ? String(val).slice(0, 4) + '…' : val}
          </text>
          <text x={cx + cellW/2} y={stripY + cellH + 9} text-anchor="middle"
            fill="#64748b" font-size="6"
            font-family="'Geist Mono', monospace">[{i}]</text>
        {/each}

        {#if isStack}
          <!-- LIFO: arrows BOTH push and pop at the END (right side) -->
          {@const arrowX = stripX + visible.length * (cellW + 4) + 20}
          <text x="20" y={stripY + 16} fill="#94a3b8" font-size="6.5" font-weight="600"
            font-family="'Geist Mono', monospace" letter-spacing="0.5">FRONT</text>
          <text x="20" y={stripY + 26} fill="#64748b" font-size="6"
            font-family="'Geist Mono', monospace">(closed)</text>

          <!-- Push arrow IN -->
          <line x1={arrowX + 50} y1={stripY + 6} x2={arrowX + 4} y2={stripY + 6}
            stroke="#4ade80" stroke-width="1.5" marker-end="url(#ds-arrow-in)"/>
          <text x={arrowX + 28} y={stripY - 1} text-anchor="middle"
            fill="#4ade80" font-size="6.5" font-weight="700"
            font-family="'Geist Mono', monospace">push</text>

          <!-- Pop arrow OUT -->
          <line x1={arrowX + 4} y1={stripY + 18} x2={arrowX + 50} y2={stripY + 18}
            stroke="#f87171" stroke-width="1.5" marker-end="url(#ds-arrow-out)"/>
          <text x={arrowX + 28} y={stripY + cellH + 4} text-anchor="middle"
            fill="#f87171" font-size="6.5" font-weight="700"
            font-family="'Geist Mono', monospace">pop</text>

          <text x={arrowX + 30} y={stripY + cellH + 16} text-anchor="middle"
            fill={ACCENT} font-size="7" font-weight="800"
            font-family="'Geist Mono', monospace" letter-spacing="0.5">TOP</text>
        {:else if isQueue}
          <!-- FIFO: shift OUT from front (left), push IN at back (right) -->
          {@const enterX = stripX + visible.length * (cellW + 4) + 20}
          <line x1={enterX + 44} y1={stripY + cellH/2} x2={enterX + 4} y2={stripY + cellH/2}
            stroke="#4ade80" stroke-width="1.5" marker-end="url(#ds-arrow-in)"/>
          <text x={enterX + 24} y={stripY - 2} text-anchor="middle"
            fill="#4ade80" font-size="6.5" font-weight="700"
            font-family="'Geist Mono', monospace">push</text>
          <text x={enterX + 24} y={stripY + cellH + 9} text-anchor="middle"
            fill="#94a3b8" font-size="6"
            font-family="'Geist Mono', monospace">enqueue</text>

          <line x1={stripX - 4} y1={stripY + cellH/2} x2={stripX - 44} y2={stripY + cellH/2}
            stroke="#f87171" stroke-width="1.5" marker-end="url(#ds-arrow-out)"/>
          <text x={stripX - 24} y={stripY - 2} text-anchor="middle"
            fill="#f87171" font-size="6.5" font-weight="700"
            font-family="'Geist Mono', monospace">shift</text>
          <text x={stripX - 24} y={stripY + cellH + 9} text-anchor="middle"
            fill="#94a3b8" font-size="6"
            font-family="'Geist Mono', monospace">dequeue · O(n)</text>
        {/if}

        <!-- Op counter -->
        <text x="14" y="92" fill="#94a3b8" font-size="6.5" font-weight="600"
          font-family="'Geist Mono', monospace" letter-spacing="0.5">DS OPS</text>
        <text x="14" y="104" fill={ACCENT} font-size="11" font-weight="800"
          font-family="'Geist Mono', monospace">{dsOps}</text>
      {/if}

      <!-- Footer caption -->
      <text x={W/2} y={H - 4} text-anchor="middle"
        fill={ACCENT} font-size="7.5" font-weight="600"
        font-family="'Geist Mono', monospace">
        {!arrEntry
          ? 'awaiting structure declaration'
          : isStack
            ? 'last-in · first-out — push/pop both O(1)'
            : isQueue
              ? 'first-in · first-out — push O(1), shift O(n) (must re-index)'
              : 'array operations'}
      </text>

      <defs>
        <marker id="ds-arrow-in" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#4ade80"/>
        </marker>
        <marker id="ds-arrow-out" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#f87171"/>
        </marker>
      </defs>
    </svg>
  {/snippet}

  {#snippet cpuRegisters(sd)}
    <rect x="210" y="12" width="68" height="26" rx="4" fill="#08080e"
      stroke={sd.dsOps > 0 ? '#f472b633' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#e0e0e0" font-size="7.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">DS-OPS</text>
    <text x="272" y="32" text-anchor="end" fill={sd.dsOps > 0 ? ACCENT : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.dsOps}</text>

    <rect x="284" y="12" width="66" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#e0e0e0" font-size="7.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">COMPS</text>
    <text x="344" y="32" text-anchor="end" fill={sd.comps > 0 ? '#a78bfa' : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.comps}</text>

    <rect x="210" y="42" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="52" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="62" text-anchor="end" fill={ACCENT} font-size="12" font-weight="800" font-family="'Geist Mono', monospace">{sd.highlight || '—'}</text>
  {/snippet}

  {#snippet cpuGauge(sd)}
    <rect x="210" y="72" width="140" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="211" y="73" width={Math.min(138, sd.dsOps * 15)} height="14" rx="2" fill={ACCENT} opacity="0.25"/>
    <text x="280" y="83" text-anchor="middle" fill={ACCENT} font-size="9" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="0.5">{sd.dsOps} DS OPS</text>
  {/snippet}

  {#snippet topPanel(sd)}
    <!-- Array-based structures with LIFO/FIFO visual -->
    {#each Object.entries(sd.vars || {}).filter(([, v]) => Array.isArray(v)) as [arrName, arrVal]}
      {@const type = dsType(arrName, sd.vars, sd.phase)}
      {@const isStack = type === 'stack'}
      {@const isQueue = type === 'queue'}

      <div class="ds-card">
        <div class="ds-card-hdr">
          {#if isStack}
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="1"   width="10" height="3" rx="1" fill={ACCENT} opacity="0.9"/>
              <rect x="2" y="5.5" width="10" height="3" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="2" y="10"  width="10" height="3" rx="1" fill={ACCENT} opacity="0.2"/>
            </svg>
          {:else if isQueue}
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="1" y="5" width="3" height="4" rx="1" fill={ACCENT} opacity="0.9"/>
              <rect x="5.5" y="5" width="3" height="4" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="10" y="5" width="3" height="4" rx="1" fill={ACCENT} opacity="0.2"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="1" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.3"/>
              <rect x="5.5" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.5"/>
              <rect x="10" y="3" width="3" height="8" rx="1" fill={ACCENT} opacity="0.7"/>
            </svg>
          {/if}
          <span class="ds-card-title">{arrName}[]</span>
          {#if isStack}<span class="ds-type-badge">LIFO · Last In, First Out</span>
          {:else if isQueue}<span class="ds-type-badge queue-badge">FIFO · First In, First Out</span>
          {/if}
          <span class="ds-card-len">len: {arrVal.length}</span>
        </div>

        {#if isStack}
          <!-- STACK: vertical tower, top at top -->
          <div class="stack-visual">
            <div class="stack-arrow-top">
              <span class="op-arrow">↓ push here</span>
              <span class="op-arrow op-pop">↑ pop from here</span>
            </div>
            <div class="stack-tower">
              {#if arrVal.length === 0}
                <div class="tower-empty">[ empty stack ]</div>
              {:else}
                {#each [...arrVal].reverse() as elem, ri}
                  {@const origIdx = arrVal.length - 1 - ri}
                  {@const isTop = ri === 0}
                  <div class="tower-item"
                    class:tower-top={isTop}
                    class:tower-hl={sd.highlight === arrName && sd.highlightIndex === origIdx}
                  >
                    <span class="tower-idx">[{origIdx}]</span>
                    <span class="tower-val" style="color:{tc(elem)}">{fv(elem)}</span>
                    {#if isTop}<span class="tower-tag">← TOP</span>{/if}
                  </div>
                {/each}
              {/if}
            </div>
            <div class="stack-floor">BOTTOM</div>
          </div>

        {:else if isQueue}
          <!-- QUEUE: horizontal conveyor, dequeue left, enqueue right -->
          <div class="queue-visual">
            <div class="queue-label-row">
              <span class="q-label-left">⟵ DEQUEUE (shift) · O(n) — elements shift left</span>
              <span class="q-label-right">ENQUEUE (push) · O(1) ⟶</span>
            </div>
            <div class="queue-lane">
              <div class="q-end-left">OUT</div>
              <div class="queue-cells">
                {#if arrVal.length === 0}
                  <div class="q-empty">[ empty queue ]</div>
                {:else}
                  {#each arrVal as elem, idx}
                    <div class="q-cell"
                      class:q-front={idx === 0}
                      class:q-back={idx === arrVal.length - 1}
                      class:q-hl={sd.highlight === arrName && sd.highlightIndex === idx}
                    >
                      <span class="q-cell-idx">[{idx}]</span>
                      <span class="q-cell-val" style="color:{tc(elem)}">{fv(elem)}</span>
                      {#if idx === 0}<span class="q-tag front">FRONT</span>{/if}
                      {#if idx === arrVal.length - 1 && arrVal.length > 1}<span class="q-tag back">BACK</span>{/if}
                    </div>
                  {/each}
                {/if}
              </div>
              <div class="q-end-right">IN</div>
            </div>
          </div>

        {:else}
          <!-- Generic array -->
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
        {/if}
      </div>
    {/each}

    <!-- Object-based structures (map, hash) with bucket visualization -->
    {#each Object.entries(sd.vars || {}).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v)) as [objName, objVal]}
      {@const entries = Object.entries(objVal)}
      <div class="ds-card">
        <div class="ds-card-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <text x="1" y="11" fill={ACCENT} font-size="11" font-family="'Geist Mono', monospace" font-weight="700">#</text>
          </svg>
          <span class="ds-card-title">{objName}</span>
          <span class="ds-type-badge">HASH MAP · O(1) lookup</span>
          <span class="ds-card-len">{entries.length} entries</span>
        </div>
        <!-- Hash bucket visualization -->
        <div class="hash-map-vis">
          {#each entries as [key, val], bi}
            {@const isHl = sd.highlight === objName && sd.highlightKey === key}
            <div class="hash-row" class:hash-hl={isHl}>
              <div class="hash-bucket-num">{bi}</div>
              <div class="hash-key-box">
                <span class="hash-key-label">key</span>
                <span class="hash-key-val">"{key}"</span>
              </div>
              <div class="hash-arrow">→</div>
              <div class="hash-val-box" style="border-color:{tc(val)}22">
                <span class="hash-val-label">value</span>
                <span class="hash-val" style="color:{tc(val)};font-size:1rem">{fv(val)}</span>
              </div>
              <div class="hash-type-tag" style="color:{tc(val)}">{typeof val}</div>
            </div>
          {/each}
          {#if entries.length === 0}
            <div class="ds-empty" style="padding:10px">{'{ }'} empty</div>
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

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 220" class="ph-svg">
        <rect x="130" y="28" width="140" height="36" rx="4" fill="rgba(244,114,182,0.10)" stroke="rgba(244,114,182,0.60)" stroke-width="2.5"/>
        <text x="200" y="52" text-anchor="middle" fill="rgba(244,114,182,0.90)" font-size="15" font-family="'Geist Mono', monospace" font-weight="700">push → top</text>
        <rect x="130" y="70" width="140" height="36" rx="4" fill="rgba(244,114,182,0.07)" stroke="rgba(244,114,182,0.45)" stroke-width="2.5"/>
        <text x="200" y="94" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="15" font-family="'Geist Mono', monospace" font-weight="600">item 2</text>
        <rect x="130" y="112" width="140" height="36" rx="4" fill="rgba(244,114,182,0.05)" stroke="rgba(244,114,182,0.35)" stroke-width="2.5"/>
        <text x="200" y="136" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="15" font-family="'Geist Mono', monospace" font-weight="600">item 1</text>
        <rect x="130" y="154" width="140" height="36" rx="4" fill="rgba(244,114,182,0.03)" stroke="rgba(244,114,182,0.25)" stroke-width="2.5"/>
        <text x="200" y="178" text-anchor="middle" fill="rgba(255,255,255,0.60)" font-size="15" font-family="'Geist Mono', monospace" font-weight="600">bottom</text>
        <text x="200" y="210" text-anchor="middle" fill="rgba(244,114,182,0.65)" font-size="14" font-family="'Geist Mono', monospace" font-weight="600">stack • queue • map • set</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see data structures in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* ── DS card shell ────────────────────────────────────────────────────── */
  .ds-card      { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .ds-card-hdr  { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; flex-wrap:wrap; }
  .ds-card-title { font-size:0.65rem; color:#f472b6; font-family: var(--font-code); font-weight:700; }
  .ds-card-len  { margin-left:auto; font-size:0.5rem; color:#444; font-family: var(--font-code); }
  .ds-type-badge { font-size:0.45rem; color:#f472b6; background:#f472b614; padding:1px 6px; border-radius:3px; border:1px solid #f472b633; font-family: var(--font-code); letter-spacing:0.3px; }
  .queue-badge   { color:#4ade80; background:#4ade8014; border-color:#4ade8033; }

  /* ── STACK visual ─────────────────────────────────────────────────────── */
  .stack-visual     { padding:8px; }
  .stack-arrow-top  { display:flex; justify-content:space-between; padding:0 4px 4px; }
  .op-arrow         { font-size:0.5rem; color:#4ade80; font-family: var(--font-code); letter-spacing:0.3px; }
  .op-pop           { color:#f87171; }
  .stack-tower      { display:flex; flex-direction:column; gap:3px; }
  .tower-item       { display:flex; align-items:center; gap:8px; padding:6px 10px;
                      background:#08080e; border:1px solid #1a1a2e; border-radius:5px; transition:all 0.3s; }
  .tower-top        { border-color:#f472b644; background:#f472b60a; box-shadow:0 -2px 0 #f472b633; }
  .tower-hl         { border-color:#f472b688; background:#f472b614; box-shadow:inset 3px 0 0 #f472b6; }
  .tower-idx        { font-size:0.5rem; color:#333; font-family: var(--font-code); min-width:22px; }
  .tower-val        { font-size:0.85rem; font-weight:800; font-family: var(--font-code); flex:1; }
  .tower-tag        { font-size:0.5rem; color:#f472b6; font-family: var(--font-code); letter-spacing:0.5px; font-weight:700; }
  .stack-floor      { text-align:center; font-size:0.42rem; color:#2a2a3e; font-family: var(--font-code); letter-spacing:2px; padding:4px 0 0; border-top:2px solid #1a1a2e; margin-top:3px; }
  .tower-empty      { font-size:0.6rem; color:#2a2a3e; padding:12px; text-align:center; font-family: var(--font-code); }

  /* ── QUEUE visual ─────────────────────────────────────────────────────── */
  .queue-visual     { padding:8px; }
  .queue-label-row  { display:flex; justify-content:space-between; margin-bottom:5px; }
  .q-label-left     { font-size:0.45rem; color:#4ade80; font-family: var(--font-code); }
  .q-label-right    { font-size:0.45rem; color:#f472b6; font-family: var(--font-code); }
  .queue-lane       { display:flex; align-items:center; gap:4px; }
  .q-end-left       { font-size:0.5rem; color:#4ade80; font-family: var(--font-code); font-weight:700; background:#4ade8018; padding:4px 6px; border-radius:4px; border:1px solid #4ade8033; flex-shrink:0; }
  .q-end-right      { font-size:0.5rem; color:#f472b6; font-family: var(--font-code); font-weight:700; background:#f472b618; padding:4px 6px; border-radius:4px; border:1px solid #f472b633; flex-shrink:0; }
  .queue-cells      { display:flex; gap:3px; flex:1; flex-wrap:wrap; }
  .q-cell           { display:flex; flex-direction:column; align-items:center; background:#08080e; border:1px solid #1a1a2e; border-radius:5px; padding:5px 8px; min-width:46px; transition:all 0.3s; position:relative; }
  .q-front          { border-color:#4ade8044; background:#4ade800a; }
  .q-back           { border-color:#f472b644; background:#f472b60a; }
  .q-hl             { border-color:#f472b688; background:#f472b614; box-shadow:0 0 8px #f472b622; }
  .q-cell-idx       { font-size:0.42rem; color:#333; font-family: var(--font-code); }
  .q-cell-val       { font-size:0.78rem; font-weight:800; font-family: var(--font-code); }
  .q-tag            { font-size:0.38rem; font-family: var(--font-code); letter-spacing:0.3px; font-weight:700; margin-top:2px; }
  .q-tag.front      { color:#4ade80; }
  .q-tag.back       { color:#f472b6; }
  .q-empty          { font-size:0.6rem; color:#2a2a3e; padding:8px; font-family: var(--font-code); }

  /* ── Hash map bucket visualization ────────────────────────────────────── */
  .hash-map-vis  { display:flex; flex-direction:column; gap:2px; padding:6px 8px; }
  .hash-row      { display:flex; align-items:center; gap:6px; padding:5px 6px; border-radius:5px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .hash-hl       { border-color:#f472b644; background:#f472b60a; box-shadow:inset 3px 0 0 #f472b6; }
  .hash-bucket-num { font-size:0.55rem; color:#2a2a3e; font-family: var(--font-code); min-width:14px; text-align:center; background:#0d0d16; padding:2px 3px; border-radius:3px; }
  .hash-key-box  { display:flex; flex-direction:column; background:#0d0d16; border-radius:4px; padding:2px 6px; min-width:60px; }
  .hash-key-label { font-size:0.38rem; color:#444; font-family: var(--font-code); letter-spacing:0.5px; text-transform:uppercase; }
  .hash-key-val   { font-size:0.65rem; color:#e0e0e0; font-family: var(--font-code); font-weight:600; }
  .hash-arrow    { font-size:0.7rem; color:#333; }
  .hash-val-box  { display:flex; flex-direction:column; background:#0d0d16; border-radius:4px; padding:2px 8px; flex:1; border:1px solid; }
  .hash-val-label { font-size:0.38rem; color:#444; font-family: var(--font-code); letter-spacing:0.5px; text-transform:uppercase; }
  .hash-val      { font-weight:800; font-family: var(--font-code); }
  .hash-type-tag { font-size:0.42rem; color:#444; font-family: var(--font-code); }

  /* ── Generic DS elements ──────────────────────────────────────────────── */
  .ds-elements  { display:flex; flex-direction:column; gap:2px; padding:6px 8px; }
  .ds-elem      { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .ds-elem-top  { border-color:#f472b644; }
  .ds-elem-hl   { background:#f472b612; box-shadow:inset 3px 0 0 #f472b6; }
  .ds-idx       { font-size:0.5rem; color:#333; font-family: var(--font-code); min-width:20px; }
  .ds-val       { font-size:0.72rem; font-weight:700; font-family: var(--font-code); }
  .ds-tag       { font-size:0.42rem; color:#f472b6; font-family: var(--font-code); margin-left:auto; letter-spacing:0.5px; }
  .ds-tag.front { color:#4ade80; }
  .ds-empty     { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family: var(--font-code); }

  /* ── Scalar vars ──────────────────────────────────────────────────────── */
  .scalars-card  { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scalars-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scalars-label { font-size:0.55rem; color:#555; font-family: var(--font-code); letter-spacing:1.5px; font-weight:700; }
  .scalars-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:6px; padding:8px; }
  .sc-box        { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .sc-flash      { border-color:#f472b644; background:#f472b608; box-shadow:inset 3px 0 0 #f472b6; }
  .sc-hdr        { display:flex; justify-content:space-between; align-items:center; }
  .sc-name       { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family: var(--font-code); }
  .sc-type       { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family: var(--font-code); }
  .sc-val        { font-size:0.85rem; font-weight:700; font-family: var(--font-code); }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family: var(--font-code); }
</style>
