<script>
  /**
   * CpuDash — reusable CPU dashboard SVG shared by all 8 modules.
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
   */

  /** @type {{ sd: object, step: number, total: number, accent: string, phColor: (ph:string)=>string, explainMode?: string, onToggleMode?: ()=>void, registers?: import('svelte').Snippet, gauge?: import('svelte').Snippet, stack?: import('svelte').Snippet }} */
  let { sd, step, total, accent, phColor, explainMode = 'simple', onToggleMode, registers, gauge, stack: stackSnippet } = $props();

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
  <svg viewBox="0 0 360 130" class="cpu-svg" role="img" aria-label="CPU state: step {step + 1} of {total}, phase {sd.phase}, {sd.lineIndex >= 0 ? 'line ' + (sd.lineIndex + 1) : sd.phase === 'start' ? 'ready' : 'done'}">
    <title>CPU Dashboard — Step {step + 1}/{total}: {sd.phase}</title>
    <defs>
      <!-- Glow filter for chip & ring -->
      <filter id="chip-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" in="SourceGraphic" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <!-- Subtle ambient glow for progress ring -->
      <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" in="SourceGraphic" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Background — slight accent tint at top-right corner -->
    <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <!-- Accent atmosphere inside the SVG -->
    <radialGradient id="cpu-atm" cx="90%" cy="10%" r="60%">
      <stop offset="0%" stop-color={phColor(sd.phase)} stop-opacity="0.08"/>
      <stop offset="100%" stop-color={phColor(sd.phase)} stop-opacity="0"/>
    </radialGradient>
    <rect x="0" y="0" width="360" height="130" rx="8" fill="url(#cpu-atm)"/>
    <!-- Top accent stripe -->
    <rect x="8" y="0" width="344" height="1.5" rx="1" fill={phColor(sd.phase)} opacity="0.35"/>

    <!-- Progress ring (top-left) -->
    <circle cx="36" cy="40" r="22" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
    <circle cx="36" cy="40" r="22" fill="none" stroke={phColor(sd.phase)} stroke-width="3"
      stroke-dasharray={2 * Math.PI * 22}
      stroke-dashoffset={2 * Math.PI * 22 * (1 - (total > 1 ? step / (total - 1) : 0))}
      stroke-linecap="round" transform="rotate(-90 36 40)"
      filter="url(#ring-glow)"/>
    <text x="36" y="37" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="11" font-weight="800" font-family="monospace">{step + 1}</text>
    <text x="36" y="47" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-size="7" font-family="monospace">/{total}</text>

    <!-- CPU chip — with glow filter -->
    <rect x="72" y="18" width="44" height="44" rx="6"
      fill="#0d0d18" stroke={phColor(sd.phase)} stroke-width="1.5"
      filter="url(#chip-glow)"/>
    <rect x="80" y="26" width="28" height="28" rx="3" fill={phColor(sd.phase)} opacity="0.15"/>
    {#each [0, 1, 2] as p}
      <rect x={83 + p * 9} y="13"  width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.6"/>
      <rect x={83 + p * 9} y="62"  width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.6"/>
      <rect x="67"  y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.6"/>
      <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.6"/>
    {/each}
    <!-- Operation symbol -->
    <text x="94" y="46" text-anchor="middle" fill={phColor(sd.phase)} font-size="16" font-weight="800" font-family="monospace">
      {phSymbol(sd.phase)}
    </text>

    <!-- PC register — accent-tinted border -->
    <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke={phColor(sd.phase)} stroke-width="0.6" stroke-opacity="0.35"/>
    <text x="138" y="22" fill="rgba(255,255,255,0.25)" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
    <text x="194" y="29" text-anchor="end" fill={phColor(sd.phase)} font-size="10" font-weight="700" font-family="monospace">
      {sd.lineIndex >= 0 ? 'LINE ' + (sd.lineIndex + 1) : sd.phase === 'start' ? 'READY' : 'END'}
    </text>

    <!-- OP register — accent-tinted border -->
    <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke={phColor(sd.phase)} stroke-width="0.6" stroke-opacity="0.35"/>
    <text x="138" y="48" fill="rgba(255,255,255,0.25)" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
    <text x="194" y="55" text-anchor="end" fill={phColor(sd.phase)} font-size="9" font-weight="700" font-family="monospace">{sd.phase.toUpperCase()}</text>

    <!-- Module-specific right-column registers (x ≥ 210) -->
    {#if registers}{@render registers(sd)}{/if}

    <!-- WRITES gauge (left, always shown) -->
    <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
    <rect x="133" y="69" width={Math.min(106, (sd.memOps || 0) * 14)} height="14" rx="2" fill="#f59e0b" opacity="0.3"/>
    <text x="138" y="79" fill="rgba(255,255,255,0.3)" font-size="6.5" font-family="monospace">{sd.memOps || 0} WRITES</text>

    <!-- Module-specific right gauge -->
    {#if gauge}
      {@render gauge(sd)}
    {:else}
      <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
    {/if}

    <!-- Stack visual (bottom-left) -->
    <text x="10" y="78" fill="rgba(255,255,255,0.2)" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
    {#if stackSnippet}
      {@render stackSnippet(sd)}
    {:else if !sd.done}
      <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#4ade8055" stroke-width="1"/>
      <text x="16" y="93" fill="#4ade80" font-size="7.5" font-weight="600" font-family="monospace">Global</text>
      <text x="112" y="93" text-anchor="end" fill="rgba(255,255,255,0.2)" font-size="6.5" font-family="monospace">{Object.keys(sd.vars || {}).length} vars</text>
    {:else}
      <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="64" y="93" text-anchor="middle" fill="rgba(255,255,255,0.15)" font-size="7" font-family="monospace">empty</text>
    {/if}

    <!-- Hint text -->
    <text x="10" y="122" fill="rgba(255,255,255,0.40)" font-size="8" font-family="system-ui, sans-serif">{sd.memLabel || ''}</text>
  </svg>

  {#if sd.brain && parsed}
    <!-- Visual explanation panel -->
    <div class="cpu-explain-panel">

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
            <text x="47" y="22" text-anchor="middle" fill="#4ade80" font-size="10" font-weight="700" font-family="monospace">PARSE</text>
            <text x="47" y="36" text-anchor="middle" fill="#4ade8088" font-size="6.5" font-family="monospace">Source → AST</text>
            <!-- Arrow 1 -->
            <polygon points="98,26 108,21 108,31" fill="#4ade8066"/>
            <!-- Compile stage -->
            <rect x="114" y="6" width="96" height="40" rx="6" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="162" y="22" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="700" font-family="monospace">COMPILE</text>
            <text x="162" y="36" text-anchor="middle" fill="#38bdf888" font-size="6.5" font-family="monospace">AST → Bytecode</text>
            <!-- Arrow 2 -->
            <polygon points="216,26 226,21 226,31" fill="#38bdf866"/>
            <!-- Execute stage -->
            <rect x="232" y="6" width="100" height="40" rx="6" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="282" y="22" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="700" font-family="monospace">EXECUTE</text>
            <text x="282" y="36" text-anchor="middle" fill="#f59e0b88" font-size="6.5" font-family="monospace">Run line by line</text>
          </svg>
        </div>
      {/if}

      <!-- Visual indicators for declare/assign phases -->
      {#if sd.phase === 'declare' && sd.highlight}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="700" font-family="monospace">let</text>
            <polygon points="78,18 88,13 88,23" fill="#38bdf866"/>
            <rect x="94" y="4" width="80" height="28" rx="5" fill="#fbbf2415" stroke="#fbbf2444" stroke-width="1"/>
            <text x="134" y="22" text-anchor="middle" fill="#fbbf24" font-size="9" font-weight="700" font-family="monospace">{sd.highlight}</text>
            <polygon points="180,18 190,13 190,23" fill="#fbbf2466"/>
            <rect x="196" y="4" width="58" height="28" rx="5" fill="#4ade8015" stroke="#4ade8044" stroke-width="1"/>
            <text x="225" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">HEAP</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'assign' && sd.highlight}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="90" height="28" rx="5" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="47" y="22" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="700" font-family="monospace">{sd.highlight}</text>
            <polygon points="98,18 108,13 108,23" fill="#f59e0b66"/>
            <rect x="114" y="4" width="80" height="28" rx="5" fill="#4ade8015" stroke="#4ade8044" stroke-width="1"/>
            <text x="154" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">{String(sd.vars?.[sd.highlight] ?? '').slice(0,10)}</text>
            <polygon points="200,18 210,13 210,23" fill="#4ade8066"/>
            <rect x="216" y="4" width="38" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="235" y="22" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="700" font-family="monospace">MEM</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'condition' || sd.phase === 'else-enter' || sd.phase === 'skip'}
        {@const isTrue = sd.cond === true || sd.cond === undefined}
        <div class="action-visual">
          <svg viewBox="0 0 240 52" class="action-svg">
            <!-- Diamond decision -->
            <polygon points="80,2 130,26 80,50 30,26" fill="#a78bfa10" stroke="#a78bfa44" stroke-width="1"/>
            <text x="80" y="30" text-anchor="middle" fill="#a78bfa" font-size="11" font-weight="700" font-family="monospace">if</text>
            <!-- TRUE path -->
            <line x1="130" y1="26" x2="160" y2="10" stroke={isTrue ? '#4ade80' : '#4ade8033'} stroke-width={isTrue ? '2' : '1'}/>
            <rect x="164" y="2" width="60" height="18" rx="4" fill={isTrue ? '#4ade8018' : 'transparent'} stroke={isTrue ? '#4ade8066' : '#4ade8022'} stroke-width="1"/>
            <text x="194" y="14" text-anchor="middle" fill={isTrue ? '#4ade80' : '#4ade8044'} font-size="8" font-weight="700" font-family="monospace">TRUE</text>
            <!-- FALSE path -->
            <line x1="130" y1="26" x2="160" y2="42" stroke={!isTrue ? '#f87171' : '#f8717133'} stroke-width={!isTrue ? '2' : '1'}/>
            <rect x="164" y="33" width="60" height="18" rx="4" fill={!isTrue ? '#f8717118' : 'transparent'} stroke={!isTrue ? '#f8717166' : '#f8717122'} stroke-width="1"/>
            <text x="194" y="45" text-anchor="middle" fill={!isTrue ? '#f87171' : '#f8717144'} font-size="8" font-weight="700" font-family="monospace">FALSE</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'output'}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="60" height="28" rx="5" fill="#34d39915" stroke="#34d39944" stroke-width="1"/>
            <text x="32" y="22" text-anchor="middle" fill="#34d399" font-size="8" font-weight="700" font-family="monospace">LOG</text>
            <polygon points="68,18 78,13 78,23" fill="#34d39966"/>
            <rect x="84" y="4" width="170" height="28" rx="5" fill="#11111a" stroke="#1a1a2e" stroke-width="1"/>
            <text x="94" y="22" fill="#34d399" font-size="8.5" font-family="monospace">$ {sd.output?.[sd.output.length - 1]?.slice(0, 22) ?? ''}</text>
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
            <text x="30" y="22" text-anchor="middle" fill={dsColor} font-size="8" font-weight="700" font-family="monospace">{dsLabel}</text>
            <polygon points="64,18 74,13 74,23" fill={dsColor + '66'}/>
            <rect x="80" y="4" width="84" height="28" rx="5" fill="#38bdf815" stroke="#38bdf844" stroke-width="1"/>
            <text x="122" y="22" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="700" font-family="monospace">{sd.highlight ?? 'arr'}</text>
            <polygon points="170,18 180,13 180,23" fill="#38bdf866"/>
            <rect x="186" y="4" width="28" height="28" rx="5" fill={dsColor + '15'} stroke={dsColor + '44'} stroke-width="1"/>
            <text x="200" y="23" text-anchor="middle" fill={dsColor} font-size="12" font-weight="700" font-family="monospace">{dsIcon}</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'fn-call' || sd.phase === 'fn-declare'}
        <div class="action-visual">
          <svg viewBox="0 0 280 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#f472b615" stroke="#f472b644" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#f472b6" font-size="8" font-weight="700" font-family="monospace">{sd.phase === 'fn-call' ? 'CALL' : 'DEF'}</text>
            <polygon points="78,18 88,13 88,23" fill="#f472b666"/>
            <rect x="94" y="4" width="90" height="28" rx="5" fill="#c084fc15" stroke="#c084fc44" stroke-width="1"/>
            <text x="139" y="22" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700" font-family="monospace">{sd.highlight ?? 'fn'}()</text>
            {#if sd.phase === 'fn-call'}
              <polygon points="190,18 200,13 200,23" fill="#c084fc66"/>
              <rect x="206" y="4" width="68" height="28" rx="5" fill="#818cf815" stroke="#818cf844" stroke-width="1"/>
              <text x="240" y="22" text-anchor="middle" fill="#818cf8" font-size="7" font-weight="700" font-family="monospace">PUSH STACK</text>
            {/if}
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'fn-return' || sd.phase === 'fn-return-assign'}
        <div class="action-visual">
          <svg viewBox="0 0 280 36" class="action-svg">
            <rect x="2" y="4" width="70" height="28" rx="5" fill="#fb923c15" stroke="#fb923c44" stroke-width="1"/>
            <text x="37" y="22" text-anchor="middle" fill="#fb923c" font-size="8" font-weight="700" font-family="monospace">RETURN</text>
            <polygon points="78,18 88,13 88,23" fill="#fb923c66"/>
            <rect x="94" y="4" width="80" height="28" rx="5" fill="#f59e0b15" stroke="#f59e0b44" stroke-width="1"/>
            <text x="134" y="22" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="700" font-family="monospace">{sd.memLabel?.replace(/^RETURN:\s*/, '').slice(0,10) ?? '...'}</text>
            <polygon points="180,18 190,13 190,23" fill="#f59e0b66"/>
            <rect x="196" y="4" width="68" height="28" rx="5" fill="#f8717115" stroke="#f8717144" stroke-width="1"/>
            <text x="230" y="22" text-anchor="middle" fill="#f87171" font-size="7" font-weight="700" font-family="monospace">POP STACK</text>
          </svg>
        </div>
      {/if}

      {#if sd.phase === 'done'}
        <div class="action-visual">
          <svg viewBox="0 0 260 36" class="action-svg">
            <rect x="2" y="4" width="256" height="28" rx="5" fill="#4ade8010" stroke="#4ade8033" stroke-width="1"/>
            <text x="130" y="22" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="700" font-family="monospace">
              {Object.keys(sd.vars || {}).length} vars | {sd.memOps || 0} writes | {sd.comps || 0} comparisons
            </text>
          </svg>
        </div>
      {/if}

      <!-- Explanation content — mode-dependent -->
      {#if explainMode === 'simple'}
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
          <details class="v8-details">
            <summary class="v8-toggle">
              <svg width="12" height="12" viewBox="0 0 12 12" class="v8-chip-icon">
                <rect x="1" y="1" width="10" height="10" rx="2" fill="#1a1a2e" stroke="#333" stroke-width="0.5"/>
                <text x="6" y="8.5" text-anchor="middle" fill="#666" font-size="6" font-weight="700" font-family="monospace">V8</text>
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
    background: color-mix(in srgb, var(--acc, #6366f1) 4%, var(--a11y-bg, #0a0a12));
    border: 1px solid color-mix(in srgb, var(--acc, #6366f1) 16%, rgba(255,255,255,0.06));
    border-radius:10px; overflow:hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.4);
  }
  .cpu-svg  { width:100%; height:auto; display:block; }

  /* ── Visual explanation panel ──────────────────────────────────────────── */
  .cpu-explain-panel { border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:0; }

  /* Phase badge row */
  .phase-row      { display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,255,255,0.02); }
  .phase-icon     { font-size:1rem; line-height:1; }
  .phase-label    { font-size:0.78rem; font-weight:700; letter-spacing:0.3px; }
  .phase-tag      { margin-left:auto; font-size:0.5rem; padding:2px 8px; border-radius:3px; border:1px solid; font-family:monospace; letter-spacing:1px; font-weight:600; }

  /* Mode toggle button */
  .mode-toggle    { background:transparent; border:1px solid rgba(255,255,255,0.12); border-radius:4px; padding:2px 8px; font-size:0.52rem; color:rgba(255,255,255,0.50); cursor:pointer; font-family:monospace; letter-spacing:0.3px; transition:all 0.15s; flex-shrink:0; }
  .mode-toggle:hover { border-color:var(--mode-color, #888); color:var(--mode-color, #ccc); }

  /* Simple mode explanation */
  .explain-simple { padding:8px 12px 10px; font-size:0.73rem; color:rgba(255,255,255,0.72); line-height:1.65; font-family:'Inter','SF Pro',system-ui,sans-serif; }

  /* Pipeline SVG (start phase) */
  .pipeline       { padding:6px 12px 2px; }
  .pipeline-svg   { width:100%; height:auto; display:block; }

  /* Action visuals (per-phase inline SVGs) */
  .action-visual  { padding:4px 12px; }
  .action-svg     { width:100%; max-width:320px; height:auto; display:block; }

  /* Loop iteration meter */
  .loop-meter       { display:flex; align-items:center; gap:8px; padding:0 12px; }
  .loop-meter-label { font-size:0.6rem; font-family:monospace; font-weight:600; flex-shrink:0; }
  .loop-meter-track { flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
  .loop-meter-fill  { height:100%; border-radius:3px; transition:width 0.3s ease; }
  .loop-meter-val   { font-size:0.7rem; font-family:monospace; font-weight:800; min-width:20px; text-align:right; }

  /* Summary line */
  .explain-summary  { padding:6px 12px 2px; font-size:0.73rem; color:rgba(255,255,255,0.88); font-weight:600; line-height:1.5; font-family:'Inter','SF Pro',system-ui,sans-serif; }

  /* Main explanation body */
  .explain-body     { padding:4px 12px 8px; font-size:0.68rem; color:rgba(255,255,255,0.55); line-height:1.65; white-space:pre-wrap; font-family:'Inter','SF Pro',system-ui,sans-serif; max-height:120px; overflow-y:auto; }

  /* ── Screen reader only utility ─────────────────────────────────────── */
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

  /* V8 Internals (collapsible) */
  .v8-details       { border-top:1px solid rgba(255,255,255,0.06); }
  .v8-toggle        { padding:6px 12px; font-size:0.58rem; color:rgba(255,255,255,0.38); cursor:pointer; font-family:monospace; letter-spacing:0.3px; display:flex; align-items:center; gap:6px; user-select:none; transition:color 0.15s; }
  .v8-toggle:hover  { color:rgba(255,255,255,0.70); }
  .v8-chip-icon     { flex-shrink:0; }
  .v8-body          { padding:6px 12px 10px; font-size:0.62rem; color:rgba(255,255,255,0.50); line-height:1.6; white-space:pre-wrap; font-family:'SF Mono','Fira Code','Consolas',monospace; margin:0; border:none; background:transparent; max-height:160px; overflow-y:auto; }

  /* ── Responsive: tablet ≤768px ───────────────────────────────────────── */
  @media (max-width: 768px) {
    .cpu-dash       { border-radius:6px; }
    .cpu-svg        { max-height:140px; }
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
    .cpu-svg        { max-height:110px; }
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
