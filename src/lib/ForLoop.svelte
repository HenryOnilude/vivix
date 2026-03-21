<script>
  import ModuleShell from './ModuleShell.svelte';

  const ACCENT = '#ffcc66';

  const examples = [
    { label: 'Count to 5',    code: 'let sum = 0;\n\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}',                                                                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'The loop runs n times (here n=5). Each iteration does constant work, so total time scales linearly with n.',                                                    spaceWhy: 'Only 2 variables (sum, i) regardless of how many iterations — fixed memory.' } },
    { label: 'Array search',  code: 'let fruits = ["apple", "banana", "cherry"];\nlet found = false;\n\nfor (let i = 0; i < fruits.length; i++) {\n  if (fruits[i] === "cherry") {\n    found = true;\n  }\n}', complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Worst case: checks every element in the array. If the target is last (or missing), all n elements are visited.',                                    spaceWhy: 'Only a boolean flag and index variable — no extra arrays created.' } },
    { label: 'Accumulator',   code: 'let total = 0;\nlet count = 0;\n\nfor (let i = 0; i < 4; i++) {\n  total = total + (i * 10);\n  count = count + 1;\n}',                                                   complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: '4 iterations, each doing 2 arithmetic operations. Time grows linearly with the loop bound.',                                                                   spaceWhy: '3 variables total (total, count, i). No dynamic allocation.' } },
    { label: 'Countdown',     code: 'let msg = "ready";\n\nfor (let i = 3; i > 0; i--) {\n  msg = i + "...";\n}\n\nmsg = "go!";',                                                                             complexity: { time: 'O(n)',  space: 'O(1)', timeWhy: 'Loop runs 3 times (decrementing). Constant work per iteration.',                                                                                                spaceWhy: 'One string variable overwritten each iteration — no growth.' } },
    { label: 'Nested (O(n²))',code: 'let grid = 0;\n\nfor (let r = 0; r < 3; r++) {\n  for (let c = 0; c < 3; c++) {\n    grid = grid + 1;\n  }\n}',                                                          complexity: { time: 'O(n²)', space: 'O(1)', timeWhy: 'Outer loop runs n times, inner loop runs n times for EACH outer iteration → n × n = n² total operations. This is quadratic growth.',                     spaceWhy: 'Only 3 variables (grid, r, c). Nested loops don\'t automatically use more memory — only more TIME.' } },
  ];

  /** Add ForLoop-specific fields: loopIterations, conditionResult */
  function mapStep(s) {
    return {
      ...s,
      loopIterations:  s.loopIters || 0,
      conditionResult: s.cond,
    };
  }
</script>

<!-- ── ForLoop module ──────────────────────────────────────────────────────── -->
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

  <!-- CPU right-column registers: ITER + COND -->
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

  <!-- CPU right gauge: loop checks -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.comps || 0) * 10)} height="14" rx="2" fill="#a78bfa" opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.comps || 0} CHECKS</text>
  {/snippet}

  <!-- Loop iteration tracker strip -->
  {#snippet topPanel(sd)}
    {#if sd.loopIterations > 0 || (sd.phase && sd.phase.startsWith('loop'))}
      {#key sd}
        <div class="loop-vis">
          <div class="loop-vis-hdr">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="5" fill="none" stroke={ACCENT} stroke-width="1.5"/>
              <path d="M 9 4 L 11 7 L 9 10" fill="none" stroke={ACCENT} stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span class="loop-title">LOOP PROGRESS</span>
            <span class="loop-count">{sd.loopIterations} iteration{sd.loopIterations !== 1 ? 's' : ''}</span>
          </div>
          <svg viewBox="0 0 300 40" class="loop-svg">
            <rect x="10" y="15" width="280" height="10" rx="5" fill="#0d0d18" stroke="#1a1a2e" stroke-width="0.5"/>
            {#each Array(Math.min(sd.loopIterations, 20)) as _, idx}
              <rect x={10 + idx * 14} y="15" width="12" height="10" rx="3"
                fill={ACCENT} opacity={0.3 + (idx / Math.max(sd.loopIterations, 1)) * 0.7}/>
            {/each}
            <text x="10"  y="36" fill="#333"   font-size="6" font-family="monospace">1</text>
            <text x="290" y="36" text-anchor="end" fill={ACCENT} font-size="6" font-family="monospace">{sd.loopIterations}</text>
          </svg>
        </div>
      {/key}
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
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

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 200 140" class="ph-svg">
        <circle cx="100" cy="60" r="35" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-dasharray="6 3"/>
        <path d="M 120 40 L 130 60 L 120 80" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
        <text x="100" y="65" text-anchor="middle" fill="#1a1a2e" font-size="10" font-family="monospace">i++</text>
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

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
