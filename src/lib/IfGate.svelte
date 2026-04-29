<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv } from './utils.js';
  import { animatePathSequenced, animateBall, animateDiamondFlash, animateBlockReveal, animateSubExpr } from './animations.js';
  import { splitCondition, substituteVars, extractBodies } from './condition-utils.js';

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
  let _subExprs = [];
  let _hasElse  = false;
  let _ifBody   = [];
  let _elseBody = [];

  function mapStep(s, codeLines) {
    if (s.phase === 'start') {
      _lastCond = null;
      _lastRaw  = '';
      _lastSub  = '';
      _subExprs = [];
      const bodies = extractBodies(codeLines);
      _hasElse  = bodies.hasElse;
      _ifBody   = bodies.ifBody;
      _elseBody = bodies.elseBody;
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
        // Build sub-expression evaluation steps
        const parts = splitCondition(condRaw);
        _subExprs = parts.map((part, idx) => {
          const isOp = part === '&&' || part === '||';
          return {
            raw: part,
            substituted: isOp ? part : substituteVars(part, s.vars),
            isOperator: isOp,
            index: idx,
          };
        });
      }
    } else if (s.cond !== undefined) {
      _lastCond = s.cond;
    }

    return {
      ...s,
      condRaw:  condRaw  || _lastRaw,
      condSub:  condSub  || _lastSub,
      lastCond: _lastCond,
      subExprs: _subExprs,
      hasElse:  _hasElse,
      ifBody:   _ifBody,
      elseBody: _elseBody,
    };
  }
</script>

<svelte:head>
  <title>JS Branching Logic & Condition Visualizer | Vivix</title>
  <meta name="description" content="Watch how the JavaScript engine evaluates conditions and processes if-else branching. See exactly which path the engine takes and why." />
</svelte:head>

<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="if-gate"
  titlePrefix="if"
  titleAccent="Gate"
  subtitle="— Conditionals"
  {mapStep}
  dataFlow
  interpreterOptions={{ trackIf: true }}
  moduleCaption="condition evaluation — operands fed into the comparison, boolean result, branch taken"
>

  <!-- Truth-evaluation diagram: condition → diamond → branch path -->
  {#snippet cpuModuleVisual(sd)}
    {@const cond  = sd.lastCond}
    {@const raw   = sd.lastRaw || ''}
    {@const comps = sd.comps || 0}
    {@const W = 520}
    {@const H = 110}

    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- Header -->
      <text x="12" y="14" fill="#e2e8f0" font-size="7.5" font-weight="700"
        font-family="'Geist Mono', monospace" letter-spacing="1">CONDITION EVALUATION</text>
      <text x="510" y="14" text-anchor="end" fill="#94a3b8" font-size="6.5"
        font-family="'Geist Mono', monospace">expression → diamond → branch</text>

      <!-- Condition expression box -->
      <rect x="12" y="28" width="180" height="32" rx="4"
        fill="#0b0b14" stroke={raw ? ACCENT : '#1a1a2e'} stroke-width={raw ? 1.5 : 1}/>
      <text x="20" y="40" fill="#94a3b8" font-size="6.5" font-weight="600"
        font-family="'Geist Mono', monospace" letter-spacing="0.8">EXPRESSION</text>
      <text x="20" y="54" fill={raw ? '#f1f5f9' : '#64748b'} font-size="9" font-weight="700"
        font-family="'Geist Mono', monospace">{raw ? (raw.length > 24 ? raw.slice(0, 22) + '…' : raw) : 'awaiting if/else'}</text>

      <!-- Arrow from expression to diamond -->
      <line x1="195" y1="44" x2="225" y2="44"
        stroke={raw ? ACCENT : '#334155'} stroke-width="1.5"
        marker-end="url(#ifg-arrow-{raw ? 'a' : 'i'})"/>

      <!-- Decision diamond -->
      {@const dx = 250} {@const dy = 44}
      <polygon points="{dx},{dy-18} {dx+30},{dy} {dx},{dy+18} {dx-30},{dy}"
        fill={cond === true ? '#4ade8014' : cond === false ? '#f8717114' : '#0b0b14'}
        stroke={cond === true ? '#4ade80' : cond === false ? '#f87171' : raw ? ACCENT : '#334155'}
        stroke-width="1.5"/>
      <text x={dx} y={dy + 3} text-anchor="middle"
        fill={cond === true ? '#4ade80' : cond === false ? '#f87171' : raw ? ACCENT : '#94a3b8'}
        font-size="9" font-weight="800"
        font-family="'Geist Mono', monospace">
        {cond === true ? 'T' : cond === false ? 'F' : '?'}
      </text>

      <!-- TRUE branch (top arrow) -->
      <line x1={dx + 24} y1={dy - 10} x2="380" y2="32"
        stroke={cond === true ? '#4ade80' : '#1a1a2e'}
        stroke-width={cond === true ? 2 : 1}
        opacity={cond === true ? 1 : 0.4}
        marker-end="url(#ifg-arrow-t)"/>
      <rect x="382" y="20" width="86" height="22" rx="3"
        fill={cond === true ? '#4ade8014' : '#0b0b14'}
        stroke={cond === true ? '#4ade80' : '#334155'}
        stroke-width={cond === true ? 1.5 : 1}/>
      <text x="425" y="34" text-anchor="middle"
        fill={cond === true ? '#4ade80' : '#64748b'}
        font-size="8.5" font-weight="700"
        font-family="'Geist Mono', monospace">if &#123; ... &#125;</text>

      <!-- FALSE branch (bottom arrow) -->
      <line x1={dx + 24} y1={dy + 10} x2="380" y2="58"
        stroke={cond === false ? '#f87171' : '#1a1a2e'}
        stroke-width={cond === false ? 2 : 1}
        opacity={cond === false ? 1 : 0.4}
        marker-end="url(#ifg-arrow-f)"/>
      <rect x="382" y="48" width="86" height="22" rx="3"
        fill={cond === false ? '#f8717114' : '#0b0b14'}
        stroke={cond === false ? '#f87171' : '#334155'}
        stroke-width={cond === false ? 1.5 : 1}/>
      <text x="425" y="62" text-anchor="middle"
        fill={cond === false ? '#f87171' : '#64748b'}
        font-size="8.5" font-weight="700"
        font-family="'Geist Mono', monospace">else &#123; ... &#125;</text>

      <!-- Comparison counter -->
      <text x="476" y="34" fill="#94a3b8" font-size="6"
        font-family="'Geist Mono', monospace" letter-spacing="0.5">CMPS</text>
      <text x="476" y="46" fill={ACCENT} font-size="11" font-weight="800"
        font-family="'Geist Mono', monospace">{comps}</text>

      <!-- Footer caption -->
      <text x={W/2} y={H - 6} text-anchor="middle"
        fill={cond === true ? '#4ade80' : cond === false ? '#f87171' : ACCENT}
        font-size="7.5" font-weight="600" font-family="'Geist Mono', monospace">
        {cond === true  ? 'condition truthy → if-branch executes, else-branch skipped'
        : cond === false ? 'condition falsy → if-branch skipped, else-branch executes'
        : raw            ? 'evaluating operands…'
        : 'awaiting condition'}
      </text>

      <defs>
        <marker id="ifg-arrow-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={ACCENT}/>
        </marker>
        <marker id="ifg-arrow-i" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#334155"/>
        </marker>
        <marker id="ifg-arrow-t" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={cond === true ? '#4ade80' : '#334155'}/>
        </marker>
        <marker id="ifg-arrow-f" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={cond === false ? '#f87171' : '#334155'}/>
        </marker>
      </defs>
    </svg>
  {/snippet}

  {#snippet cpuRegisters(sd)}
    <rect x="210" y="12" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="22" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="32" text-anchor="end" fill={sd.highlight ? '#fbbf24' : '#bbb'} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="42" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="52" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">RESULT</text>
    {#if sd.lastCond === true}
      <circle cx="334" cy="56" r="5" fill="#4ade80"/>
      <text x="324" y="61" text-anchor="end" fill="#4ade80" font-size="13" font-weight="800" font-family="'Geist Mono', monospace">TRUE</text>
    {:else if sd.lastCond === false}
      <circle cx="334" cy="56" r="5" fill="#f87171"/>
      <text x="324" y="61" text-anchor="end" fill="#f87171" font-size="13" font-weight="800" font-family="'Geist Mono', monospace">FALSE</text>
    {:else if sd.changed}
      <text x="344" y="61" text-anchor="end" fill="#f59e0b" font-size="12" font-weight="700" font-family="'Geist Mono', monospace">{fv(sd.changed.to)}</text>
    {:else}
      <text x="344" y="61" text-anchor="end" fill="#bbb" font-size="12" font-family="'Geist Mono', monospace">—</text>
    {/if}
  {/snippet}

  {#snippet cpuGauge(sd)}
    <rect x="210" y="72" width="140" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="211" y="73" width={Math.min(138, (sd.comps || 0) * 30)} height="14" rx="2" fill="#a78bfa" opacity="0.25"/>
    <text x="280" y="83" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="0.5">{sd.comps || 0} COMPARES</text>
  {/snippet}

  {#snippet topPanel(sd)}
    {#if sd.lastCond !== null && sd.condRaw}
      {@const cond    = sd.lastCond}
      {@const isLive  = sd.phase === 'condition'}
      {@const isBranch = sd.phase === 'branch' || sd.phase === 'assign' || sd.phase === 'done'}
      {@const takenColor = cond ? '#4ade80' : '#f87171'}
      {@const ifBodyLines  = sd.ifBody || []}
      {@const elseBodyLines = sd.elseBody || []}
      {@const hasElse = sd.hasElse}
      {@const maxBodyLines = Math.max(ifBodyLines.length, elseBodyLines.length, 0)}
      {@const svgH = 185 + maxBodyLines * 12}
      {#key sd}
        <div class="branch-card">

          <!-- ── Step-by-step sub-expression evaluation ─────────────── -->
          {#if sd.subExprs && sd.subExprs.length > 0}
            <div class="eval-row" aria-live="polite" aria-label="Condition evaluation">
              <span class="eval-label">Evaluated:</span>
              <div class="eval-chips">
                {#each sd.subExprs as expr, idx}
                  {#if expr.isOperator}
                    <span class="eval-op" use:animateSubExpr={{ active: isLive, delay: idx * 0.15 }}>{expr.raw}</span>
                  {:else}
                    <span class="eval-chip" use:animateSubExpr={{ active: isLive, delay: idx * 0.15 }}>
                      <span class="eval-chip-raw">{expr.raw}</span>
                      <span class="eval-chip-arrow">→</span>
                      <span class="eval-chip-val">{expr.substituted}</span>
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- ── Condition expression row ───────────────────────────── -->
          <div class="cond-row">
            <span class="cond-expr">{sd.condRaw}</span>
            <span class="cond-arrow">→</span>
            <span class="cond-sub">{sd.condSub}</span>
            <span class="cond-badge" class:badge-true={cond} class:badge-false={!cond}>
              {cond ? '✓ TRUE' : '✗ FALSE'}
            </span>
          </div>

          <!-- ── Enhanced SVG flowchart ─────────────────────────────── -->
          <svg viewBox="0 0 300 {svgH}" class="branch-svg">
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#4ade80" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#4ade80" stop-opacity="0.04"/>
              </linearGradient>
              <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#f87171" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#f87171" stop-opacity="0.04"/>
              </linearGradient>
              <filter id="glow-t" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="#4ade80" flood-opacity="0.4" result="color"/>
                <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-f" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="#f87171" flood-opacity="0.4" result="color"/>
                <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <!-- ── Decision diamond with flash animation ──────────── -->
            <polygon points="150,8 198,42 150,76 102,42" fill="#0d0d18"
              stroke={takenColor} stroke-width="2.5"
              use:animateDiamondFlash={{ active: isLive, color: takenColor }}/>

            <!-- Diamond label: 'if' keyword on top, boolean result below -->
            <text x="150" y="34" text-anchor="middle" fill="#e0e0e0" font-size="8" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">if (…)</text>
            <text x="150" y="54" text-anchor="middle" fill={takenColor} font-size="15" font-weight="900" font-family="'Geist Mono', monospace" letter-spacing="1">
              {cond ? 'TRUE' : 'FALSE'}
            </text>

            <!-- ── TRUE path (left) with glow — sequenced 0.3s after diamond ── -->
            <path use:animatePathSequenced={{ delay: 0.3 }}
              d="M 126 64 C 96 88, 62 100, 56 128" fill="none"
              stroke={cond ? '#4ade80' : '#1c1c30'}
              stroke-width={cond ? 2.5 : 1} stroke-linecap="round"
              filter={cond && isBranch ? 'url(#glow-t)' : 'none'}/>

            <!-- ── FALSE path (right) with glow — sequenced 0.3s after diamond ── -->
            <path use:animatePathSequenced={{ delay: 0.3 }}
              d="M 174 64 C 204 88, 238 100, 244 128" fill="none"
              stroke={!cond ? '#f87171' : '#1c1c30'}
              stroke-width={!cond ? 2.5 : 1} stroke-linecap="round"
              filter={!cond && isBranch ? 'url(#glow-f)' : 'none'}/>

            <!-- T / F labels -->
            <text x="84"  y="82" fill={cond  ? '#4ade80' : '#2a2a42'} font-size="11" font-weight="900" font-family="'Geist Mono', monospace">T</text>
            <text x="210" y="82" fill={!cond ? '#f87171' : '#2a2a42'} font-size="11" font-weight="900" font-family="'Geist Mono', monospace">F</text>

            <!-- ── IF block with reveal animation ────────────────── -->
            <g use:animateBlockReveal={{ taken: cond, delay: 0.6 }}>
              <rect x="6" y="128" width="102" height={46 + ifBodyLines.length * 12} rx="6"
                fill={cond ? 'url(#tg)' : '#090910'}
                stroke={cond ? '#4ade80' : '#1a1a2e'} stroke-width={cond ? 2 : 1}/>
              <text x="57" y="143" text-anchor="middle"
                fill={cond ? '#4ade80' : '#252535'} font-size="11" font-weight="700" font-family="'Geist Mono', monospace">if {'{'}</text>

              <!-- Show actual code lines inside the block -->
              {#each ifBodyLines as line, li}
                <text x="57" y={156 + li * 12} text-anchor="middle"
                  fill={cond ? '#4ade80aa' : '#252535'} font-size="7" font-family="'Geist Mono', monospace">
                  {line.length > 18 ? line.slice(0, 16) + '…' : line}
                </text>
              {/each}

              <text x="57" y={156 + ifBodyLines.length * 12} text-anchor="middle"
                fill={cond ? '#4ade80' : '#252535'} font-size="11" font-weight="700" font-family="'Geist Mono', monospace">{'}'}</text>

              {#if cond}
                <text x="57" y={170 + ifBodyLines.length * 12} text-anchor="middle"
                  fill="#4ade8088" font-size="7" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="1">EXECUTED</text>
              {:else}
                <text x="57" y={170 + ifBodyLines.length * 12} text-anchor="middle"
                  fill="#f8717155" font-size="6.5" font-family="'Geist Mono', monospace" letter-spacing="0.5">SKIPPED</text>
              {/if}
            </g>

            <!-- ── ELSE block with reveal animation ──────────────── -->
            {#if hasElse}
              <g use:animateBlockReveal={{ taken: !cond, delay: 0.6 }}>
                <rect x="192" y="128" width="102" height={46 + elseBodyLines.length * 12} rx="6"
                  fill={!cond ? 'url(#fg)' : '#090910'}
                  stroke={!cond ? '#f87171' : '#1a1a2e'} stroke-width={!cond ? 2 : 1}/>
                <text x="243" y="143" text-anchor="middle"
                  fill={!cond ? '#f87171' : '#252535'} font-size="11" font-weight="700" font-family="'Geist Mono', monospace">else {'{'}</text>

                {#each elseBodyLines as line, li}
                  <text x="243" y={156 + li * 12} text-anchor="middle"
                    fill={!cond ? '#f87171aa' : '#252535'} font-size="7" font-family="'Geist Mono', monospace">
                    {line.length > 18 ? line.slice(0, 16) + '…' : line}
                  </text>
                {/each}

                <text x="243" y={156 + elseBodyLines.length * 12} text-anchor="middle"
                  fill={!cond ? '#f87171' : '#252535'} font-size="11" font-weight="700" font-family="'Geist Mono', monospace">{'}'}</text>

                {#if !cond}
                  <text x="243" y={170 + elseBodyLines.length * 12} text-anchor="middle"
                    fill="#f8717188" font-size="7" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="1">EXECUTED</text>
                {:else}
                  <text x="243" y={170 + elseBodyLines.length * 12} text-anchor="middle"
                    fill="#4ade8055" font-size="6.5" font-family="'Geist Mono', monospace" letter-spacing="0.5">SKIPPED</text>
                {/if}
              </g>
            {:else}
              <!-- No else — just show a ghost else block -->
              <g opacity="0.15">
                <rect x="192" y="128" width="102" height="46" rx="6"
                  fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="243" y="155" text-anchor="middle"
                  fill="#1a1a2e" font-size="9" font-family="'Geist Mono', monospace">no else</text>
              </g>
            {/if}

            <!-- ── Result badge ──────────────────────────────────── -->
            <rect x={cond ? 18 : 204} y="110" width="64" height="16" rx="8"
              fill={cond ? '#4ade8028' : '#f8717128'}
              filter={isBranch ? (cond ? 'url(#glow-t)' : 'url(#glow-f)') : 'none'}/>
            <text x={cond ? 50 : 236} y="121" text-anchor="middle"
              fill={takenColor} font-size="8" font-weight="700" font-family="'Geist Mono', monospace">
              {cond ? '✓ TRUE' : '✗ FALSE'}
            </text>

            <!-- ── Animated ball ──────────────────────────────────── -->
            {#if isLive}
              <circle r="6" fill={takenColor} opacity="0.9"
                filter={cond ? 'url(#glow-t)' : 'url(#glow-f)'}
                use:animateBall={{ taken: cond, step: sd }}/>
            {:else}
              <circle cx={cond ? 57 : 243} cy="157" r="4"
                fill={takenColor} opacity="0.45"/>
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
      <svg viewBox="0 0 400 220" class="ph-svg">
        <polygon points="200,20 270,75 200,130 130,75" fill="rgba(74,222,128,0.05)" stroke="rgba(74,222,128,0.55)" stroke-width="2.5" stroke-dasharray="6 3"/>
        <text x="200" y="82" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="18" font-family="'Geist Mono', monospace" font-weight="600">condition?</text>
        <path d="M 158 112 Q 110 150 88 188" fill="none" stroke="rgba(74,222,128,0.45)" stroke-width="2.5" stroke-dasharray="5 3"/>
        <path d="M 242 112 Q 290 150 312 188" fill="none" stroke="rgba(248,113,113,0.45)" stroke-width="2.5" stroke-dasharray="5 3"/>
        <rect x="28"  y="186" width="120" height="30" rx="5" fill="rgba(74,222,128,0.07)" stroke="rgba(74,222,128,0.50)" stroke-width="2" stroke-dasharray="5 3"/>
        <rect x="252" y="186" width="120" height="30" rx="5" fill="rgba(248,113,113,0.07)" stroke="rgba(248,113,113,0.50)" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="88"  y="207" text-anchor="middle" fill="rgba(74,222,128,0.90)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">if {'{'} {'}'}</text>
        <text x="312" y="207" text-anchor="middle" fill="rgba(248,113,113,0.90)" font-size="16" font-family="'Geist Mono', monospace" font-weight="600">else {'{'} {'}'}</text>
      </svg>
      <p class="ph-text">Click <strong style="color:{ACCENT}">▶ Visualize</strong> to see the execution flow</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .branch-card { background:var(--a11y-surface1); border:1px solid var(--a11y-border); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .branch-svg  { width:100%; height:auto; display:block; }

  /* ── Sub-expression evaluation row ─────────────────────── */
  .eval-row    { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--a11y-surface2); border-bottom:1px solid var(--a11y-border); flex-wrap:wrap; }
  .eval-label  { font-size:0.6rem; color:rgba(255,255,255,0.42); font-family: var(--font-code); text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0; }
  .eval-chips  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .eval-chip   { display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:4px; padding:3px 8px; }
  .eval-chip-raw   { font-size:0.62rem; color:rgba(255,255,255,0.75); font-family: var(--font-code); font-weight:600; }
  .eval-chip-arrow { font-size:0.5rem; color:rgba(255,255,255,0.35); }
  .eval-chip-val   { font-size:0.62rem; color:#ff8866; font-family: var(--font-code); font-weight:700; }
  .eval-op     { font-size:0.62rem; color:#a78bfa; font-family: var(--font-code); font-weight:800; padding:2px 4px; }

  /* ── Condition expression row ───────────────────────────── */
  .cond-row    { display:flex; align-items:center; gap:6px; padding:7px 12px; background:#0d0d16; border-bottom:1px solid #1a1a2e; flex-wrap:wrap; }
  .cond-expr   { font-size:0.72rem; color:#ccc; font-family: var(--font-code); font-weight:600; }
  .cond-arrow  { font-size:0.6rem; color:#333; }
  .cond-sub    { font-size:0.65rem; color:#888; font-family: var(--font-code); background:#ffffff06; padding:1px 5px; border-radius:3px; }
  .cond-badge  { margin-left:auto; font-size:0.6rem; font-family: var(--font-code); font-weight:700; padding:2px 8px; border-radius:4px; }
  .badge-true  { color:#4ade80; background:#4ade8018; border:1px solid #4ade8033; }
  .badge-false { color:#f87171; background:#f8717118; border:1px solid #f8717133; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family: var(--font-code); }

  /* ── Responsive ─────────────────────────────────────────── */
  @media (max-width: 480px) {
    .eval-row   { padding:6px 8px; gap:5px; }
    .eval-chip  { padding:2px 5px; }
    .eval-chip-raw, .eval-chip-val { font-size:0.55rem; }
    .cond-row   { padding:5px 8px; gap:4px; }
    .cond-expr  { font-size:0.62rem; }
    .cond-sub   { font-size:0.58rem; }
  }
</style>
