<script>
  import ModuleShell from './ModuleShell.svelte';
  import { dc, fv, tc, tb } from './utils.js';
  import { animateFrame, animateVar, animateStackPush, animateValueFlow, animateReturnValue } from './animations.js';

  const ACCENT = '#ff8866';

  const examples = [
    { label: 'Simple function',   code: 'function double(x) {\n  let result = x * 2;\n  return result;\n}\n\nlet answer = double(21);',                                                                                                                       complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One multiplication and one assignment — constant work regardless of input value.',                                                                          spaceWhy: 'One local variable plus the parameter. The call stack grows by one frame then shrinks back.' } },
    { label: 'Two functions',     code: 'function add(a, b) {\n  return a + b;\n}\n\nfunction multiply(a, b) {\n  return a * b;\n}\n\nlet sum = add(3, 4);\nlet product = multiply(5, 6);',                                                                   complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Each function does one arithmetic op. Two calls = 2 × O(1) = still O(1).',                                                                             spaceWhy: 'Each call adds one frame with 2 params. Frames freed after return — never more than 1 extra frame at a time.' } },
    { label: 'Nested calls',      code: 'function square(n) {\n  return n * n;\n}\n\nfunction sumOfSquares(a, b) {\n  let s1 = square(a);\n  let s2 = square(b);\n  return s1 + s2;\n}\n\nlet result = sumOfSquares(3, 4);',                                 complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'sumOfSquares calls square twice. Each does constant work. Total: O(1).',                                                                                     spaceWhy: 'Max stack depth = 2 frames (Global → sumOfSquares → square). Still constant.' } },
    { label: 'With condition',    code: 'function checkAge(age) {\n  if (age >= 18) {\n    return "adult";\n  }\n  return "minor";\n}\n\nlet status = checkAge(25);',                                                                                         complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One comparison + one return. The if-branch does not add loops — constant time.',                                                                           spaceWhy: 'One parameter, no local vars. One stack frame created and destroyed.' } },
    { label: 'Recursive factorial', code: 'function factorial(n) {\n  if (n <= 1) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}\n\nlet result = factorial(5);', complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'factorial(5) calls factorial(4) … factorial(1) — n recursive calls each doing O(1) work. Total: O(n).', spaceWhy: 'Each recursive call adds a stack frame. factorial(5) builds 5 frames simultaneously — O(n) stack depth. Stack overflow risk for very large n.' } },
    { label: 'Greeting builder',  code: 'function greet(name) {\n  let msg = "Hello, " + name + "!";\n  return msg;\n}\n\nlet g1 = greet("Alice");\nlet g2 = greet("Bob");',                                                                               complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'String concatenation with fixed-length strings is constant. Two calls = 2 × O(1).',                                                                         spaceWhy: 'Each call allocates one string. After return, locals are garbage collected.' } },
  ];

  // Track last function return across steps
  let _lastFnReturn = null; // { fromFn, toVar, val }
  let _prevStack = [];

  /** Add FnCall-specific fields: calls, maxDepth, stack, frames, return info */
  function mapStep(s) {
    const stack = s.stack || ['Global'];

    // Detect fn-return: when stack shrinks
    if (s.phase === 'start') { _lastFnReturn = null; _prevStack = [...stack]; }
    else if (s.phase === 'fn-return') {
      const fromFn = _prevStack[_prevStack.length - 1] || '';
      _lastFnReturn = { fromFn, toVar: s.highlight || '', val: s.vars?.[s.highlight] };
    } else if (stack.length > _prevStack.length || s.phase === 'fn-call') {
      // New call — clear the return marker
      _lastFnReturn = null;
    }
    _prevStack = [...stack];

    return {
      ...s,
      calls:           s.calls    || 0,
      maxDepth:        s.maxDepth || 1,
      stack,
      frames:          s.frames   || { Global: dc(s.vars || {}) },
      conditionResult: s.cond,
      lastFnReturn:    _lastFnReturn ? { ..._lastFnReturn } : null,
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
  desc="Watch the call stack grow and shrink — see how values travel between functions"
  interpreterOptions={{ trackCalls: true }}
  {mapStep}
  showHeap={false}
>

  <!-- CPU right-column registers: DEPTH + CALLS + FRAME -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e"
      stroke={sd.stack.length > 1 ? 'rgba(255,136,102,0.4)' : 'rgba(255,255,255,0.08)'} stroke-width="1"/>
    <text x="216" y="22" fill="rgba(255,255,255,0.35)" font-size="6" font-family="monospace" letter-spacing="0.5">DEPTH</text>
    <text x="272" y="29" text-anchor="end" fill={sd.stack.length > 1 ? ACCENT : 'rgba(255,255,255,0.30)'} font-size="12" font-weight="800" font-family="monospace">{sd.stack.length}</text>

    <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <text x="290" y="22" fill="rgba(255,255,255,0.35)" font-size="6" font-family="monospace" letter-spacing="0.5">CALLS</text>
    <text x="344" y="29" text-anchor="end" fill={sd.calls > 0 ? '#a78bfa' : 'rgba(255,255,255,0.30)'} font-size="12" font-weight="800" font-family="monospace">{sd.calls}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <text x="216" y="48" fill="rgba(255,255,255,0.35)" font-size="6" font-family="monospace" letter-spacing="0.5">FRAME</text>
    <text x="344" y="55" text-anchor="end" fill={ACCENT} font-size="10" font-weight="700" font-family="monospace">{sd.stack[sd.stack.length - 1]}</text>
  {/snippet}

  <!-- CPU right gauge: max stack depth -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, (sd.maxDepth || 1) * 25)} height="14" rx="2" fill={ACCENT} opacity="0.3"/>
    <text x="252" y="79" fill="rgba(255,255,255,0.45)" font-size="6.5" font-family="monospace">MAX {sd.maxDepth || 1}</text>
  {/snippet}

  <!-- CPU stack visual override — shows actual frames -->
  {#snippet cpuStack(sd)}
    {#each [...sd.stack].reverse() as frame, i}
      {#if i < 3}
        <rect x="10" y={82 + i * 14} width="108" height="12" rx="3" fill="#0d0d18"
          stroke={i === 0 ? '#ff886644' : '#1a1a2e'} stroke-width="1"/>
        <text x="16" y={91 + i * 14} fill={i === 0 ? ACCENT : '#4ade80'} font-size="7" font-weight="600" font-family="monospace">{frame}</text>
        {#if i === 0}<text x="112" y={91 + i * 14} text-anchor="end" fill="rgba(255,255,255,0.35)" font-size="5.5" font-family="monospace">active</text>{/if}
      {/if}
    {/each}
  {/snippet}

  <!-- Call stack card + return value panel -->
  {#snippet topPanel(sd)}
    {#key sd}
      <!-- Return value banner — appears when function just returned -->
      {#if sd.lastFnReturn && sd.lastFnReturn.toVar}
        {@const ret = sd.lastFnReturn}
        {@const color = tc(ret.val)}
        <div class="return-banner">
          <div class="return-banner-row">
            <div class="ret-from">
              <span class="ret-fn-name">{ret.fromFn}()</span>
              <span class="ret-label">returned</span>
            </div>
            <div class="ret-arrow-track">
              <div class="ret-arrow-line"></div>
              <div class="ret-value-pill" style="color:{color};border-color:{color}44;background:{color}10"
                use:animateReturnValue={{ active: true, color }}>
                {fv(ret.val)}
              </div>
              <div class="ret-arrow-head">↑</div>
            </div>
            <div class="ret-to">
              <span class="ret-label">assigned to</span>
              <span class="ret-var-name" style="color:{color}">{ret.toVar}</span>
            </div>
          </div>
          <div class="ret-type-row">
            <span class="ret-type-tag" style="color:{color}">type: {typeof ret.val}</span>
            <span class="ret-cost">stack frame freed · memory reclaimed</span>
          </div>
        </div>
      {/if}

      <!-- Call Stack card -->
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
              use:animateStackPush={{ action: sd.phase === 'fn-call' && i === 0 ? 'push' : sd.phase === 'fn-return' && i === 0 ? 'pop' : null }}
            >
              <!-- Frame depth indicator -->
              <div class="stk-depth-bar" style="width:{Math.max(2, (sd.stack.length - i) * 6)}px; background:{i === 0 ? ACCENT : '#4ade80'}; opacity:0.4;"></div>

              <div class="stk-body">
                <div class="stk-top">
                  <span class="stk-name">{frame}</span>
                  {#if i === 0}<span class="stk-badge">← executing</span>{/if}
                  {#if frame === 'Global' && i !== 0}<span class="stk-badge stk-badge-global">base</span>{/if}
                </div>
                {#if sd.frames[frame]}
                  <div class="stk-vars">
                    {#each Object.entries(sd.frames[frame]) as [key, val]}
                      <div class="stk-var" class:stk-flash={sd.highlight === key}
                        use:animateValueFlow={{ active: sd.phase === 'fn-call' && i === 0 }}
                      >
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
            </div>
          {/each}
        </div>

        <!-- Stack memory model note -->
        <div class="stack-footer">
          <span class="stack-note">Each frame holds its own local scope — freed when function returns</span>
        </div>
      </div>
    {/key}
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
      <svg viewBox="0 0 200 150" class="ph-svg">
        <rect x="60" y="10" width="80" height="28" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1.5"/>
        <text x="100" y="28" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">ƒ double(x)</text>
        <line x1="100" y1="38" x2="100" y2="52" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <rect x="60" y="52" width="80" height="28" rx="4" fill="none" stroke="#1a1a2e" stroke-width="1.5"/>
        <text x="100" y="70" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">result = x * 2</text>
        <!-- Return arrow -->
        <line x1="100" y1="80" x2="100" y2="94" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <polygon points="96,90 104,90 100,98" fill="#1a1a2e" opacity="0.5"/>
        <text x="100" y="115" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">return 42</text>
        <text x="100" y="133" text-anchor="middle" fill="#1a1a2e" font-size="7" font-family="monospace">value travels back ↑</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see function calls in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Return value banner */
  .return-banner      { background:#ff886610; border:1px solid #ff886630; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .return-banner-row  { display:flex; align-items:center; gap:10px; padding:8px 12px; }
  .ret-from           { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
  .ret-fn-name        { font-size:0.75rem; color:#ff8866; font-weight:700; font-family:'SF Mono',monospace; }
  .ret-label          { font-size:0.48rem; color:rgba(255,255,255,0.42); font-family:monospace; text-transform:uppercase; letter-spacing:0.5px; }
  .ret-arrow-track    { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
  .ret-arrow-line     { width:1px; height:10px; background:linear-gradient(to top, #ff8866, transparent); }
  .ret-value-pill     { font-size:0.7rem; font-weight:800; font-family:'SF Mono',monospace; padding:3px 10px; border-radius:4px; border:1px solid; }
  .ret-arrow-head     { font-size:0.9rem; color:#ff8866; line-height:1; }
  .ret-to             { display:flex; flex-direction:column; align-items:flex-start; gap:2px; }
  .ret-var-name       { font-size:0.75rem; font-weight:700; font-family:'SF Mono',monospace; }
  .ret-type-row       { display:flex; justify-content:space-between; padding:3px 12px 6px; }
  .ret-type-tag       { font-size:0.45rem; font-family:monospace; }
  .ret-cost           { font-size:0.5rem; color:rgba(255,255,255,0.38); font-family:monospace; }

  /* Call stack card */
  .stack-card     {
    background: color-mix(in srgb, #ff8866 3%, #0a0a12);
    border: 1px solid color-mix(in srgb, #ff8866 18%, rgba(255,255,255,0.05));
    border-radius:10px; overflow:hidden; flex-shrink:0;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.3);
  }
  .stack-hdr      {
    display:flex; align-items:center; gap:6px; padding:7px 10px;
    background: color-mix(in srgb, #ff8866 5%, #0d0d16);
    border-bottom: 1px solid color-mix(in srgb, #ff8866 12%, rgba(255,255,255,0.04));
    position:relative;
  }
  .stack-hdr::before {
    content:''; position:absolute; top:0; left:0; right:0; height:1.5px;
    background: linear-gradient(90deg, transparent, rgba(255,136,102,0.6), transparent);
  }
  .stack-title    { font-size:0.58rem; color:rgba(255,255,255,0.55); font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .stack-depth    { margin-left:auto; font-size:0.52rem; color:#ff8866; font-family:monospace; font-weight:600; }
  .stack-frames   { padding:6px; display:flex; flex-direction:column; gap:4px; }

  .stk-frame      { display:flex; align-items:stretch; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.07); transition:all 0.3s; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }
  .stk-active     { border-color:#ff886655; background:rgba(255,136,102,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 12px rgba(255,136,102,0.08); }
  .stk-global     { border-color:rgba(74,222,128,0.2); }
  .stk-depth-bar  { flex-shrink:0; min-width:2px; }
  .stk-body       { flex:1; padding:5px 8px; }
  .stk-top        { display:flex; justify-content:space-between; align-items:center; }
  .stk-name       { font-size:0.78rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .stk-badge      { font-size:0.45rem; color:#ff8866; font-family:monospace; letter-spacing:0.5px; }
  .stk-badge-global { color:#4ade80; }
  .stk-vars       { display:flex; flex-direction:column; gap:2px; margin-top:4px; padding-top:4px; border-top:1px solid #1a1a2e; }
  .stk-var        { display:flex; align-items:center; gap:6px; padding:2px 4px; border-radius:3px; transition:all 0.3s; }
  .stk-flash      { background:#ff886618; box-shadow:inset 2px 0 0 #ff8866; }
  .stk-vname      { font-size:0.72rem; color:#88aaff; font-weight:600; font-family:'SF Mono',monospace; }
  .stk-vtype      { font-size:0.45rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; }
  .stk-vval       { margin-left:auto; font-size:0.72rem; font-weight:600; font-family:'SF Mono',monospace; }

  .stack-footer   { padding:5px 12px 7px; background:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.05); }
  .stack-note     { font-size:0.6rem; color:rgba(255,255,255,0.40); font-family:monospace; font-style:italic; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.8rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.58rem; color:rgba(255,255,255,0.45); font-family:monospace; }
</style>
