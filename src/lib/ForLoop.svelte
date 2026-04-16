<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc } from './utils.js';

  const ACCENT = '#ffcc66';

  const examples = [
    { label: 'Count to 5',    code: 'let sum = 0;\n\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}',                                                                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'The loop runs n times (here n=5). Each iteration does constant work, so total time scales linearly with n.',                                                    spaceWhy: 'Only 2 variables (sum, i) regardless of how many iterations — fixed memory.' } },
    { label: 'Array search',  code: 'let fruits = ["apple", "banana", "cherry"];\nlet found = false;\n\nfor (let i = 0; i < fruits.length; i++) {\n  if (fruits[i] === "cherry") {\n    found = true;\n  }\n}', complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Worst case: checks every element in the array. If the target is last (or missing), all n elements are visited.',                                    spaceWhy: 'Only a boolean flag and index variable — no extra arrays created.' } },
    { label: 'Accumulator',   code: 'let total = 0;\nlet count = 0;\n\nfor (let i = 0; i < 4; i++) {\n  total = total + (i * 10);\n  count = count + 1;\n}',                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: '4 iterations, each doing 2 arithmetic operations. Time grows linearly with the loop bound.',                                                                   spaceWhy: '3 variables total (total, count, i). No dynamic allocation.' } },
    { label: 'Countdown',     code: 'let msg = "ready";\n\nfor (let i = 3; i > 0; i--) {\n  msg = i + "...";\n}\n\nmsg = "go!";',                                                                             complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Loop runs 3 times (decrementing). Constant work per iteration.',                                                                                                spaceWhy: 'One string variable overwritten each iteration — no growth.' } },
    { label: 'Nested (O(n2))',code: 'let grid = 0;\n\nfor (let r = 0; r < 3; r++) {\n  for (let c = 0; c < 3; c++) {\n    grid = grid + 1;\n  }\n}',                                                          complexity: { time: 'O(n2)', space: 'O(1)', timeWhy: 'Outer loop runs n times, inner loop runs n times for EACH outer iteration. n x n = n2 total operations. This is quadratic growth.',                     spaceWhy: 'Only 3 variables (grid, r, c). Nested loops do not automatically use more memory — only more TIME.' } },
  ];

  // Track iteration snapshots across mapStep calls for sparkline
  let _snapshots = [];

  function mapStep(s) {
    if (s.phase === 'start') _snapshots = [];
    if (s.phase === 'loop-update') {
      _snapshots = [..._snapshots, { iter: _snapshots.length + 1, vars: { ...s.vars } }];
    }
    return {
      ...s,
      loopIterations:  s.loopIters || 0,
      conditionResult: s.cond,
      iterHistory:     _snapshots.slice(),
    };
  }
</script>

<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="for"
  titleAccent="Loop"
  subtitle="— Iteration"
  desc="Watch the CPU execute loops iteration by iteration"
  interpreterOptions={{ trackLoops: true }}
  {mapStep}
>

  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="140" height="22" rx="4" fill="#08080e"
      stroke={sd.loopIterations > 0 ? '#ffcc6633' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">ITER</text>
    <text x="344" y="29" text-anchor="end" fill={sd.loopIterations > 0 ? ACCENT : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.loopIterations}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">COND</text>
    {#if sd.conditionResult === true}
      <circle cx="338" cy="51" r="5" fill="#4ade80"/>
      <text x="330" y="55" text-anchor="end" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">TRUE</text>
    {:else if sd.conditionResult === false}
      <circle cx="338" cy="51" r="5" fill="#f87171"/>
      <text x="330" y="55" text-anchor="end" fill="#f87171" font-size="9" font-weight="700" font-family="monospace">FALSE</text>
    {:else}
      <text x="344" y="55" text-anchor="end" fill="#222" font-size="9" font-family="monospace">—</text>
    {/if}
  {/snippet}

  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.comps || 0) * 10)} height="14" rx="2" fill="#a78bfa" opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.comps || 0} CHECKS</text>
  {/snippet}

  {#snippet topPanel(sd)}
    {#if sd.loopIterations > 0 || (sd.phase && sd.phase.startsWith('loop'))}
      {#key sd}
        {@const r = 54}
        {@const cx = 76}
        {@const cy = 80}
        {@const circ = 2 * Math.PI * r}
        {@const maxIter = Math.max(sd.iterHistory ? sd.iterHistory.length : 0, sd.loopIterations, 1)}
        {@const loopVars = Object.entries(sd.vars || {})}
        <div class="loop-vis">
          <div class="loop-vis-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="5" fill="none" stroke={ACCENT} stroke-width="1.5"/>
              <path d="M 9 4 L 11 7 L 9 10" fill="none" stroke={ACCENT} stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span class="loop-title">LOOP TRACKER</span>
            <span class="loop-count">{sd.loopIterations} iteration{sd.loopIterations !== 1 ? 's' : ''}</span>
          </div>
          <svg viewBox="0 0 300 160" class="loop-svg">

            <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={ACCENT} stroke-width="1" opacity="0.06"/>
            <circle cx={cx} cy={cy} r={r} fill="#0b0b14" stroke="#1a1a2e" stroke-width="10"/>

            {#each Array(Math.min(sd.loopIterations, 30)) as _, k}
              {@const angle = ((k + 0.5) / maxIter) * Math.PI * 2 - Math.PI / 2}
              <circle
                cx={cx + r * Math.cos(angle)}
                cy={cy + r * Math.sin(angle)}
                r="2.5"
                fill={ACCENT}
                opacity={0.35 + (k / Math.max(sd.loopIterations - 1, 1)) * 0.65}
              />
            {/each}

            {#if sd.loopIterations > 0}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENT} stroke-width="4"
                stroke-dasharray={circ}
                stroke-dashoffset={circ * (1 - sd.loopIterations / maxIter)}
                stroke-linecap="round"
                transform="rotate(-90 {cx} {cy})"
                opacity="0.45"/>
            {/if}

            <text x={cx} y={cy - 10} text-anchor="middle" fill={ACCENT}
              font-size="36" font-weight="900" font-family="monospace">{sd.loopIterations}</text>
            <text x={cx} y={cy + 10} text-anchor="middle" fill="#3a3a55"
              font-size="7" font-family="monospace" letter-spacing="1.5">ITERATIONS</text>

            {#if sd.conditionResult === true}
              <circle cx={cx} cy={cy + 26} r="4" fill="#4ade80" opacity="0.8"/>
              <text x={cx + 8} y={cy + 30} fill="#4ade80" font-size="7" font-weight="700" font-family="monospace">RUNNING</text>
            {:else if sd.conditionResult === false}
              <circle cx={cx} cy={cy + 26} r="4" fill="#f87171" opacity="0.8"/>
              <text x={cx + 8} y={cy + 30} fill="#f87171" font-size="7" font-weight="700" font-family="monospace">DONE</text>
            {/if}

            {#each loopVars.slice(0, 4) as [name, val], idx}
              {@const ty = 6 + idx * 36}
              {@const isActive = sd.highlight === name}
              <rect x="158" y={ty} width="136" height="30" rx="5"
                fill="#08080e"
                stroke={isActive ? ACCENT + '66' : '#1a1a2e'}
                stroke-width={isActive ? 1.5 : 0.5}/>
              {#if isActive}
                <rect x="158" y={ty} width="3" height="30" rx="1.5" fill={ACCENT} opacity="0.7"/>
              {/if}
              <text x="170" y={ty + 11} fill="#3a3a55" font-size="6" font-family="monospace" letter-spacing="0.5">{name}</text>
              <text x="286" y={ty + 25} text-anchor="end"
                fill={isActive ? ACCENT : tc(val)}
                font-size="18" font-weight="900" font-family="monospace">{fv(val)}</text>
            {/each}
          </svg>

          {#if sd.iterHistory && sd.iterHistory.length > 1}
            {@const histLen = sd.iterHistory.length}
            {@const numVars = Object.entries(sd.iterHistory[0] ? sd.iterHistory[0].vars || {} : {})
              .filter(([, v]) => typeof v === 'number')
              .map(([k]) => k)}
            {#if numVars.length > 0}
              {@const traceVar = numVars[numVars.length - 1]}
              {@const vals = sd.iterHistory.map(h => h.vars[traceVar]).filter(v => typeof v === 'number')}
              {@const minV = Math.min(...vals)}
              {@const maxV = Math.max(...vals)}
              {@const range = maxV - minV || 1}
              {@const bw = 280 / histLen}
              <div class="sparkline-wrap">
                <span class="spark-label">{traceVar} over iterations</span>
                <svg viewBox="0 0 300 36" class="sparkline-svg">
                  <line x1="10" y1="30" x2="290" y2="30" stroke="#1a1a2e" stroke-width="0.5"/>
                  {#each vals as v, i}
                    {@const bh = Math.max(2, ((v - minV) / range) * 22)}
                    <rect x={10 + i * bw + 0.5} y={30 - bh}
                      width={Math.max(1.5, bw - 1)} height={bh}
                      fill={ACCENT} opacity={0.2 + (i / histLen) * 0.8} rx="1"/>
                  {/each}
                  <text x="10" y="35" fill="#333" font-size="5.5" font-family="monospace">{vals[0]}</text>
                  <text x="290" y="35" text-anchor="end" fill={ACCENT} font-size="5.5" font-family="monospace">{vals[vals.length - 1]}</text>
                </svg>
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    {/if}
  {/snippet}

  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.loopIterations} iterations
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.comps || 0} checks
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 200 140" class="ph-svg">
        <circle cx="100" cy="60" r="40" fill="none" stroke="#1a1a2e" stroke-width="3" stroke-dasharray="6 3"/>
        <circle cx="100" cy="60" r="40" fill="none" stroke="#ffcc6622" stroke-width="8"/>
        <path d="M 120 40 L 132 60 L 120 80" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
        <text x="100" y="57" text-anchor="middle" fill="#1a1a2e" font-size="18" font-weight="900" font-family="monospace">0</text>
        <text x="100" y="70" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">ITERS</text>
        <text x="100" y="115" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">iteration loop</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see loops execute step by step</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .loop-vis     { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .loop-vis-hdr { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .loop-title   { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .loop-count   { margin-left:auto; font-size:0.5rem; color:#ffcc66; font-family:monospace; }
  .loop-svg     { width:100%; height:auto; display:block; }

  .sparkline-wrap { padding:4px 10px 8px; background:#08080e; border-top:1px solid #1a1a2e; }
  .spark-label    { font-size:0.45rem; color:#333; font-family:monospace; letter-spacing:0.5px; text-transform:uppercase; display:block; margin-bottom:2px; }
  .sparkline-svg  { width:100%; height:auto; display:block; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
