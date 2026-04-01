<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv } from './utils.js';
  import { animatePath, animateBall } from './animations.js';

  const ACCENT = '#ff8866';

  const examples = [
    { label: 'Age check',    code: 'let age = 22;\nlet canDrink = false;\n\nif (age >= 21) {\n  canDrink = true;\n}',                                                                                    cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) means "constant time" — no matter how large your data grows, this code always does the same amount of work. Here we have exactly 1 comparison (age >= 21). Whether age is 5 or 5 billion, the CPU performs a single check. There are no loops, no recursion, and no data-dependent branching. This is the fastest possible time complexity — like checking one light switch.',                                                                                                          spaceWhy: 'O(1) means "constant space" — the memory used does not grow with input. We allocate exactly 2 variables (age, canDrink) taking ~12 bytes total. No arrays, no objects, no dynamic allocation. Even if you ran this a million times, each run uses the same fixed amount of memory.' } },
    { label: 'Login gate',   code: 'let isLoggedIn = true;\nlet role = "admin";\nlet access = "denied";\n\nif (isLoggedIn && role === "admin") {\n  access = "granted";\n}',                           cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'Still O(1) despite having 2 comparisons joined by &&. Why? Because "constant" means a fixed number of operations regardless of input size — 2 checks is still constant, just like 1 check. The && operator also uses short-circuit evaluation: if isLoggedIn is false, JavaScript skips the second check entirely. This is an optimization the CPU makes automatically.',                                                                                                                          spaceWhy: 'O(1) — we store exactly 3 variables (isLoggedIn, role, access). The string "admin" takes a few bytes, but the total memory is fixed and doesn\'t depend on any input size. No new memory is allocated inside the if-block — we only reassign an existing variable.' } },
    { label: 'Temperature',  code: 'let temp = 38.5;\nlet status = "normal";\n\nif (temp > 37.5) {\n  status = "fever";\n}',                                                                           cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — one numeric comparison (temp > 37.5) executes in a single CPU cycle. Floating-point comparisons are handled by the CPU\'s FPU (Floating Point Unit) and take the same time whether comparing 0.1 or 999999.9. No loops or recursion means the execution path is always the same length.',                                                                                                                                                                                          spaceWhy: 'O(1) — 2 variables using fixed memory. A number (temp) uses 8 bytes (64-bit double), a string (status) uses a few bytes for the characters. The reassignment status = "fever" reuses the same variable slot — no new allocation happens.' } },
    { label: 'Discount',     code: 'let price = 100;\nlet isMember = true;\nlet discount = 0;\n\nif (isMember) {\n  discount = price * 0.2;\n  price = price - discount;\n}',                         cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — even though the if-block contains 2 statements (multiply + subtract), the total work is still constant. O(1) doesn\'t mean "exactly 1 operation" — it means the number of operations is bounded by a constant. Here: 1 boolean check + 1 multiplication + 1 subtraction = 3 ops max. This count never changes no matter what values the variables hold.',                                                                                                                          spaceWhy: 'O(1) — 3 variables (price, isMember, discount) are allocated at the start. Inside the if-block, we compute new values but store them in existing variables. No new variables are created, no arrays grow, no objects are constructed. Total memory: ~20 bytes, always.' } },
    { label: 'if / else',    code: 'let score = 45;\nlet result = "";\n\nif (score >= 50) {\n  result = "pass";\n} else {\n  result = "fail";\n}',                                                     cx: { time: 'O(1)', space: 'O(1)', timeWhy: 'O(1) — exactly one branch executes, never both. Whether the if-path or the else-path runs, each contains just 1 assignment. The CPU evaluates the condition (1 comparison), then jumps to one branch. The skipped branch costs zero time — those instructions are never fetched. This is why if/else doesn\'t double the time: it\'s always "check + one path".',                                                                                                                           spaceWhy: 'O(1) — 2 variables regardless of which branch runs. Both branches write to the same variable (result), so no extra memory is needed for else. The string "pass" or "fail" is the same size. Memory usage is identical whether score is 0 or 100.' } },
  ];

  // Persist condition state across all steps
  let _lastCond = null;
  let _lastRaw  = '';
  let _lastSub  = '';

  function mapStep(s, codeLines) {
    if (s.phase === 'start') {
      _lastCond = null;
      _lastRaw  = '';
      _lastSub  = '';
    }

    let condRaw = '', condSub = '';
    if (s.phase === 'condition' && s.lineIndex >= 0 && s.lineIndex < codeLines.length) {
      const srcLine = codeLines[s.lineIndex].trim();
      const m = srcLine.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
      if (m) {
        condRaw = m[1];
        condSub = condRaw;
        for (const [k, v] of Object.entries(s.vars || {})) {
          condSub = condSub.replace(new RegExp(`\\b${k}\\b`, 'g'), fv(v));
        }
        _lastCond = s.cond;
        _lastRaw  = condRaw;
        _lastSub  = condSub;
      }
    } else if (s.cond !== undefined) {
      _lastCond = s.cond;
    }

    return {
      ...s,
      condRaw:  condRaw  || _lastRaw,
      condSub:  condSub  || _lastSub,
      lastCond: _lastCond,
    };
  }
</script>

<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="if"
  titleAccent="Gate"
  subtitle="— Conditionals"
  {mapStep}
>

  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="29" text-anchor="end" fill={sd.highlight ? '#fbbf24' : '#222'} font-size="10" font-weight="700" font-family="monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">RESULT</text>
    {#if sd.lastCond === true}
      <circle cx="338" cy="51" r="5" fill="#4ade80"/>
      <text x="330" y="55" text-anchor="end" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">TRUE</text>
    {:else if sd.lastCond === false}
      <circle cx="338" cy="51" r="5" fill="#f87171"/>
      <text x="330" y="55" text-anchor="end" fill="#f87171" font-size="9" font-weight="700" font-family="monospace">FALSE</text>
    {:else if sd.changed}
      <text x="344" y="55" text-anchor="end" fill="#f59e0b" font-size="9" font-weight="600" font-family="monospace">{fv(sd.changed.to)}</text>
    {:else}
      <text x="344" y="55" text-anchor="end" fill="#222" font-size="9" font-family="monospace">—</text>
    {/if}
  {/snippet}

  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.comps || 0) * 25)} height="14" rx="2" fill="#a78bfa" opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.comps || 0} COMPARES</text>
  {/snippet}

  {#snippet topPanel(sd)}
    {#if sd.lastCond !== null && sd.condRaw}
      {@const cond    = sd.lastCond}
      {@const isLive  = sd.phase === 'condition'}
      {#key sd}
        <div class="branch-card">
          <!-- condition expression row -->
          <div class="cond-row">
            <span class="cond-expr">{sd.condRaw}</span>
            <span class="cond-arrow">→</span>
            <span class="cond-sub">{sd.condSub}</span>
            <span class="cond-badge" class:badge-true={cond} class:badge-false={!cond}>
              {cond ? '✓ TRUE' : '✗ FALSE'}
            </span>
          </div>

          <svg viewBox="0 0 300 185" class="branch-svg">
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#4ade80" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#4ade80" stop-opacity="0.04"/>
              </linearGradient>
              <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#f87171" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#f87171" stop-opacity="0.04"/>
              </linearGradient>
            </defs>

            <!-- decision diamond -->
            <polygon points="150,8 198,42 150,76 102,42" fill="#0d0d18"
              stroke={cond ? '#4ade80' : '#f87171'} stroke-width="2.5"/>
            <text x="150" y="40" text-anchor="middle" fill="#e0e0e0" font-size="9" font-weight="600" font-family="monospace">
              {sd.condRaw.length > 22 ? sd.condRaw.slice(0, 20) + '...' : sd.condRaw}
            </text>
            <text x="150" y="53" text-anchor="middle" fill="#555" font-size="7" font-family="monospace">{sd.condSub}</text>

            <!-- TRUE path (left) -->
            <path use:animatePath={sd}
              d="M 126 64 C 96 88, 62 100, 56 128" fill="none"
              stroke={cond ? '#4ade80' : '#1c1c30'}
              stroke-width={cond ? 2.5 : 1} stroke-linecap="round"/>

            <!-- FALSE path (right) -->
            <path use:animatePath={sd}
              d="M 174 64 C 204 88, 238 100, 244 128" fill="none"
              stroke={!cond ? '#f87171' : '#1c1c30'}
              stroke-width={!cond ? 2.5 : 1} stroke-linecap="round"/>

            <!-- T / F labels -->
            <text x="84"  y="80" fill={cond  ? '#4ade80' : '#2a2a42'} font-size="11" font-weight="900" font-family="monospace">T</text>
            <text x="210" y="80" fill={!cond ? '#f87171' : '#2a2a42'} font-size="11" font-weight="900" font-family="monospace">F</text>

            <!-- if block -->
            <rect x="12" y="128" width="90" height="48" rx="6"
              fill={cond ? 'url(#tg)' : '#090910'}
              stroke={cond ? '#4ade80' : '#1a1a2e'} stroke-width={cond ? 2 : 1}/>
            <text x="57" y="146" text-anchor="middle"
              fill={cond ? '#4ade80' : '#252535'} font-size="12" font-weight="700" font-family="monospace">if {'{'} {'}'}</text>
            {#if cond}
              <text x="57" y="170" text-anchor="middle" fill="#4ade8066" font-size="7" font-family="monospace">EXECUTED</text>
            {/if}

            <!-- else block -->
            <rect x="198" y="128" width="90" height="48" rx="6"
              fill={!cond ? 'url(#fg)' : '#090910'}
              stroke={!cond ? '#f87171' : '#1a1a2e'} stroke-width={!cond ? 2 : 1}/>
            <text x="243" y="146" text-anchor="middle"
              fill={!cond ? '#f87171' : '#252535'} font-size="12" font-weight="700" font-family="monospace">else {'{'} {'}'}</text>
            {#if !cond}
              <text x="243" y="170" text-anchor="middle" fill="#f8717166" font-size="7" font-family="monospace">EXECUTED</text>
            {/if}

            <!-- result badge -->
            <rect x={cond ? 24 : 210} y="110" width="54" height="16" rx="8"
              fill={cond ? '#4ade8028' : '#f8717128'}/>
            <text x={cond ? 51 : 237} y="121" text-anchor="middle"
              fill={cond ? '#4ade80' : '#f87171'} font-size="8" font-weight="700" font-family="monospace">
              {cond ? '✓ TRUE' : '✗ FALSE'}
            </text>

            <!-- animated ball during condition evaluation, static after -->
            {#if isLive}
              <circle r="6" fill={cond ? '#4ade80' : '#f87171'} opacity="0.9"
                use:animateBall={{ taken: cond, step: sd }}/>
            {:else}
              <circle cx={cond ? 57 : 243} cy="157" r="4"
                fill={cond ? '#4ade80' : '#f87171'} opacity="0.45"/>
            {/if}
          </svg>
        </div>
      {/key}
    {/if}
  {/snippet}

  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.comps || 0} comparisons
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} memory writes
    </span>
  {/snippet}

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 200 160" class="ph-svg">
        <polygon points="100,20 140,50 100,80 60,50" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="4 2"/>
        <text x="100" y="55" text-anchor="middle" fill="#1a1a2e" font-size="10" font-family="monospace">condition?</text>
        <path d="M 80 70 Q 50 100 40 130"  fill="none" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="4 2"/>
        <path d="M 120 70 Q 150 100 160 130" fill="none" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="4 2"/>
        <rect x="10"  y="130" width="60" height="22" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="4 2"/>
        <rect x="130" y="130" width="60" height="22" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="4 2"/>
        <text x="40"  y="145" text-anchor="middle" fill="#1a1a2e" font-size="8">if {'{'} {'}'}</text>
        <text x="160" y="145" text-anchor="middle" fill="#1a1a2e" font-size="8">else {'{'} {'}'}</text>
      </svg>
      <p class="ph-text">Click <strong style="color:{ACCENT}">▶ Visualize</strong> to see the execution flow</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .branch-card { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .branch-svg  { width:100%; height:auto; display:block; }

  .cond-row    { display:flex; align-items:center; gap:6px; padding:7px 12px; background:#0d0d16; border-bottom:1px solid #1a1a2e; flex-wrap:wrap; }
  .cond-expr   { font-size:0.72rem; color:#ccc; font-family:'SF Mono',monospace; font-weight:600; }
  .cond-arrow  { font-size:0.6rem; color:#333; }
  .cond-sub    { font-size:0.65rem; color:#888; font-family:'SF Mono',monospace; background:#ffffff06; padding:1px 5px; border-radius:3px; }
  .cond-badge  { margin-left:auto; font-size:0.6rem; font-family:monospace; font-weight:700; padding:2px 8px; border-radius:4px; }
  .badge-true  { color:#4ade80; background:#4ade8018; border:1px solid #4ade8033; }
  .badge-false { color:#f87171; background:#f8717118; border:1px solid #f8717133; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
