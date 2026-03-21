<script>
  import ModuleShell from './ModuleShell.svelte';
  import { dc, fv, tc, tb } from './utils.js';
  import { animateFrame, animateVar } from './animations.js';

  const ACCENT = '#ff8866';

  const examples = [
    { label: 'Simple function',   code: 'function double(x) {\n  let result = x * 2;\n  return result;\n}\n\nlet answer = double(21);',                                                                                                                       complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One multiplication and one assignment — constant work regardless of input value.',                                                                          spaceWhy: 'One local variable plus the parameter. The call stack grows by one frame then shrinks back.' } },
    { label: 'Two functions',     code: 'function add(a, b) {\n  return a + b;\n}\n\nfunction multiply(a, b) {\n  return a * b;\n}\n\nlet sum = add(3, 4);\nlet product = multiply(5, 6);',                                                                   complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Each function does one arithmetic op. Two calls = 2 × O(1) = still O(1).',                                                                             spaceWhy: 'Each call adds one frame with 2 params. Frames freed after return — never more than 1 extra frame at a time.' } },
    { label: 'Nested calls',      code: 'function square(n) {\n  return n * n;\n}\n\nfunction sumOfSquares(a, b) {\n  let s1 = square(a);\n  let s2 = square(b);\n  return s1 + s2;\n}\n\nlet result = sumOfSquares(3, 4);',                                 complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'sumOfSquares calls square twice. Each does constant work. Total: O(1).',                                                                                     spaceWhy: 'Max stack depth = 2 frames (Global → sumOfSquares → square). Still constant.' } },
    { label: 'With condition',    code: 'function checkAge(age) {\n  if (age >= 18) {\n    return "adult";\n  }\n  return "minor";\n}\n\nlet status = checkAge(25);',                                                                                         complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One comparison + one return. The if-branch does not add loops — constant time.',                                                                           spaceWhy: 'One parameter, no local vars. One stack frame created and destroyed.' } },
    { label: 'Greeting builder',  code: 'function greet(name) {\n  let msg = "Hello, " + name + "!";\n  return msg;\n}\n\nlet g1 = greet("Alice");\nlet g2 = greet("Bob");',                                                                               complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'String concatenation with fixed-length strings is constant. Two calls = 2 × O(1).',                                                                         spaceWhy: 'Each call allocates one string. After return, locals are garbage collected.' } },
  ];

  /** Add FnCall-specific fields: calls, maxDepth, stack, frames, conditionResult */
  function mapStep(s) {
    return {
      ...s,
      calls:           s.calls    || 0,
      maxDepth:        s.maxDepth || 1,
      stack:           s.stack    || ['Global'],
      frames:          s.frames   || { Global: dc(s.vars || {}) },
      conditionResult: s.cond,
    };
  }
</script>

<!-- ── FnCall module ───────────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="fn"
  titleAccent="Call"
  subtitle="— Functions"
  desc="Watch the call stack grow and shrink as functions execute, return, and pass values"
  interpreterOptions={{ trackCalls: true }}
  {mapStep}
  showHeap={false}
>

  <!-- CPU right-column registers: DEPTH + CALLS + FRAME -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e"
      stroke={sd.stack.length > 1 ? '#ff886633' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">DEPTH</text>
    <text x="272" y="29" text-anchor="end" fill={sd.stack.length > 1 ? ACCENT : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.stack.length}</text>

    <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">CALLS</text>
    <text x="344" y="29" text-anchor="end" fill={sd.calls > 0 ? '#a78bfa' : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.calls}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">FRAME</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="10" font-weight="700" font-family="monospace">{sd.stack[sd.stack.length - 1]}</text>
  {/snippet}

  <!-- CPU right gauge: max stack depth -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.maxDepth || 1) * 25)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">MAX {sd.maxDepth || 1}</text>
  {/snippet}

  <!-- CPU stack visual override — shows actual frames -->
  {#snippet cpuStack(sd)}
    {#each [...sd.stack].reverse() as frame, i}
      {#if i < 3}
        <rect x="10" y={82 + i * 14} width="108" height="12" rx="3" fill="#0d0d18"
          stroke={i === 0 ? '#ff886644' : '#1a1a2e'} stroke-width="1"/>
        <text x="16" y={91 + i * 14} fill={i === 0 ? ACCENT : '#4ade80'} font-size="7" font-weight="600" font-family="monospace">{frame}</text>
        {#if i === 0}<text x="112" y={91 + i * 14} text-anchor="end" fill="#333" font-size="5" font-family="monospace">active</text>{/if}
      {/if}
    {/each}
  {/snippet}

  <!-- Call stack card (replaces heap — showHeap=false above) -->
  {#snippet topPanel(sd)}
    <div class="stack-card">
      <div class="stack-hdr">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="2" y="1"   width="10" height="3" rx="1" fill={ACCENT} opacity="0.7"/>
          <rect x="2" y="5.5" width="10" height="3" rx="1" fill={ACCENT} opacity="0.4"/>
          <rect x="2" y="10"  width="10" height="3" rx="1" fill={ACCENT} opacity="0.2"/>
        </svg>
        <span class="stack-title">CALL STACK</span>
        <span class="stack-depth">depth: {sd.stack.length}</span>
      </div>
      <div class="stack-frames">
        {#each [...sd.stack].reverse() as frame, i}
          <div class="stk-frame"
            class:stk-active={i === 0}
            class:stk-global={frame === 'Global'}
            use:animateFrame={{ isNew: sd.phase === 'fn-call' && i === 0, step: sd }}
          >
            <div class="stk-top">
              <span class="stk-name">{frame}</span>
              {#if i === 0}<span class="stk-badge">← active</span>{/if}
            </div>
            {#if sd.frames[frame]}
              <div class="stk-vars">
                {#each Object.entries(sd.frames[frame]) as [key, val]}
                  <div class="stk-var" class:stk-flash={sd.highlight === key}>
                    <span class="stk-vname">{key}</span>
                    <span class="stk-vtype" style="color:{tc(val)}">{tb(val)}</span>
                    <span class="stk-vval" style="color:{tc(val)}"
                      use:animateVar={{ flash: sd.highlight === key, color: tc(val), step: sd }}
                    >{fv(val)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.calls} calls
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      depth {sd.maxDepth}
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
        <rect x="60" y="20" width="80" height="30" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="40" text-anchor="middle" fill="#1a1a2e" font-size="9" font-family="monospace">ƒ double(x)</text>
        <line x1="100" y1="50" x2="100" y2="70" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <rect x="60" y="70" width="80" height="30" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="90" text-anchor="middle" fill="#1a1a2e" font-size="9" font-family="monospace">return x * 2</text>
        <line x1="100" y1="100" x2="100" y2="120" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <text x="100" y="133" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">call → execute → return</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see function calls in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Call stack card */
  .stack-card   { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .stack-hdr    { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .stack-title  { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .stack-depth  { margin-left:auto; font-size:0.5rem; color:#ff8866; font-family:monospace; }
  .stack-frames { padding:6px; display:flex; flex-direction:column; gap:4px; }
  .stk-frame    { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:6px 8px; transition:all 0.3s; }
  .stk-active   { border-color:#ff886644; background:#ff886608; }
  .stk-global   { border-color:#4ade8022; }
  .stk-top      { display:flex; justify-content:space-between; align-items:center; }
  .stk-name     { font-size:0.78rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .stk-badge    { font-size:0.45rem; color:#ff8866; font-family:monospace; letter-spacing:0.5px; }
  .stk-vars     { display:flex; flex-direction:column; gap:2px; margin-top:4px; padding-top:4px; border-top:1px solid #1a1a2e; }
  .stk-var      { display:flex; align-items:center; gap:6px; padding:2px 4px; border-radius:3px; transition:all 0.3s; }
  .stk-flash    { background:#ff886618; box-shadow:inset 2px 0 0 #ff8866; }
  .stk-vname    { font-size:0.72rem; color:#88aaff; font-weight:600; font-family:'SF Mono',monospace; }
  .stk-vtype    { font-size:0.45rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; }
  .stk-vval     { margin-left:auto; font-size:0.72rem; font-weight:600; font-family:'SF Mono',monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
