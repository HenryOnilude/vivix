<script>
  /**
   * CpuDash — reusable CPU dashboard SVG shared by all 12 modules.
   *
   * Props:
   *   sd          — current step data (raw interpreter step)
   *   step        — current step index
   *   total       — total step count
   *   accent      — module accent colour string
   *   phColor     — (phase: string) => colour string
   *
   * Snippets (Svelte 5):
   *   registers(sd) — SVG elements for the right-column registers (x ≥ 210)
   *   gauge(sd)     — SVG elements for the bottom-right gauge bar
   *   stack(sd)     — optional override for the bottom-left call-stack visual
   *
   * Optional props:
   *   moduleCaption — short plain-English description of what the MODULE
   *                   cell registers/gauge represent for this specific module.
   *                   Replaces the generic "module-specific state" subtitle.
   */

  /** @type {{ sd: object, step: number, total: number, accent: string, phColor: (ph:string)=>string, explainMode?: string, onToggleMode?: ()=>void, registers?: import('svelte').Snippet, gauge?: import('svelte').Snippet, stack?: import('svelte').Snippet, moduleCaption?: string, moduleVisual?: import('svelte').Snippet }} */
  let { sd, step, total, accent, phColor, explainMode = 'simple', onToggleMode, registers, gauge, stack: stackSnippet, moduleCaption = '', moduleVisual } = $props();

  /** Map execution phase to the operation symbol shown inside the CPU chip */
  function phSymbol(ph) {
    if (ph === 'declare')           return '+';
    if (ph === 'assign')            return '←';
    if (ph === 'condition')         return '?';
    if (ph === 'else-enter')        return '↵';
    if (ph === 'skip')              return '⤳';
    if (ph === 'output')            return '▸';
    if (ph === 'done')              return '✓';
    if (ph === 'loop-init')         return '⊞';
    if (ph === 'loop-check' || ph === 'loop-test') return '?';
    if (ph === 'loop-update')       return '↻';
    if (ph === 'loop-exit')         return '⏹';
    if (ph === 'fn-call')           return 'ƒ↓';
    if (ph === 'fn-return')         return '↑R';
    if (ph === 'fn-return-assign')  return '←R';
    if (ph === 'fn-declare')        return 'ƒ+';
    return '▷';
  }

  /** Map phase to a human-readable label and icon */
  function phInfo(ph) {
    const map = {
      'start':           { label: 'Engine Startup',       icon: '⚡', color: '#4ade80' },
      'declare':         { label: 'Variable Declaration',  icon: '📦', color: '#38bdf8' },
      'assign':          { label: 'Value Assignment',      icon: '✏️', color: '#f59e0b' },
      'condition':       { label: 'Condition Check',       icon: '🔀', color: '#a78bfa' },
      'else-enter':      { label: 'Else Branch',           icon: '↪️', color: '#f87171' },
      'skip':            { label: 'Branch Skipped',        icon: '⏭️', color: '#555'    },
      'output':          { label: 'Console Output',        icon: '📤', color: '#34d399' },
      'done':            { label: 'Program Complete',      icon: '✅', color: '#4ade80' },
      'error':           { label: 'Runtime Error',         icon: '❌', color: '#ef4444' },
      'loop-init':       { label: 'Loop Initialize',       icon: '🔄', color: '#818cf8' },
      'loop-test':       { label: 'Loop Test',             icon: '❓', color: '#818cf8' },
      'loop-check':      { label: 'Loop Check',            icon: '❓', color: '#818cf8' },
      'loop-update':     { label: 'Loop Update',           icon: '🔁', color: '#818cf8' },
      'loop-body':       { label: 'Loop Body',             icon: '⚙️', color: '#818cf8' },
      'loop-exit':       { label: 'Loop Exit',             icon: '🛑', color: '#f87171' },
      'fn-declare':      { label: 'Function Declared',     icon: '📝', color: '#c084fc' },
      'fn-call':         { label: 'Function Call',         icon: '📞', color: '#f472b6' },
      'fn-return':       { label: 'Function Return',       icon: '↩️', color: '#fb923c' },
      'fn-return-assign':{ label: 'Return + Assign',       icon: '↩️', color: '#fb923c' },
      'class-declare':   { label: 'Class Declared',        icon: '🏗️', color: '#c084fc' },
      'switch-enter':    { label: 'Switch Statement',      icon: '🔀', color: '#a78bfa' },
      'try-enter':       { label: 'Try Block',             icon: '🛡️', color: '#60a5fa' },
      'catch-enter':     { label: 'Catch Block',           icon: '🪤', color: '#f59e0b' },
      'throw':           { label: 'Throw Error',           icon: '💥', color: '#ef4444' },
      'ds-push':         { label: 'Array Push',            icon: '➕', color: '#34d399' },
      'ds-pop':          { label: 'Array Pop',             icon: '➖', color: '#fb923c' },
      'ds-dequeue':      { label: 'Array Shift',           icon: '⬅️', color: '#f87171' },
      'ds-sort':         { label: 'Array Sort',            icon: '📊', color: '#818cf8' },
      'arr-set':         { label: 'Array Set',             icon: '📝', color: '#38bdf8' },
      'arr-method':      { label: 'Array Method',          icon: '⚙️', color: '#38bdf8' },
      'obj-set':         { label: 'Property Set',          icon: '🔑', color: '#fbbf24' },
      'obj-method':      { label: 'Object Method',         icon: '⚙️', color: '#fbbf24' },
      'obj-destruct':    { label: 'Destructuring',         icon: '📦', color: '#fbbf24' },
      'closure-create':  { label: 'Closure Created',       icon: '🔒', color: '#c084fc' },
      'closure-call':    { label: 'Closure Called',        icon: '🔓', color: '#c084fc' },
    };
    return map[ph] || { label: ph.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), icon: '▶', color: accent };
  }

  /** Parse brain text into { summary, body, simple, v8 } sections */
  function parseBrain(brain) {
    if (!brain) return null;

    // Split on V8 Internal marker
    const v8Marker = /\n\nV8 (?:Internal|GARBAGE)/;
    const v8Match = brain.match(v8Marker);
    let mainText = brain;
    let v8Text = '';

    if (v8Match) {
      mainText = brain.slice(0, v8Match.index);
      v8Text = brain.slice(v8Match.index + 2); // skip the \n\n
    }

    // Extract first line as summary
    const firstNewline = mainText.indexOf('\n');
    let summary = '';
    let body = mainText;
    if (firstNewline > 0 && firstNewline < 80) {
      summary = mainText.slice(0, firstNewline).replace(/:$/, '');
      body = mainText.slice(firstNewline + 1).trim();
    }

    // Generate a simple 1-2 sentence version for beginners
    const simple = simplifyBrain(summary, body, sd.phase);

    return { summary, body, simple, v8: v8Text };
  }

  /** Generate a beginner-friendly 1-2 sentence explanation */
  function simplifyBrain(summary, body, phase) {
    // Phase-specific simple explanations
    const simpleMap = {
      'start':      'The program is ready to run. Click Next to step through your code line by line.',
      'done':       'Your program has finished running! Check the stats above to see what happened.',
      'error':      'Something went wrong. Read the message above for help fixing it.',
    };
    if (simpleMap[phase]) return simpleMap[phase];

    // For other phases, extract the first meaningful sentence from the body
    if (body) {
      // Take first sentence or first line, whichever is shorter
      const firstSentence = body.match(/^[^.!\n]+[.!]?/);
      if (firstSentence && firstSentence[0].length < 120) {
        return firstSentence[0].trim();
      }
      // Fallback: first line
      const firstLine = body.split('\n')[0];
      if (firstLine.length < 120) return firstLine.trim();
      return firstLine.slice(0, 117).trim() + '...';
    }

    return summary || '';
  }

  let parsed = $derived(parseBrain(sd.brain));
  let info   = $derived(phInfo(sd.phase));
</script>

<div class="cpu-dash" role="region" aria-label="CPU execution dashboard">
  <!-- ── Bento grid: dense modular read-out of engine state ─────────────
       CPU dashboard is progressive-disclosure tier 3 — it only appears
       at Deep Dive. Learn and Explore keep the panel uncluttered and
       rely on the module-specific call-stack / heap views instead. -->
  <div class="bento dl-deep" style="--ph:{phColor(sd.phase)}">

    <!-- CPU chip + operation symbol — anchor cell, tall -->
    <div class="cell cell-chip" style="--acc:{phColor(sd.phase)}">
      <span class="cell-lbl">CPU</span>
      <svg viewBox="0 0 52 52" class="chip-svg" aria-hidden="true">
        <rect x="4" y="4" width="44" height="44" rx="6" fill="var(--elevation-overlay)" stroke={phColor(sd.phase)} stroke-width="1.5"/>
        <rect x="12" y="12" width="28" height="28" rx="3" fill={phColor(sd.phase)} opacity="0.18"/>
        {#each [0, 1, 2] as p}
          <rect x={15 + p * 9} y="0"  width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.55"/>
          <rect x={15 + p * 9} y="47" width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.55"/>
          <rect x="0"  y={15 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.55"/>
          <rect x="47" y={15 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.55"/>
        {/each}
        <text x="26" y="32" text-anchor="middle" fill={phColor(sd.phase)} font-size="16" font-weight="800" font-family="'Geist Mono', monospace">{phSymbol(sd.phase)}</text>
      </svg>
    </div>

    <!-- STEP / TOTAL with progress ring -->
    <div class="cell cell-step">
      <span class="cell-lbl">STEP</span>
      <div class="step-ring">
        <svg viewBox="0 0 48 48" class="ring-svg" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
          <circle cx="24" cy="24" r="20" fill="none" stroke={phColor(sd.phase)} stroke-width="3"
            stroke-dasharray={2 * Math.PI * 20}
            stroke-dashoffset={2 * Math.PI * 20 * (1 - (total > 1 ? step / (total - 1) : 0))}
            stroke-linecap="round" transform="rotate(-90 24 24)"/>
        </svg>
        <div class="step-num">
          <span class="step-cur">{step + 1}</span>
          <span class="step-tot">/ {total}</span>
        </div>
      </div>
    </div>

    <!-- PROGRAM COUNTER -->
    <div class="cell cell-pc">
      <span class="cell-lbl">PC</span>
      <span class="cell-sub">program counter</span>
      <span class="cell-val">
        {sd.lineIndex >= 0 ? 'LINE ' + (sd.lineIndex + 1) : sd.phase === 'start' ? 'READY' : 'END'}
      </span>
    </div>

    <!-- OPERATION / PHASE -->
    <div class="cell cell-op">
      <span class="cell-lbl">OP</span>
      <span class="cell-sub">current operation</span>
      <span class="cell-val">{sd.phase.toUpperCase()}</span>
    </div>

    <!-- WRITES gauge -->
    <div class="cell cell-writes">
      <span class="cell-lbl">WRITES</span>
      <span class="cell-sub">memory changes</span>
      <div class="gauge">
        <div class="gauge-fill" style="width:{Math.min(100, (sd.memOps || 0) * 12)}%"></div>
      </div>
      <span class="cell-val cell-val-sm">{sd.memOps || 0} ops</span>
    </div>

    <!-- CALL STACK -->
    <div class="cell cell-stack">
      <span class="cell-lbl">STACK</span>
      <span class="cell-sub">function depth</span>
      {#if stackSnippet}
        <svg viewBox="0 80 128 20" class="slot-svg" aria-hidden="true">{@render stackSnippet(sd)}</svg>
      {:else if !sd.done}
        <div class="stack-frame">
          <span class="stack-name">Global</span>
          <span class="stack-meta">{Object.keys(sd.vars || {}).length} vars</span>
        </div>
      {:else}
        <div class="stack-frame stack-empty">empty</div>
      {/if}
    </div>

    <!-- MODULE-SPECIFIC STATE (registers + gauge snippets) — Deep Dive only -->
    {#if registers || gauge || moduleVisual}
      <div class="cell cell-module dl-deep" class:has-visual={!!moduleVisual} class:has-slot={!!(registers || gauge)}>
        <span class="cell-lbl">MODULE</span>
        <span class="cell-sub">{moduleCaption || 'module-specific state'}</span>
        {#if moduleVisual}
          <div class="module-visual">{@render moduleVisual(sd)}</div>
        {/if}
        {#if registers || gauge}
          <svg viewBox="200 8 160 82" class="slot-svg" aria-hidden="true">
            {#if registers}{@render registers(sd)}{/if}
            {#if gauge}{@render gauge(sd)}{/if}
          </svg>
        {/if}
      </div>
    {/if}

    <!-- HINT / memLabel strip along the bottom of the grid -->
    {#if sd.memLabel}
      <div class="cell cell-hint">{sd.memLabel}</div>
    {/if}
  </div>

  {#if (sd.brain && parsed) || sd._brainHtml}
    <!-- Visual explanation panel — Deep Dive only. The engine narration
         belongs to the "See why the engine was designed this way" tier;
         Learn and Explore rely on the visual panels (variables, heap,
         call stack, etc.) to show engine state without prose. -->
    <div class="cpu-explain-panel dl-deep">

      <!-- Phase badge row with mode toggle -->
      <div class="phase-row">
        <span class="phase-icon">{info.icon}</span>
        <span class="phase-label" style="color:{info.color}">{info.label}</span>
        <span class="phase-tag" style="background:{info.color}18;color:{info.color};border-color:{info.color}33">{sd.phase.toUpperCase()}</span>
        {#if onToggleMode}
          <button class="mode-toggle" style="--mode-color:{accent}" onclick={onToggleMode}
            title={explainMode === 'simple' ? 'Show detailed explanation' : 'Show simple explanation'}
            aria-label={explainMode === 'simple' ? 'Switch to advanced explanation mode' : 'Switch to simple explanation mode'}>
            {explainMode === 'simple' ? '🔬 Advanced' : '💡 Simple'}
          </button>
        {/if}
      </div>

      <!-- Visual pipeline for start phase -->
      {#if sd.phase === 'start'}
        <div class="pipeline">
          <svg viewBox="0 0 340 52" class="pipeline-svg">
            <!-- Parse stage -->
            <rect x="2" y="6" width="90" height="40" rx="6" fill="#4ade8015" stroke="#4ade8044" stroke-width="1"/>
            <text x="47" y="22" text-anchor="middle" fill="#4ade80" font-size="10" font-weight="700" font-family="'Geist Mono', monospace">PARSE</text>
            <text x="47" y="36" text-anchor="middle" fill="#4ade8088" font-size="6.5" font-family="'Geist Mono', monospace">Source → AST</text>
            <!-- Arrow 1 -->
            <polygon points="98,26 108,21 108,31" fill="#4ade8066"/>
            <!-- Compile stage -->
            <rect x="114" y="6" width="96" height="40" rx="6" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="162" y="22" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="700" font-family="'Geist Mono', monospace">COMPILE</text>
            <text x="162" y="36" text-anchor="middle" fill="#38bdf888" font-size="6.5" font-family="'Geist Mono', monospace">AST → Bytecode</text>
            <!-- Arrow 2 -->
            <polygon points="216,26 226,21 226,31" fill="#38bdf866"/>
            <!-- Execute stage -->
            <rect x="232" y="6" width="100" height="40" rx="6" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="282" y="22" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="700" font-family="'Geist Mono', monospace">EXECUTE</text>
            <text x="282" y="36" text-anchor="middle" fill="#f59e0b88" font-size="6.5" font-family="'Geist Mono', monospace">Run line by line</text>
          </svg>
        </div>
      {/if}

      <!-- Visual indicators for declare/assign phases -->
      {#if sd.phase === 'declare' && sd.highlight}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">let</text>
            <polygon points="78,18 88,13 88,23" fill="#38bdf866"/>
            <rect x="94" y="4" width="80" height="28" rx="5" fill="#fbbf2415" stroke="#fbbf2444" stroke-width="1"/>
            <text x="134" y="22" text-anchor="middle" fill="#fbbf24" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{sd.highlight}</text>
            <polygon points="180,18 190,13 190,23" fill="#fbbf2466"/>
            <rect x="196" y="4" width="58" height="28" rx="5" fill="#4ade8015" stroke="#4ade8044" stroke-width="1"/>
            <text x="225" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">HEAP</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'assign' && sd.highlight}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="90" height="28" rx="5" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="47" y="22" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{sd.highlight}</text>
            <polygon points="98,18 108,13 108,23" fill="#f59e0b66"/>
            <rect x="114" y="4" width="80" height="28" rx="5" fill="#4ade8015" stroke="#4ade8044" stroke-width="1"/>
            <text x="154" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{String(sd.vars?.[sd.highlight] ?? '').slice(0,10)}</text>
            <polygon points="200,18 210,13 210,23" fill="#4ade8066"/>
            <rect x="216" y="4" width="38" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="235" y="22" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="700" font-family="'Geist Mono', monospace">MEM</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'condition' || sd.phase === 'else-enter' || sd.phase === 'skip'}
        {@const isTrue = sd.cond === true || sd.cond === undefined}
        <div class="action-visual">
          <svg viewBox="0 0 240 52" class="action-svg">
            <!-- Diamond decision -->
            <polygon points="80,2 130,26 80,50 30,26" fill="#a78bfa10" stroke="#a78bfa44" stroke-width="1"/>
            <text x="80" y="30" text-anchor="middle" fill="#a78bfa" font-size="11" font-weight="700" font-family="'Geist Mono', monospace">if</text>
            <!-- TRUE path -->
            <line x1="130" y1="26" x2="160" y2="10" stroke={isTrue ? '#4ade80' : '#4ade8033'} stroke-width={isTrue ? '2' : '1'}/>
            <rect x="164" y="2" width="60" height="18" rx="4" fill={isTrue ? '#4ade8018' : 'transparent'} stroke={isTrue ? '#4ade8066' : '#4ade8022'} stroke-width="1"/>
            <text x="194" y="14" text-anchor="middle" fill={isTrue ? '#4ade80' : '#4ade8044'} font-size="8" font-weight="700" font-family="'Geist Mono', monospace">TRUE</text>
            <!-- FALSE path -->
            <line x1="130" y1="26" x2="160" y2="42" stroke={!isTrue ? '#f87171' : '#f8717133'} stroke-width={!isTrue ? '2' : '1'}/>
            <rect x="164" y="33" width="60" height="18" rx="4" fill={!isTrue ? '#f8717118' : 'transparent'} stroke={!isTrue ? '#f8717166' : '#f8717122'} stroke-width="1"/>
            <text x="194" y="45" text-anchor="middle" fill={!isTrue ? '#f87171' : '#f8717144'} font-size="8" font-weight="700" font-family="'Geist Mono', monospace">FALSE</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'output'}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="60" height="28" rx="5" fill="#34d39915" stroke="#34d39944" stroke-width="1"/>
            <text x="32" y="22" text-anchor="middle" fill="#34d399" font-size="8" font-weight="700" font-family="'Geist Mono', monospace">LOG</text>
            <polygon points="68,18 78,13 78,23" fill="#34d39966"/>
            <rect x="84" y="4" width="170" height="28" rx="5" fill="#11111a" stroke="#1a1a2e" stroke-width="1"/>
            <text x="94" y="22" fill="#34d399" font-size="8.5" font-family="'Geist Mono', monospace">$ {sd.output?.[sd.output.length - 1]?.slice(0, 22) ?? ''}</text>
          </svg>
        </div>
      {/if}

      {#if (sd.phase === 'loop-test' || sd.phase === 'loop-check') && sd.loopIters !== undefined}
        <div class="action-visual">
          <div class="loop-meter">
            <span class="loop-meter-label" style="color:#818cf8">Iterations</span>
            <div class="loop-meter-track">
              <div class="loop-meter-fill" style="width:{Math.min(100, (sd.loopIters || 0) * 10)}%;background:#818cf8"></div>
            </div>
            <span class="loop-meter-val" style="color:#818cf8">{sd.loopIters || 0}</span>
          </div>
        </div>
      {/if}

      {#if sd.phase === 'ds-push' || sd.phase === 'ds-pop' || sd.phase === 'ds-dequeue' || sd.phase === 'ds-sort'}
        {@const dsColor = sd.phase === 'ds-push' ? '#34d399' : sd.phase === 'ds-pop' ? '#fb923c' : sd.phase === 'ds-sort' ? '#818cf8' : '#f87171'}
        {@const dsLabel = sd.phase === 'ds-push' ? 'PUSH' : sd.phase === 'ds-pop' ? 'POP' : sd.phase === 'ds-sort' ? 'SORT' : 'SHIFT'}
        {@const dsIcon  = sd.phase === 'ds-push' ? '→]' : sd.phase === 'ds-pop' ? '[←' : sd.phase === 'ds-sort' ? '↕' : '←['}
        <div class="action-visual">
          <svg viewBox="0 0 280 36" class="action-svg">
            <rect x="2" y="4" width="56" height="28" rx="5" fill={dsColor + '15'} stroke={dsColor + '44'} stroke-width="1"/>
            <text x="30" y="22" text-anchor="middle" fill={dsColor} font-size="8" font-weight="700" font-family="'Geist Mono', monospace">{dsLabel}</text>
            <polygon points="64,18 74,13 74,23" fill={dsColor + '66'}/>
            <rect x="80" y="4" width="84" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="122" y="22" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{sd.highlight ?? 'arr'}</text>
            <polygon points="170,18 180,13 180,23" fill="#38bdf866"/>
            <rect x="186" y="4" width="28" height="28" rx="5" fill={dsColor + '15'} stroke={dsColor + '44'} stroke-width="1"/>
            <text x="200" y="23" text-anchor="middle" fill={dsColor} font-size="12" font-weight="700" font-family="'Geist Mono', monospace">{dsIcon}</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'fn-call' || sd.phase === 'fn-declare'}
        <div class="action-visual">
          <svg viewBox="0 0 280 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#f472b615" stroke="#f472b644" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#f472b6" font-size="8" font-weight="700" font-family="'Geist Mono', monospace">{sd.phase === 'fn-call' ? 'CALL' : 'DEF'}</text>
            <polygon points="78,18 88,13 88,23" fill="#f472b666"/>
            <rect x="94" y="4" width="90" height="28" rx="5" fill="#c084fc15" stroke="#c084fc44" stroke-width="1"/>
            <text x="139" y="22" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{sd.highlight ?? 'fn'}()</text>
            {#if sd.phase === 'fn-call'}
              <polygon points="190,18 200,13 200,23" fill="#c084fc66"/>
              <rect x="206" y="4" width="68" height="28" rx="5" fill="#818cf815" stroke="#818cf844" stroke-width="1"/>
              <text x="240" y="22" text-anchor="middle" fill="#818cf8" font-size="7" font-weight="700" font-family="'Geist Mono', monospace">PUSH STACK</text>
            {/if}
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'fn-return' || sd.phase === 'fn-return-assign'}
        <div class="action-visual">
          <svg viewBox="0 0 280 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#fb923c15" stroke="#fb923c44" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#fb923c" font-size="8" font-weight="700" font-family="'Geist Mono', monospace">RETURN</text>
            <polygon points="78,18 88,13 88,23" fill="#fb923c66"/>
            <rect x="94" y="4" width="80" height="28" rx="5" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="134" y="22" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">{sd.memLabel?.replace(/^RETURN:\s*/, '').slice(0,10) ?? '...'}</text>
            <polygon points="180,18 190,13 190,23" fill="#f59e0b66"/>
            <rect x="196" y="4" width="68" height="28" rx="5" fill="#f8717115" stroke="#f8717144" stroke-width="1"/>
            <text x="230" y="22" text-anchor="middle" fill="#f87171" font-size="7" font-weight="700" font-family="'Geist Mono', monospace">POP STACK</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'done'}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="256" height="28" rx="5" fill="#4ade8010" stroke="#4ade8033" stroke-width="1"/>
            <text x="130" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="'Geist Mono', monospace">
              {Object.keys(sd.vars || {}).length} vars | {sd.memOps || 0} writes | {sd.comps || 0} comparisons
            </text>
          </svg>
        </div>
      {/if}

      <!-- Explanation content — mode-dependent -->
      {#if sd._brainHtml}
        <!-- Streaming markdown (e.g. from the LLM narrator in Free-Form mode) -->
        <div class="explain-body explain-md" role="status" aria-live="polite">
          {@html sd._brainHtml}
          {#if sd._brainStreaming}<span class="brain-caret"></span>{/if}
        </div>
      {:else if explainMode === 'simple'}
        <!-- Simple mode: 1-2 sentence beginner explanation -->
        <div class="explain-simple" role="status" aria-live="polite">{parsed.simple}</div>
      {:else}
        <!-- Advanced mode: full summary + body + V8 -->
        {#if parsed.summary}
          <div class="explain-summary">{parsed.summary}</div>
        {/if}
        {#if parsed.body}
          <div class="explain-body">{parsed.body}</div>
        {/if}
        {#if parsed.v8}
          <details class="v8-details dl-deep">
            <summary class="v8-toggle">
              <svg width="12" height="12" viewBox="0 0 12 12" class="v8-chip-icon">
                <rect x="1" y="1" width="10" height="10" rx="2" fill="#1a1a2e" stroke="#333" stroke-width="0.5"/>
                <text x="6" y="8.5" text-anchor="middle" fill="#666" font-size="6" font-weight="700" font-family="'Geist Mono', monospace">V8</text>
              </svg>
              <span>V8 Engine Internals</span>
            </summary>
            <pre class="v8-body">{parsed.v8}</pre>
          </details>
        {/if}
      {/if}

    </div>
  {/if}
</div>

<style>
  .cpu-dash {
    flex-shrink:0;
    background: var(--elevation-surface);
    border: none;
    border-radius:12px;
    overflow:hidden;
    box-shadow: var(--elevation-shadow-raised);
  }

  /* ── Bento grid ────────────────────────────────────────────────────────
     4-column dense grid. Chip anchors the top-left (2-row tall). Core
     readouts (PC, OP, WRITES, STACK) fill the top strip. Module-specific
     state spans the bottom row. Hint line is a slim footer.             */
  .bento {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 1fr;
    grid-template-rows: auto auto auto auto;
    gap: 6px;
    padding: 6px;
    background: var(--elevation-base);
  }

  .cell {
    background: var(--elevation-raised);
    border-radius: 6px;
    padding: 8px 10px 9px;
    box-shadow: var(--elevation-shadow-raised);
    display:flex; flex-direction:column; gap:2px;
    position: relative;
    min-height: 52px;
    transition: background .2s;
  }
  .cell:hover { background: var(--elevation-overlay); }

  /* Accent rail on the top edge that reflects the current phase */
  .cell::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 1.5px;
    background: var(--ph, var(--acc));
    opacity: 0.28;
    border-radius: 6px 6px 0 0;
  }

  .cell-lbl {
    font-family: var(--font-code);
    font-size: 0.62rem;
    letter-spacing: 1.5px;
    font-weight: 700;
    color: #ffffff;
    text-transform: uppercase;
  }
  .cell-sub {
    font-family: var(--font-ui);
    font-size: 0.6rem;
    color: rgba(255,255,255,0.88);
    line-height: 1.25;
    margin-top: -1px;
  }
  .cell-val {
    margin-top: auto;
    font-family: var(--font-code);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--ph, #e5e5e5);
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell-val-sm { font-size: 0.7rem; }

  /* ── Individual cells ──────────────────────────────────────────────── */

  /* CHIP — tall anchor, spans 2 rows */
  .cell-chip {
    grid-column: 1 / 2;
    grid-row: 1 / 3;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 6px;
  }
  .chip-svg { width: 64px; height: 64px; margin-top: 6px; }

  /* STEP cell (top row, col 2) — ring + count */
  .cell-step   { grid-column: 2 / 3; grid-row: 1 / 2; }
  .step-ring   { position:relative; margin-top:auto; display:flex; align-items:center; gap:10px; }
  .ring-svg    { width:40px; height:40px; flex-shrink:0; }
  .step-num    { display:flex; align-items:baseline; gap:3px; font-family: var(--font-code); }
  .step-cur    { font-size:1rem; font-weight:800; color:var(--ph, #e5e5e5); }
  .step-tot    { font-size:0.65rem; color:rgba(255,255,255,0.32); }

  /* PC + OP + WRITES + STACK on the top two rows, cols 2-4 */
  .cell-pc     { grid-column: 3 / 4; grid-row: 1 / 2; }
  .cell-op     { grid-column: 4 / 5; grid-row: 1 / 2; }
  .cell-writes { grid-column: 2 / 3; grid-row: 2 / 3; }
  .cell-stack  { grid-column: 3 / 5; grid-row: 2 / 3; }

  /* Gauge bar for WRITES */
  .gauge       { height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; margin-top:auto; }
  .gauge-fill  { height:100%; background:#f59e0b; border-radius:3px; transition:width .3s ease; opacity:0.75; }

  /* Stack frame chips */
  .stack-frame {
    margin-top: auto;
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:4px 8px; border-radius:4px;
    background: var(--elevation-overlay);
    border-left: 2px solid #4ade80;
    font-family: var(--font-code);
  }
  .stack-name  { font-size:0.75rem; font-weight:700; color:#4ade80; }
  .stack-meta  { font-size:0.6rem; color:rgba(255,255,255,0.32); }
  .stack-empty { border-left-color: rgba(255,255,255,0.12); color:rgba(255,255,255,0.25); justify-content:center; font-style:italic; }

  /* MODULE STATE — full width row housing snippet SVG.
     Uses a 2-column grid so label/caption sit on the left and the SVG
     occupies the right at a fixed size, eliminating the wide empty bars
     caused by `xMidYMid meet` letterboxing of a 160×82 viewBox inside a
     1000-wide cell. */
  .cell-module {
    grid-column: 1 / 5; grid-row: 3 / 4;
    padding-bottom: 9px;
    display: grid;
    grid-template-columns: 1fr minmax(220px, 360px);
    grid-template-rows: auto auto 1fr;
    align-items: start;
    column-gap: 16px;
    row-gap: 2px;
  }
  .cell-module > .cell-lbl { grid-column: 1; grid-row: 1; }
  .cell-module > .cell-sub { grid-column: 1; grid-row: 2; }
  .cell-module > .module-visual { grid-column: 1; grid-row: 3; align-self: stretch; margin-top: 8px; }
  .cell-module > .slot-svg { grid-column: 2; grid-row: 1 / 4; align-self: center; }
  .slot-svg    { width:100%; height:auto; display:block; margin-top:4px; max-height:96px; }
  .cell-module > .slot-svg { margin-top: 0; max-height: 110px; }
  .module-visual { width: 100%; }
  .module-visual svg { width: 100%; height: auto; display: block; max-height: 220px; }

  /* When the module only ships a `cpuModuleVisual` snippet (no registers
     or gauge), there is no right-hand slot SVG — collapse the second
     grid column so the diagram fills the full bento row instead of
     being wedged into ~64% of it. Drop the height cap entirely so the
     SVG renders at width:100% and lets its natural viewBox aspect ratio
     determine height. The previous 280px cap combined with
     `preserveAspectRatio="xMidYMid meet"` caused horizontal
     letterboxing on wide Deep-Dive layouts (empty bars on the left and
     right of the content). */
  .cell-module.has-visual:not(.has-slot) {
    grid-template-columns: 1fr;
  }
  .cell-module.has-visual:not(.has-slot) > .module-visual svg {
    max-height: none;
    /* Soft upper bound on truly massive screens so the diagram doesn't
       dominate the viewport; at its 520:110 viewBox ratio this lets
       widths up to ~1890px render without letterboxing. */
    max-block-size: 400px;
  }

  /* HINT strip */
  .cell-hint {
    grid-column: 1 / 5; grid-row: 4 / 5;
    min-height: 26px; padding: 5px 12px;
    font-family: var(--font-ui);
    font-size: 0.66rem;
    color: rgba(255,255,255,0.82);
    background: var(--elevation-overlay);
  }
  .cell-hint::before { display: none; }
  .cell-hint:hover { background: var(--elevation-overlay); }

  /* ── Visual explanation panel ──────────────────────────────────────────── */
  .cpu-explain-panel { border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:0; }

  /* Phase badge row */
  .phase-row      { display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,255,255,0.02); }
  .phase-icon     { font-size:1rem; line-height:1; }
  .phase-label    { font-size:0.78rem; font-weight:700; letter-spacing:0.3px; }
  .phase-tag      { margin-left:auto; font-size:0.5rem; padding:2px 8px; border-radius:3px; border:1px solid; font-family: var(--font-code); letter-spacing:1px; font-weight:600; }

  /* Mode toggle button */
  .mode-toggle    { background:transparent; border:1px solid rgba(255,255,255,0.12); border-radius:4px; padding:2px 8px; font-size:0.52rem; color:rgba(255,255,255,0.50); cursor:pointer; font-family: var(--font-code); letter-spacing:0.3px; transition:all 0.15s; flex-shrink:0; }
  .mode-toggle:hover { border-color:var(--mode-color, #888); color:var(--mode-color, #ccc); }

  /* Simple mode explanation */
  .explain-simple { padding:8px 12px 10px; font-size:0.73rem; color:rgba(255,255,255,0.72); line-height:1.65; font-family: var(--font-ui); }

  /* Pipeline SVG (start phase) */
  .pipeline       { padding:6px 12px 2px; }
  .pipeline-svg   { width:100%; height:auto; display:block; }

  /* Action visuals (per-phase inline SVGs) */
  .action-visual  { padding:4px 12px; }
  .action-svg     { width:100%; max-width:320px; height:auto; display:block; }

  /* Loop iteration meter */
  .loop-meter       { display:flex; align-items:center; gap:8px; padding:0 12px; }
  .loop-meter-label { font-size:0.6rem; font-family: var(--font-code); font-weight:600; flex-shrink:0; }
  .loop-meter-track { flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
  .loop-meter-fill  { height:100%; border-radius:3px; transition:width 0.3s ease; }
  .loop-meter-val   { font-size:0.7rem; font-family: var(--font-code); font-weight:800; min-width:20px; text-align:right; }

  /* Summary line */
  .explain-summary  { padding:6px 12px 2px; font-size:0.73rem; color:rgba(255,255,255,0.88); font-weight:600; line-height:1.5; font-family: var(--font-ui); }

  /* Main explanation body */
  .explain-body     { padding:4px 12px 8px; font-size:0.68rem; color:rgba(255,255,255,0.55); line-height:1.65; white-space:pre-wrap; font-family: var(--font-ui); max-height:120px; overflow-y:auto; }

  /* Markdown body (LLM streaming) — paragraphs, bold, code, lists */
  .explain-md       { white-space:normal; }
  .explain-md :global(p)    { margin:0 0 0.55em; line-height:1.65; }
  .explain-md :global(p:last-child) { margin-bottom:0; }
  .explain-md :global(strong), .explain-md :global(b) { color:rgba(255,255,255,0.85); font-weight:600; }
  .explain-md :global(em)   { color:rgba(255,255,255,0.75); font-style:italic; }
  .explain-md :global(code) { font-family: var(--font-code); font-size:0.9em; background:rgba(255,255,255,0.06); padding:1px 5px; border-radius:3px; color:#a7f3d0; }
  .explain-md :global(ul), .explain-md :global(ol) { margin:0 0 0.5em; padding-left:1.2em; }
  .explain-md :global(li)   { margin:0.1em 0; }

  /* Blinking caret for streaming narration */
  .brain-caret {
    display:inline-block; width:6px; height:0.9em; margin-left:2px;
    background:#00FFD1; vertical-align:-2px; border-radius:1px;
    animation: brain-blink 1s steps(2) infinite;
  }
  @keyframes brain-blink { 0%, 50% { opacity:1; } 50.01%, 100% { opacity:0.15; } }

  /* ── Screen reader only utility ─────────────────────────────────────── */
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

  /* V8 Internals (collapsible) */
  .v8-details       { border-top:1px solid rgba(255,255,255,0.06); }
  .v8-toggle        { padding:6px 12px; font-size:0.58rem; color:rgba(255,255,255,0.38); cursor:pointer; font-family: var(--font-code); letter-spacing:0.3px; display:flex; align-items:center; gap:6px; user-select:none; transition:color 0.15s; }
  .v8-toggle:hover  { color:rgba(255,255,255,0.70); }
  .v8-chip-icon     { flex-shrink:0; }
  .v8-body          { padding:6px 12px 10px; font-size:0.62rem; color:rgba(255,255,255,0.50); line-height:1.6; white-space:pre-wrap; font-family: var(--font-code); margin:0; border:none; background:transparent; max-height:160px; overflow-y:auto; }

  /* ── Responsive: tablet ≤768px ─────────────────────────────────────────
     On mobile the cells pack tighter and the STEP cell's 40px progress
     ring sits right against the top of the dashboard. Guarantee
     `overflow: hidden` (for the rounded corners) AND explicit top
     padding so the ring never gets clipped at the top edge. */
  @media (max-width: 768px) {
    .cpu-dash       { border-radius:6px; overflow:hidden; padding-top:10px; }
    .bento          { grid-template-columns: 84px 1fr 1fr; gap:5px; padding:5px; }
    .cell-chip      { grid-column: 1 / 2; grid-row: 1 / 3; }
    .cell-step      { grid-column: 2 / 3; grid-row: 1 / 2; }
    .cell-pc        { grid-column: 3 / 4; grid-row: 1 / 2; }
    .cell-op        { grid-column: 2 / 3; grid-row: 2 / 3; }
    .cell-writes    { grid-column: 3 / 4; grid-row: 2 / 3; }
    .cell-stack     { grid-column: 1 / 4; grid-row: 3 / 4; }
    .cell-module    { grid-column: 1 / 4; grid-row: 4 / 5; grid-template-columns: 1fr; }
    .cell-module > .cell-lbl,
    .cell-module > .cell-sub,
    .cell-module > .slot-svg { grid-column: 1; }
    .cell-module > .slot-svg { grid-row: auto; margin-top: 4px; }
    .cell-hint      { grid-column: 1 / 4; grid-row: 5 / 6; }
    .chip-svg       { width: 52px; height: 52px; }
    .cell-val       { font-size: 0.82rem; }
    .phase-label    { font-size:0.7rem; }
    .phase-tag      { font-size:0.42rem; padding:2px 5px; }
    .mode-toggle    { padding:4px 10px; font-size:0.52rem; min-height:28px; }
    .explain-simple { font-size:0.68rem; padding:6px 10px 8px; }
    .explain-summary { font-size:0.65rem; }
    .explain-body   { font-size:0.6rem; max-height:100px; }
    .v8-body        { font-size:0.55rem; max-height:120px; }
    .pipeline       { padding:4px 8px; }
    .action-svg     { max-width:100%; }
  }

  /* ── Responsive: phone ≤480px ──────────────────────────────────────── */
  @media (max-width: 480px) {
    .cpu-dash       { border-radius:4px; }
    .bento          { grid-template-columns: 1fr 1fr; gap:4px; padding:4px; }
    .cell           { padding: 6px 8px 7px; min-height: 44px; }
    .cell-chip      { grid-column: 1 / 3; grid-row: 1 / 2; flex-direction:row; align-items:center; gap:10px; padding: 8px 10px; }
    .chip-svg       { width: 40px; height: 40px; margin-top: 0; }
    .cell-step      { grid-column: 1 / 2; grid-row: 2 / 3; }
    .cell-pc        { grid-column: 2 / 3; grid-row: 2 / 3; }
    .cell-op        { grid-column: 1 / 2; grid-row: 3 / 4; }
    .cell-writes    { grid-column: 2 / 3; grid-row: 3 / 4; }
    .cell-stack     { grid-column: 1 / 3; grid-row: 4 / 5; }
    .cell-module    { grid-column: 1 / 3; grid-row: 5 / 6; }
    .cell-hint      { grid-column: 1 / 3; grid-row: 6 / 7; }
    .cell-val       { font-size: 0.72rem; }
    .phase-row      { padding:6px 8px; gap:5px; flex-wrap:wrap; }
    .phase-icon     { font-size:0.85rem; }
    .phase-label    { font-size:0.62rem; }
    .phase-tag      { font-size:0.38rem; padding:1px 4px; }
    .mode-toggle    { padding:4px 8px; font-size:0.48rem; min-height:30px; margin-left:auto; }
    .explain-simple { font-size:0.64rem; padding:5px 8px 7px; line-height:1.5; }
    .explain-summary { font-size:0.6rem; padding:4px 8px 2px; }
    .explain-body   { font-size:0.55rem; padding:3px 8px 6px; max-height:80px; }
    .v8-toggle      { padding:4px 8px; font-size:0.5rem; }
    .v8-body        { padding:4px 8px 8px; font-size:0.5rem; max-height:100px; }
    .action-visual  { padding:3px 6px; }
    .action-svg     { max-width:100%; }
    .loop-meter     { padding:0 8px; }
    .loop-meter-label { font-size:0.52rem; }
  }

  /* ── Responsive: very small phone ≤360px ────────────────────────────── */
  @media (max-width: 360px) {
    .cpu-svg        { max-height:90px; }
    .phase-row      { padding:4px 6px; gap:4px; }
    .phase-icon     { font-size:0.75rem; }
    .phase-label    { font-size:0.55rem; }
    .explain-simple { font-size:0.58rem; padding:4px 6px 6px; }
    .explain-body   { font-size:0.5rem; max-height:60px; }
  }
</style>
