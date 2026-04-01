<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc } from './utils.js';
  import { animateLoopPulse, animateBlockReveal } from './animations.js';
  import { extractLoopBody } from './condition-utils.js';

  const ACCENT = '#ffcc66';

  const examples = [
    { label: 'Count to 5',    code: 'let sum = 0;\n\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}',                                                                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'The loop runs n times (here n=5). Each iteration does constant work, so total time scales linearly with n.',                                                    spaceWhy: 'Only 2 variables (sum, i) regardless of how many iterations — fixed memory.' } },
    { label: 'Array search',  code: 'let fruits = ["apple", "banana", "cherry"];\nlet found = false;\n\nfor (let i = 0; i < fruits.length; i++) {\n  if (fruits[i] === "cherry") {\n    found = true;\n  }\n}', complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Worst case: checks every element in the array. If the target is last (or missing), all n elements are visited.',                                    spaceWhy: 'Only a boolean flag and index variable — no extra arrays created.' } },
    { label: 'Accumulator',   code: 'let total = 0;\nlet count = 0;\n\nfor (let i = 0; i < 4; i++) {\n  total = total + (i * 10);\n  count = count + 1;\n}',                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: '4 iterations, each doing 2 arithmetic operations. Time grows linearly with the loop bound.',                                                                   spaceWhy: '3 variables total (total, count, i). No dynamic allocation.' } },
    { label: 'Countdown',     code: 'let msg = "ready";\n\nfor (let i = 3; i > 0; i--) {\n  msg = i + "...";\n}\n\nmsg = "go!";',                                                                             complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Loop runs 3 times (decrementing). Constant work per iteration.',                                                                                                spaceWhy: 'One string variable overwritten each iteration — no growth.' } },
    { label: 'Nested (O(n²))',code: 'let grid = 0;\n\nfor (let r = 0; r < 3; r++) {\n  for (let c = 0; c < 3; c++) {\n    grid = grid + 1;\n  }\n}',                                                          complexity: { time: 'O(n²)', space: 'O(1)', timeWhy: 'Outer loop runs n times, inner loop runs n times for EACH outer iteration → n × n = n² total operations. This is quadratic growth.',                     spaceWhy: 'Only 3 variables (grid, r, c). Nested loops don\'t automatically use more memory — only more TIME.' } },
  ];

  // Track iteration snapshots for sparkline + history
  let _snapshots = [];
  let _loopBody = [];
  let _loopPhase = 'idle'; // idle | init | condition | body | update | done

  function mapStep(s, codeLines) {
    if (s.phase === 'start') {
      _snapshots = [];
      _loopBody = extractLoopBody(codeLines || []);
      _loopPhase = 'idle';
    }

    // Track loop phase for the phase indicator
    if (s.phase === 'loop-init')      _loopPhase = 'init';
    else if (s.phase === 'condition') _loopPhase = 'condition';
    else if (s.phase === 'loop-body') _loopPhase = 'body';
    else if (s.phase === 'loop-update') _loopPhase = 'update';
    else if (s.cond === false && s.phase !== 'start') _loopPhase = 'done';

    if (s.phase === 'loop-update' || (s.phase === 'loop-body' && s.loopIters > (_snapshots.length))) {
      _snapshots = [..._snapshots, { iter: _snapshots.length + 1, vars: { ...s.vars } }];
    }
    return {
      ...s,
      loopIterations:  s.loopIters || 0,
      conditionResult: s.cond,
      iterHistory:     _snapshots.slice(),
      loopBody:        _loopBody,
      loopPhase:       _loopPhase,
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
        {@const iters    = sd.loopIterations}
        {@const maxIter  = Math.max(sd.iterHistory ? sd.iterHistory.length : 0, iters, 1)}
        {@const loopVars = Object.entries(sd.vars || {})}
        {@const isDone   = sd.conditionResult === false}
        {@const r = 52}
        {@const cx = 74}
        {@const cy = 80}
        {@const circ = 2 * Math.PI * r}
        {@const phase = sd.loopPhase || 'idle'}
        {@const bodyLines = sd.loopBody || []}
        {@const phases = ['init', 'condition', 'body', 'update']}
        <div class="loop-vis">
          <div class="loop-vis-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="5" fill="none" stroke={ACCENT} stroke-width="1.5"/>
              <path d="M 9 4 L 11 7 L 9 10" fill="none" stroke={ACCENT} stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span class="loop-title">LOOP TRACKER</span>
            <span class="loop-count" aria-live="polite">{iters} iteration{iters !== 1 ? 's' : ''}</span>
          </div>

          <!-- ── Phase indicator row ──────────────────────────── -->
          <div class="phase-row" aria-label="Loop execution phase">
            {#each phases as p, pi}
              <div class="phase-step" class:phase-active={phase === p} class:phase-done={phases.indexOf(phase) > pi || phase === 'done'}>
                <span class="phase-dot" style={phase === p ? `background:${ACCENT};box-shadow:0 0 6px ${ACCENT}` : ''}></span>
                <span class="phase-name">{p}</span>
              </div>
              {#if pi < 3}
                <span class="phase-arrow" class:phase-arrow-active={phases.indexOf(phase) > pi}>→</span>
              {/if}
            {/each}
            {#if phase === 'done'}
              <span class="phase-arrow phase-arrow-active">→</span>
              <div class="phase-step phase-active">
                <span class="phase-dot" style="background:#f87171;box-shadow:0 0 6px #f87171"></span>
                <span class="phase-name" style="color:#f87171">exit</span>
              </div>
            {/if}
          </div>

          <svg viewBox="0 0 300 162" class="loop-svg">

            <!-- outer glow ring -->
            <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={ACCENT} stroke-width="1" opacity="0.05"/>

            <!-- track ring -->
            <circle cx={cx} cy={cy} r={r} fill="#0b0b14" stroke="#1a1a2e" stroke-width="10"/>

            <!-- filled progress arc -->
            {#if iters > 0}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENT} stroke-width="10"
                stroke-dasharray={circ}
                stroke-dashoffset={circ * (1 - iters / maxIter)}
                stroke-linecap="butt"
                transform="rotate(-90 {cx} {cy})"
                opacity="0.35"/>
            {/if}

            <!-- orbit dots — one per iteration -->
            {#each Array(Math.min(iters, 36)) as _, k}
              {@const angle = ((k + 0.5) / maxIter) * Math.PI * 2 - Math.PI / 2}
              <circle
                cx={cx + r * Math.cos(angle)}
                cy={cy + r * Math.sin(angle)}
                r="2.8"
                fill={ACCENT}
                opacity={0.25 + (k / Math.max(iters - 1, 1)) * 0.75}
              />
            {/each}

            <!-- hero iteration number with pulse -->
            <g use:animateLoopPulse={{ active: phase === 'body' || phase === 'update' }}>
              <text x={cx} y={cy - 8} text-anchor="middle" fill={ACCENT}
                font-size="38" font-weight="900" font-family="monospace">{iters}</text>
            </g>
            <text x={cx} y={cy + 12} text-anchor="middle" fill="#3a3a55"
              font-size="7" font-family="monospace" letter-spacing="2">ITERATIONS</text>

            <!-- running / done badge -->
            {#if isDone}
              <circle cx={cx} cy={cy + 28} r="4" fill="#f87171" opacity="0.9"/>
              <text x={cx + 8} y={cy + 32} fill="#f87171" font-size="7" font-weight="700" font-family="monospace">DONE</text>
            {:else if sd.conditionResult === true}
              <circle cx={cx} cy={cy + 28} r="4" fill="#4ade80" opacity="0.9"/>
              <text x={cx + 8} y={cy + 32} fill="#4ade80" font-size="7" font-weight="700" font-family="monospace">RUNNING</text>
            {/if}

            <!-- variable tiles — right column -->
            {#each loopVars.slice(0, 4) as [name, val], idx}
              {@const ty = 4 + idx * 37}
              {@const isActive = sd.highlight === name}
              <rect x="158" y={ty} width="136" height="32" rx="5"
                fill="#08080e"
                stroke={isActive ? ACCENT + '77' : '#1a1a2e'}
                stroke-width={isActive ? 1.5 : 0.5}/>
              {#if isActive}
                <rect x="158" y={ty} width="3" height="32" rx="1.5" fill={ACCENT} opacity="0.8"/>
              {/if}
              <text x="170" y={ty + 12} fill="#3a3a55" font-size="6" font-family="monospace" letter-spacing="0.5">{name}</text>
              <text x="288" y={ty + 27} text-anchor="end"
                fill={isActive ? ACCENT : tc(val)}
                font-size="16" font-weight="900" font-family="monospace">{fv(val)}</text>
            {/each}

          </svg>

          <!-- ── Loop body code card ──────────────────────────── -->
          {#if bodyLines.length > 0}
            <div class="body-card" use:animateBlockReveal={{ taken: phase === 'body', delay: 0 }}>
              <div class="body-hdr">
                <span class="body-label">LOOP BODY</span>
                <span class="body-phase" style="color:{phase === 'body' ? '#4ade80' : phase === 'done' ? '#f87171' : '#555'}">
                  {phase === 'body' ? '▶ executing' : phase === 'done' ? '■ finished' : '⏸ waiting'}
                </span>
              </div>
              <div class="body-lines">
                {#each bodyLines as line, li}
                  <div class="body-line" class:body-line-active={phase === 'body'}>
                    <span class="body-ln">{li + 1}</span>
                    <code class="body-code">{line}</code>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- sparkline: numeric var over iterations -->
          {#if sd.iterHistory && sd.iterHistory.length > 1}
            {@const histLen = sd.iterHistory.length}
            {@const numVars = Object.keys(sd.iterHistory[0]?.vars || {}).filter(k => typeof sd.iterHistory[0].vars[k] === 'number')}
            {#if numVars.length > 0}
              {@const traceVar = numVars[numVars.length - 1]}
              {@const vals = sd.iterHistory.map(h => h.vars[traceVar]).filter(v => typeof v === 'number')}
              {@const minV = Math.min(...vals)}
              {@const maxV = Math.max(...vals)}
              {@const range = maxV - minV || 1}
              {@const bw = 276 / histLen}
              <div class="sparkline-wrap">
                <span class="spark-label">{traceVar} across {histLen} iterations</span>
                <svg viewBox="0 0 300 44" class="sparkline-svg">
                  <!-- baseline -->
                  <line x1="12" y1="36" x2="288" y2="36" stroke="#1a1a2e" stroke-width="0.5"/>
                  <!-- bars -->
                  {#each vals as v, i}
                    {@const bh = Math.max(3, ((v - minV) / range) * 26)}
                    <rect x={12 + i * bw + 0.5} y={36 - bh}
                      width={Math.max(2, bw - 1.5)} height={bh}
                      fill={ACCENT} opacity={0.2 + (i / histLen) * 0.8} rx="1.5"/>
                  {/each}
                  <!-- trend line -->
                  {#if vals.length > 1}
                    {@const pts = vals.map((v, i) => `${12 + (i + 0.5) * bw},${36 - Math.max(3, ((v - minV) / range) * 26)}`).join(' ')}
                    <polyline points={pts} fill="none" stroke={ACCENT} stroke-width="1.2" opacity="0.5" stroke-linecap="round" stroke-linejoin="round"/>
                  {/if}
                  <!-- labels -->
                  <text x="12"  y="43" fill="#333" font-size="5.5" font-family="monospace">{vals[0]}</text>
                  <text x="288" y="43" text-anchor="end" fill={ACCENT} font-size="5.5" font-family="monospace" font-weight="700">{vals[vals.length - 1]}</text>
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

  /* ── Phase indicator row ─────────────────────────────── */
  .phase-row        { display:flex; align-items:center; gap:4px; padding:6px 10px; background:#08080e; border-bottom:1px solid #1a1a2e; flex-wrap:wrap; }
  .phase-step       { display:flex; align-items:center; gap:3px; opacity:0.35; transition:opacity 0.3s; }
  .phase-active     { opacity:1; }
  .phase-done       { opacity:0.6; }
  .phase-dot        { width:6px; height:6px; border-radius:50%; background:#333; flex-shrink:0; }
  .phase-name       { font-size:0.5rem; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.5px; }
  .phase-active .phase-name { color:#ffcc66; font-weight:700; }
  .phase-arrow      { font-size:0.45rem; color:#222; }
  .phase-arrow-active { color:#555; }

  /* ── Loop body code card ───────────────────────────── */
  .body-card  { margin:0; border-top:1px solid #1a1a2e; overflow:hidden; }
  .body-hdr   { display:flex; justify-content:space-between; align-items:center; padding:4px 10px; background:#0a0a12; }
  .body-label { font-size:0.5rem; color:#555; font-family:monospace; letter-spacing:1px; font-weight:700; }
  .body-phase { font-size:0.45rem; font-family:monospace; }
  .body-lines { padding:4px 8px 6px; background:#08080e; }
  .body-line  { display:flex; align-items:center; gap:8px; padding:2px 4px; border-radius:3px; opacity:0.4; transition:opacity 0.3s, background 0.3s; }
  .body-line-active { opacity:1; background:#ffcc6608; }
  .body-ln    { font-size:0.5rem; color:#333; font-family:monospace; min-width:12px; text-align:right; }
  .body-code  { font-size:0.65rem; color:#bbb; font-family:'SF Mono',monospace; }
  .body-line-active .body-code { color:#ffcc66; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }

  @media (max-width: 480px) {
    .phase-row  { padding:4px 6px; gap:2px; }
    .phase-name { font-size:0.42rem; }
    .body-code  { font-size:0.55rem; }
  }
</style>
