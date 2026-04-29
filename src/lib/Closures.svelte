<script>
  import ModuleShell from './ModuleShell.svelte';
  import { dc, fv, tc, tb } from './utils.js';
  import { gsap } from 'gsap';

  const ACCENT = '#00d4aa';

  const examples = [
    {
      label: 'Basic closure',
      code: 'function makeCounter() {\n  let count = 0;\n  return function() {\n    count = count + 1;\n    return count;\n  };\n}\n\nlet counter = makeCounter();\nlet a = counter();\nlet b = counter();\nlet c = counter();',
      complexity: {
        time: 'O(1)', space: 'O(1)',
        timeWhy: 'Each counter() call does one increment — constant time regardless of how many times it has been called.',
        spaceWhy: 'The closure captures one variable (count). Memory is fixed — the closure scope never grows.',
      },
    },
    {
      label: 'Factory function',
      code: 'function makeMultiplier(x) {\n  return function(n) {\n    return n * x;\n  };\n}\n\nlet double = makeMultiplier(2);\nlet triple = makeMultiplier(3);\nlet a = double(5);\nlet b = triple(5);',
      complexity: {
        time: 'O(1)', space: 'O(1)',
        timeWhy: 'Each multiplier call does one multiplication — constant time.',
        spaceWhy: 'Each closure captures one variable (x). Two closures = two separate x values in memory, both fixed size.',
      },
    },
    {
      label: 'Private state',
      code: 'function createWallet(initial) {\n  let balance = initial;\n  function deposit(amount) {\n    balance = balance + amount;\n    return balance;\n  }\n  function getBalance() {\n    return balance;\n  }\n  return { deposit, getBalance };\n}\n\nlet wallet = createWallet(100);\nlet b1 = wallet.deposit(50);\nlet b2 = wallet.getBalance();',
      complexity: {
        time: 'O(1)', space: 'O(1)',
        timeWhy: 'Each method call does constant work — no loops or recursion.',
        spaceWhy: 'One closure scope with one private variable (balance). The returned object holds references, not copies.',
      },
    },
    {
      label: 'Memoization',
      code: 'function memoize(fn) {\n  let cache = {};\n  return function(n) {\n    if (cache[n] !== undefined) {\n      return cache[n];\n    }\n    let result = fn(n);\n    cache[n] = result;\n    return result;\n  };\n}\n\nfunction double(x) { return x * 2; }\nlet fastDouble = memoize(double);\nlet r1 = fastDouble(5);\nlet r2 = fastDouble(5);',
      complexity: {
        time: 'O(1) cached / O(n) uncached', space: 'O(n)',
        timeWhy: 'Cache hit is O(1) — one object lookup. Cache miss runs the original function. The closure makes the cache persist between calls.',
        spaceWhy: 'The cache object grows with each unique input. This is the memory trade-off of memoization — space for speed.',
      },
    },
    {
      label: 'Accumulator',
      code: 'function makeAccumulator(start) {\n  let running = start;\n  return function(items) {\n    for (let i = 0; i < items.length; i++) {\n      running = running + items[i];\n    }\n    return running;\n  };\n}\n\nlet acc = makeAccumulator(0);\nlet r1 = acc([1, 2, 3]);\nlet r2 = acc([10, 20]);',
      complexity: {
        time: 'O(n) per call', space: 'O(1)',
        timeWhy: 'Each call to acc() loops over items — linear in items.length. The closure adds zero overhead. Two calls: O(n₁ + n₂) total.',
        spaceWhy: 'The closure captures one variable (running). The loop uses one counter. Memory is constant — no new arrays created inside the closure.',
      },
    },
    {
      label: 'Closure loop trap',
      code: 'let funcs = [];\n\nfor (let i = 0; i < 3; i++) {\n  funcs[i] = function() {\n    return i;\n  };\n}\n\nlet r0 = funcs[0]();\nlet r1 = funcs[1]();\nlet r2 = funcs[2]();',
      complexity: {
        time: 'O(n)', space: 'O(n)',
        timeWhy: 'Loop runs n times creating n closures — linear time.',
        spaceWhy: 'All three closures share the same i variable. After the loop, i = 3, so every function returns 3. This is the classic "closure in a loop" trap. In full JS, using let creates a fresh binding per iteration — but here all closures see the final value.',
      },
    },
  ];

  /** Augment each step with closure-friendly display fields */
  function mapStep(s) {
    const chain = s.scopeChain || [{ name: 'Global', vars: dc(s.vars || {}), isClosure: false }];
    const closureFrames = chain.filter(f => f.isClosure);
    return {
      ...s,
      scopeChain: chain,
      closureVars: s.closureVars || {},
      scopeDepth: chain.length,
      capturedCount: closureFrames.reduce((acc, f) => acc + Object.keys(f.vars || {}).length, 0),
      currentFrame: closureFrames.map(f => f.name).join(', ') || 'Global',
    };
  }

  // ── GSAP actions ──────────────────────────────────────────────────────────
  function animateScopeCreate(node, { phase }) {
    function run(p) {
      if (p === 'closure-create') {
        gsap.fromTo(node, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' });
      }
    }
    run(phase);
    return { update({ phase: p }) { run(p); } };
  }

  function animateScopeCall(node, { phase, accent }) {
    function run(p) {
      if (p === 'closure-call') {
        gsap.fromTo(node,
          { boxShadow: `0 0 0 2px ${accent}` },
          { boxShadow: `0 0 0 0px ${accent}00`, duration: 0.8, ease: 'power2.out' }
        );
      }
    }
    run(phase);
    return { update({ phase: p }) { run(p); } };
  }

  /** Animate the capture bridge: slide-down on closure-create, pulse on closure-call */
  function animateCaptureRef(node, { phase }) {
    function run(p) {
      if (p === 'closure-create') {
        gsap.from(node, { opacity: 0, y: -6, duration: 0.55, ease: 'power2.out' });
      } else if (p === 'closure-call') {
        gsap.fromTo(node,
          { backgroundColor: `${ACCENT}18` },
          { backgroundColor: 'transparent', duration: 0.9, ease: 'power2.out' }
        );
      }
    }
    run(phase);
    return { update({ phase: p }) { run(p); } };
  }

  /** Flash a captured-variable row when the closure reads/writes it */
  function animateCaptureFlash(node, { active, accent }) {
    if (active) {
      gsap.fromTo(node,
        { backgroundColor: `${accent}30`, x: 2 },
        { backgroundColor: 'transparent', x: 0, duration: 0.7, ease: 'power2.out' }
      );
    }
    return { update({ active: a, accent: ac }) {
      if (a) gsap.fromTo(node,
        { backgroundColor: `${ac}30`, x: 2 },
        { backgroundColor: 'transparent', x: 0, duration: 0.7, ease: 'power2.out' }
      );
    }};
  }
</script>

<svelte:head>
  <title>JavaScript Closure Memory & Scope Tracer | Vivix</title>
  <meta name="description" content="See how JavaScript closures capture variables in memory. Watch the scope chain form in real-time and understand why closures work the way they do." />
</svelte:head>

<!-- ── Closures module ─────────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="closures"
  titlePrefix="closure"
  titleAccent="Scope"
  subtitle="— Closures & Scope"
  desc="Watch scope boxes nest inside each other — see which variables are captured and why they persist"
  interpreterOptions={{ trackCalls: true, trackClosures: true }}
  {mapStep}
  showHeap={false}
  moduleCaption="scope-chain ladder — each nested scope keeps a pointer to its parent, so inner functions can still read outer variables long after those functions have returned"
>

  <!-- Scope-chain ladder: nested boxes with captured variables highlighted -->
  {#snippet cpuModuleVisual(sd)}
    {@const chain = sd.scopeChain || []}
    {@const depth = sd.scopeDepth || chain.length || 1}
    {@const captured = sd.capturedCount || 0}
    {@const W = 520}
    {@const H = 110}
    {@const visible = chain.slice(-4)}
    {@const hiddenCount = chain.length - visible.length}

    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- Header -->
      <text x="12" y="14" fill="#e2e8f0" font-size="7.5" font-weight="700"
        font-family="'Geist Mono', monospace" letter-spacing="1">SCOPE CHAIN</text>
      <text x="510" y="14" text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace">inner ← outer · lookup walks outward</text>

      {#if hiddenCount > 0}
        <text x={W/2} y="26" text-anchor="middle" fill="#64748b" font-size="6.5"
          font-style="italic" font-family="'Geist Mono', monospace">
          +{hiddenCount} outer scope{hiddenCount === 1 ? '' : 's'}
        </text>
      {/if}

      {#if visible.length === 0}
        <text x={W/2} y={H/2} text-anchor="middle" fill="#94a3b8" font-size="9"
          font-family="'Geist Mono', monospace">no scope chain yet</text>
      {:else}
        {@const boxW = 118}
        {@const boxH = 54}
        {@const boxY = 30}
        {@const gap = 12}
        {@const totalW = visible.length * boxW + (visible.length - 1) * gap}
        {@const startX = (W - totalW) / 2}

        {#each visible as frame, i}
          {@const isInnermost = i === visible.length - 1}
          {@const isClosure = frame.isClosure}
          {@const fx = startX + i * (boxW + gap)}
          {@const varEntries = Object.entries(frame.vars || {}).slice(0, 3)}

          <!-- Scope box -->
          <rect x={fx} y={boxY} width={boxW} height={boxH} rx="4"
            fill={isInnermost ? `${ACCENT}1f` : isClosure ? '#1e293b' : '#0b0b14'}
            stroke={isInnermost ? ACCENT : isClosure ? ACCENT : '#334155'}
            stroke-width={isInnermost ? 1.8 : isClosure ? 1.3 : 1}
            stroke-dasharray={isClosure && !isInnermost ? '3 2' : ''}/>

          <!-- Frame name -->
          <text x={fx + 6} y={boxY + 11}
            fill={isInnermost ? ACCENT : isClosure ? ACCENT : '#cbd5e1'}
            font-size="8" font-weight="800"
            font-family="'Geist Mono', monospace" letter-spacing="0.3">
            {frame.name || 'anon'}{frame.name !== 'Global' ? '()' : ''}
          </text>

          <!-- Tag -->
          <text x={fx + boxW - 6} y={boxY + 11} text-anchor="end"
            fill={isClosure ? '#fbbf24' : '#64748b'} font-size="5.5" font-weight="700"
            font-family="'Geist Mono', monospace" letter-spacing="0.5">
            {isInnermost ? 'ACTIVE' : isClosure ? 'CAPTURED' : 'SCOPE'}
          </text>

          <!-- Variables -->
          {#each varEntries as [k, v], vi}
            <text x={fx + 8} y={boxY + 23 + vi * 10}
              fill={isClosure && !isInnermost ? '#fbbf24' : '#e2e8f0'}
              font-size="7" font-weight="600"
              font-family="'Geist Mono', monospace">
              {k}: {typeof v === 'string' ? `"${String(v).slice(0,5)}"` : typeof v === 'object' ? '{…}' : String(v).slice(0, 6)}
            </text>
          {/each}
          {#if Object.keys(frame.vars || {}).length === 0}
            <text x={fx + 8} y={boxY + 28}
              fill="#64748b" font-size="6.5" font-style="italic"
              font-family="'Geist Mono', monospace">(empty)</text>
          {/if}
          {#if Object.keys(frame.vars || {}).length > 3}
            <text x={fx + 8} y={boxY + 52}
              fill="#64748b" font-size="5.5"
              font-family="'Geist Mono', monospace">+{Object.keys(frame.vars).length - 3} more</text>
          {/if}

          <!-- Arrow to next (outer) scope -->
          {#if i < visible.length - 1}
            <line x1={fx + boxW} y1={boxY + boxH/2} x2={fx + boxW + gap} y2={boxY + boxH/2}
              stroke="#475569" stroke-width="1.2" marker-end="url(#cl-arrow)"/>
          {/if}
        {/each}

        <!-- Legend dot -->
        <circle cx="20" cy={H - 10} r="3" fill={ACCENT}/>
        <text x="28" y={H - 7} fill="#fbbf24" font-size="6.5" font-weight="600"
          font-family="'Geist Mono', monospace">captured = kept alive by inner fn</text>
      {/if}

      <!-- Depth stat -->
      <text x={W - 12} y={H - 18} text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace" letter-spacing="0.5">DEPTH {depth} · CAPTURED {captured}</text>

      <!-- Footer caption -->
      <text x={W/2} y={H - 1} text-anchor="middle"
        fill={ACCENT} font-size="7.5" font-weight="600"
        font-family="'Geist Mono', monospace">
        {captured > 0
          ? `${captured} variable${captured === 1 ? '' : 's'} captured — outer scope survives because inner function still references it`
          : depth > 1
            ? `nested ${depth} scopes deep — variable lookup walks outward until a match is found`
            : 'global scope — no closures yet'}
      </text>

      <defs>
        <marker id="cl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#475569"/>
        </marker>
      </defs>
    </svg>
  {/snippet}

  <!-- CPU registers: SCOPES / CAPTURED / FRAME -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="12" width="68" height="26" rx="4" fill="#08080e"
      stroke={sd.scopeDepth > 1 ? `${ACCENT}44` : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#e0e0e0" font-size="7" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">SCOPES</text>
    <text x="272" y="32" text-anchor="end" fill={sd.scopeDepth > 1 ? ACCENT : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.scopeDepth}</text>

    <rect x="284" y="12" width="66" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#e0e0e0" font-size="6.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.3">CAPTURED</text>
    <text x="344" y="32" text-anchor="end" fill={sd.capturedCount > 0 ? '#a78bfa' : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.capturedCount}</text>

    <rect x="210" y="42" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="52" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">FRAME</text>
    <text x="344" y="62" text-anchor="end" fill={ACCENT} font-size="12" font-weight="800" font-family="'Geist Mono', monospace">{sd.currentFrame.slice(0, 18)}</text>
  {/snippet}

  <!-- CPU gauge: captured var fill bar -->
  {#snippet cpuGauge(sd)}
    <rect x="210" y="72" width="140" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="211" y="73" width={Math.min(138, sd.capturedCount * 35)} height="14" rx="2" fill={ACCENT} opacity="0.25"/>
    <text x="280" y="83" text-anchor="middle" fill={ACCENT} font-size="9" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="0.5">{sd.capturedCount} CAPTURED</text>
  {/snippet}

  <!-- Nested scope diagram -->
  {#snippet topPanel(sd)}
    {@const chain = sd.scopeChain || []}
    {@const phase = sd.phase || ''}
    {@const closureFrames = chain.filter(f => f.isClosure)}
    {@const capturedNames = Object.keys(sd.closureVars || {})}
    {@const phaseLabel = phase === 'closure-create' ? 'CLOSURE CREATED'
      : phase === 'closure-call' ? 'CLOSURE CALLED'
      : phase === 'fn-call' ? 'FUNCTION CALL'
      : phase === 'fn-declare' ? 'FUNCTION DECLARED'
      : phase === 'assign' || phase === 'declare' ? 'VARIABLE WRITE'
      : phase === 'done' ? 'PROGRAM DONE'
      : phase === 'start' ? 'PROGRAM START'
      : (phase || 'STEP').toUpperCase()}
    {@const phaseColor = phase === 'closure-create' || phase === 'closure-call' ? ACCENT
      : phase === 'fn-call' || phase === 'fn-declare' ? '#a78bfa'
      : '#888'}
    {@const narrative = phase === 'closure-create'
        ? `An inner function was just created that uses ${capturedNames.length ? capturedNames.map(n => `\`${n}\``).join(', ') : 'outer variables'}. JavaScript keeps the outer scope alive in memory so the inner function can still read those variables later — that is the closure.`
      : phase === 'closure-call'
        ? `The closure ran. It looked up ${capturedNames.length ? capturedNames.map(n => `\`${n}\``).join(', ') : 'its captured variables'} from its remembered outer scope (not from Global), then returned a value.`
      : phase === 'fn-declare'
        ? 'A function was declared. It does not run yet — JavaScript only stores the code so it can be called later.'
      : phase === 'fn-call'
        ? 'A function is being called. A new scope is pushed onto the call stack for its local variables.'
      : phase === 'start'
        ? 'Program starting. Only the Global scope exists. As functions are declared and called, new scopes will appear here.'
      : phase === 'done'
        ? 'Program finished. Any closure scopes shown above stayed in memory the whole time, because something still references them.'
      : 'Stepping through the program — watch how the scope chain grows and shrinks.'}

    <div class="step-narrative">
      <div class="sn-row">
        <span class="sn-chip" style="color:{phaseColor};border-color:{phaseColor}55;background:{phaseColor}10">{phaseLabel}</span>
        <span class="sn-meta">scope depth {chain.length} · {closureFrames.length} closure{closureFrames.length === 1 ? '' : 's'} · {sd.capturedCount || 0} captured var{sd.capturedCount === 1 ? '' : 's'}</span>
      </div>
      <p class="sn-text">{narrative}</p>
    </div>

    <div class="scope-card">
      <div class="scope-card-hdr">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="1" y="1" width="12" height="12" rx="3" fill="none" stroke={ACCENT} stroke-width="1" opacity="0.5"/>
          <rect x="4" y="4" width="6" height="6" rx="2" fill={ACCENT} opacity="0.35"/>
        </svg>
        <span class="scope-card-title">SCOPE CHAIN — nested enclosures</span>
        <span class="scope-card-depth">depth: {chain.length}</span>
      </div>

      <!-- Scope tree: each scope is physically indented to show containment -->
      <div class="scope-tree">
        {#each chain as frame, fi}
          {@const isClosure = frame.isClosure}
          {@const isActive  = fi === chain.length - 1}
          {@const varEntries = Object.entries(frame.vars || {})}
          {@const closureVarNames = new Set(Object.keys(sd.closureVars || {}))}
          {@const indent = fi * 14}

          <div class="scope-row" style="padding-left:{indent}px">
            <!-- Connector line for nested scopes -->
            {#if fi > 0}
              <div class="scope-connector" style="left:{indent - 8}px"></div>
            {/if}

            <div
              class="scope-box"
              class:closure={isClosure}
              class:active={isActive}
              use:animateScopeCreate={{ phase: isClosure ? phase : '' }}
              use:animateScopeCall={{ phase: isActive ? phase : '', accent: ACCENT }}
              style="--acc:{ACCENT}"
            >
              <div class="scope-header">
                <!-- Scope type icon -->
                {#if isClosure}
                  <svg width="12" height="12" viewBox="0 0 12 12" class="scope-icon">
                    <rect x="1" y="3" width="10" height="8" rx="2" fill="none" stroke={ACCENT} stroke-width="1.2"/>
                    <path d="M4 3 V2 a2 2 0 0 1 4 0 V3" fill="none" stroke={ACCENT} stroke-width="1.2"/>
                    <circle cx="6" cy="7" r="1.5" fill={ACCENT} opacity="0.8"/>
                  </svg>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 12 12" class="scope-icon">
                    <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                  </svg>
                {/if}

                <span class="scope-name">{frame.name}</span>

                {#if isClosure}
                  <span class="closure-badge">
                    {phase === 'closure-create' && isActive ? 'created' : 'persists in memory'}
                  </span>
                {/if}
                {#if isActive && !isClosure}
                  <span class="scope-active-badge">active</span>
                {/if}
              </div>

              {#if varEntries.length > 0}
                <div class="scope-vars">
                  {#each varEntries as [vname, vval]}
                    {@const isCaptured = closureVarNames.has(vname)}
                    {@const color = tc(vval)}
                    <div class="scope-var" class:captured={isCaptured} style="--acc:{ACCENT}"
                      use:animateCaptureFlash={{ active: isCaptured && sd.highlight === vname, accent: ACCENT }}
                    >
                      {#if isCaptured}
                        <!-- Captured variable — show the backpack/link icon -->
                        <svg width="8" height="8" viewBox="0 0 8 8" class="capture-icon">
                          <path d="M2 4 L6 4 M4 2 L4 6" stroke={ACCENT} stroke-width="1.2" stroke-linecap="round"/>
                          <circle cx="4" cy="4" r="3" fill="none" stroke={ACCENT} stroke-width="0.8" opacity="0.5"/>
                        </svg>
                      {:else}
                        <div class="var-dot" style="background:{color}"></div>
                      {/if}
                      <span class="var-name">{vname}</span>
                      <span class="var-type" style="color:{color};border-color:{color}33">{tb(vval)}</span>
                      <span class="var-value" style="color:{color}">{fv(vval)}</span>
                      {#if isCaptured}
                        <span class="captured-tag">captured</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="scope-empty">— empty scope —</div>
              {/if}
            </div>
          </div>

          <!-- Capture bridge: visible arrow between outer scope and inner closure -->
          {#if !isClosure && fi + 1 < chain.length && chain[fi + 1]?.isClosure}
            {@const capturedFromThis = Object.keys(frame.vars || {}).filter(v => closureVarNames.has(v))}
            {#if capturedFromThis.length > 0}
              <div class="capture-bridge" style="padding-left:{indent + 22}px"
                use:animateCaptureRef={{ phase }}
              >
                <div class="bridge-rail"><div class="bridge-line-v"></div></div>
                <div class="bridge-content">
                  <span class="bridge-label">captured ↓</span>
                  <div class="bridge-vars">
                    {#each capturedFromThis as bvname}
                      <code class="bridge-var">{bvname}</code>
                    {/each}
                  </div>
                  <span class="bridge-note">live ref · mutations shared</span>
                </div>
              </div>
            {/if}
          {/if}
        {/each}

        <!-- Closure memory explanation when closures are present -->
        {#if chain.some(f => f.isClosure)}
          <div class="closure-explain">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="5" r="4" fill="none" stroke={ACCENT} stroke-width="1" opacity="0.6"/>
              <text x="5" y="8" text-anchor="middle" fill={ACCENT} font-size="7" font-family="'Geist Mono', monospace">!</text>
            </svg>
            <span><strong style="color:#00d4aa">Why this matters:</strong> the dashed boxes above are <strong>closure scopes</strong>. They stay alive in memory even after their outer function returned, because an inner function still references their variables. That is how the captured values (marked <em>captured</em>) survive between calls — and why each call you see in <strong>RESULT VARS</strong> can read or update them.</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Result vars -->
    {@const scalars = Object.entries(sd.vars || {}).filter(([,v]) => typeof v !== 'function' && !(v && typeof v === 'object'))}
    {#if scalars.length > 0}
      <div class="scalar-card">
        <div class="scalar-hdr">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke={ACCENT} stroke-width="1" opacity="0.4"/>
            <line x1="4" y1="6" x2="8" y2="6" stroke={ACCENT} stroke-width="1.5" opacity="0.6"/>
          </svg>
          <span class="scalar-title">RESULT VARS — values returned from closure calls</span>
          <span class="scalar-hint">each call reads & updates the captured scope above</span>
        </div>
        <div class="scalar-grid">
          {#each scalars as [vname, vval]}
            {@const color = tc(vval)}
            <div class="scalar-item">
              <span class="scalar-name">{vname}</span>
              <span class="scalar-sep">=</span>
              <span class="scalar-val" style="color:{color}">{fv(vval)}</span>
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
      depth {sd.scopeDepth}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.capturedCount} captured
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 220" class="ph-svg">
        <rect x="16" y="10" width="368" height="200" rx="8" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2.5"/>
        <text x="32" y="34" fill="rgba(255,255,255,0.80)" font-size="16" font-family="'Geist Mono', monospace" font-weight="700">Global</text>
        <rect x="36" y="44" width="328" height="154" rx="6" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"/>
        <text x="52" y="68" fill="rgba(255,255,255,0.75)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">makeCounter()</text>
        <rect x="56" y="78" width="288" height="108" rx="5" fill="rgba(0,212,170,0.06)" stroke="#00d4aa" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="74" y="104" fill="#00d4aa" font-size="15" font-family="'Geist Mono', monospace" font-weight="700">🔒 closure scope</text>
        <text x="74" y="128" fill="#00d4aa" font-size="15" font-family="'Geist Mono', monospace" font-weight="600">count: 0  ← captured</text>
        <text x="74" y="154" fill="rgba(255,255,255,0.65)" font-size="13" font-family="'Geist Mono', monospace">persists after outer fn returns</text>
        <text x="74" y="174" fill="rgba(255,255,255,0.65)" font-size="13" font-family="'Geist Mono', monospace">inner fn holds a reference</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see closure scopes</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* ── Scope chain card ──────────────────────────────────────────────────── */
  .scope-card       { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scope-card-hdr   { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scope-card-title { font-size:0.7rem; color:#aaa; font-family: var(--font-code); letter-spacing:1px; font-weight:700; }
  .scope-card-depth { margin-left:auto; font-size:0.62rem; color:#00d4aa; font-family: var(--font-code); }

  /* ── Scope tree ─────────────────────────────────────────────────────────── */
  .scope-tree  { padding:8px; display:flex; flex-direction:column; gap:4px; }

  .scope-row   { position:relative; }

  /* Vertical connector line from parent to child */
  .scope-connector {
    position:absolute;
    top:-4px;
    width:1px;
    height:calc(100% + 4px);
    background:linear-gradient(to bottom, #1a1a2e, #00d4aa33);
    pointer-events:none;
  }

  /* ── Individual scope boxes ────────────────────────────────────────────── */
  .scope-box {
    background:#08080e;
    border:1px solid #1a1a2e;
    border-radius:7px;
    overflow:hidden;
    transition:border-color 0.3s, background 0.3s;
  }
  .scope-box.closure {
    border-style:dashed;
    border-color:#00d4aa44;
    background:#00d4aa04;
  }
  .scope-box.active {
    border-color:#00d4aa66;
    background:#00d4aa08;
  }
  .scope-box.closure.active {
    border-color:#00d4aa88;
    background:#00d4aa10;
  }

  .scope-header {
    display:flex;
    align-items:center;
    gap:6px;
    padding:5px 10px;
    background:#0d0d16;
    border-bottom:1px solid #1a1a2e;
    font-size:0.78rem;
    color:#888;
    font-family: var(--font-code);
  }
  .scope-icon    { flex-shrink:0; }
  .scope-name    { color:#bbb; font-weight:700; }
  .scope-box.closure .scope-name { color:#00d4aa; }
  .scope-box.active .scope-name  { color:#e0e0e0; }

  .scope-active-badge  { margin-left:auto; font-size:0.58rem; color:#00d4aa; letter-spacing:0.5px; padding:1px 6px; border:1px solid #00d4aa44; border-radius:3px; background:#00d4aa10; }
  .closure-badge       { margin-left:auto; font-size:0.58rem; color:#00d4aa; letter-spacing:0.3px; padding:1px 6px; border:1px solid #00d4aa44; border-radius:3px; background:#00d4aa10; }

  .scope-vars  { display:flex; flex-direction:column; gap:3px; padding:6px 8px; }
  .scope-empty { padding:5px 10px; font-size:0.65rem; color:#444; font-family: var(--font-code); font-style:italic; }

  .scope-var {
    display:flex;
    align-items:center;
    gap:5px;
    padding:3px 6px;
    border-radius:4px;
    transition:background 0.2s;
  }
  .scope-var.captured {
    background:color-mix(in srgb, var(--acc) 8%, transparent);
    box-shadow:inset 3px 0 0 var(--acc);
  }

  .var-dot       { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
  .capture-icon  { flex-shrink:0; }
  .var-name      { font-size:0.82rem; color:#88aaff; font-family: var(--font-code); font-weight:600; min-width:55px; }
  .var-type      { font-size:0.55rem; padding:1px 5px; border-radius:2px; border:1px solid; font-family: var(--font-code); letter-spacing:0.3px; }
  .var-value     { font-size:0.82rem; font-weight:700; font-family: var(--font-code); margin-left:auto; min-width:40px; text-align:right; }
  .captured-tag  { font-size:0.55rem; color:#00d4aa; background:#00d4aa15; padding:1px 5px; border-radius:2px; border:1px solid #00d4aa33; white-space:nowrap; font-weight:600; }

  /* Capture bridge: shows captured vars flowing down from outer scope into closure */
  .capture-bridge {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    padding: 2px 0 3px;
  }
  .bridge-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 12px;
    padding-top: 4px;
  }
  .bridge-line-v {
    width: 1px;
    height: 20px;
    background: linear-gradient(to bottom, #00d4aa55, #00d4aa15);
  }
  .bridge-content {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #00d4aa08;
    border: 1px dashed #00d4aa25;
    border-radius: 4px;
    padding: 3px 8px;
    flex: 1;
  }
  .bridge-label {
    font-size: 0.58rem;
    color: #00d4aa;
    font-family: var(--font-code);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .bridge-vars  { display: flex; gap: 4px; flex-wrap: wrap; }
  .bridge-var {
    font-size: 0.7rem;
    color: #00d4aa;
    background: #00d4aa15;
    border: 1px solid #00d4aa33;
    border-radius: 3px;
    padding: 1px 6px;
    font-family: var(--font-code);
    font-weight: 600;
    font-style: normal;
  }
  .bridge-note {
    font-size: 0.55rem;
    color: #00d4aa88;
    font-family: var(--font-code);
    white-space: nowrap;
    margin-left: auto;
  }

  /* Closure explanation banner */
  .closure-explain {
    display:flex;
    align-items:flex-start;
    gap:6px;
    padding:5px 8px;
    background:#00d4aa08;
    border:1px dashed #00d4aa22;
    border-radius:5px;
    margin-top:2px;
  }
  .closure-explain span {
    font-size:0.7rem;
    color:#cfeee5;
    font-family: var(--font-sans, inherit);
    line-height:1.55;
  }

  /* ── Scalar result vars card ───────────────────────────────────────────── */
  .scalar-card  { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scalar-hdr   { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scalar-title { font-size:0.95rem; color:#e0e0e0; font-family: var(--font-code); letter-spacing:1px; font-weight:700; }
  .scalar-hint  { margin-left:auto; font-size:0.78rem; color:#888; font-family: var(--font-sans, inherit); }
  .scalar-grid  { display:flex; flex-wrap:wrap; gap:8px; padding:12px 14px; }
  .scalar-item  { display:flex; align-items:center; gap:8px; background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px 14px; }
  .scalar-name  { font-size:1rem; color:#88aaff; font-family: var(--font-code); font-weight:600; }
  .scalar-sep   { font-size:0.95rem; color:#555; }
  .scalar-val   { font-size:1rem; font-weight:700; font-family: var(--font-code); }

  /* ── Complexity live stats ─────────────────────────────────────────────── */
  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.7rem; color:#888; font-family: var(--font-code); }

  /* Step narrative panel */
  .step-narrative {
    background: linear-gradient(180deg, #0d0d16, #08080e);
    border:1px solid #1a1a2e;
    border-left:3px solid #00d4aa;
    border-radius:8px;
    padding:10px 14px;
    margin-bottom:8px;
    flex-shrink:0;
  }
  .sn-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
  .sn-chip {
    font-family: var(--font-code);
    font-size:0.6rem;
    font-weight:800;
    letter-spacing:1px;
    padding:2px 8px;
    border:1px solid;
    border-radius:4px;
    text-transform:uppercase;
  }
  .sn-meta { font-size:0.65rem; color:#666; font-family: var(--font-code); }
  .sn-text { margin:0; font-size:0.82rem; line-height:1.55; color:#d0d4dc; font-family: var(--font-sans, inherit); }

  /* ── Placeholder ───────────────────────────────────────────────────────── */
  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }
</style>
