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

  /** @type {{ sd: object, step: number, total: number, accent: string, phColor: (ph:string)=>string, registers?: import('svelte').Snippet, gauge?: import('svelte').Snippet, stack?: import('svelte').Snippet }} */
  let { sd, step, total, accent, phColor, registers, gauge, stack: stackSnippet } = $props();

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
</script>

<div class="cpu-dash">
  <svg viewBox="0 0 360 130" class="cpu-svg">
    <!-- Background -->
    <rect x="0" y="0" width="360" height="130" rx="8" fill="#0a0a12" stroke="#1a1a2e" stroke-width="1"/>

    <!-- Progress ring (top-left) -->
    <circle cx="36" cy="40" r="22" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <circle cx="36" cy="40" r="22" fill="none" stroke={phColor(sd.phase)} stroke-width="3"
      stroke-dasharray={2 * Math.PI * 22}
      stroke-dashoffset={2 * Math.PI * 22 * (1 - (total > 1 ? step / (total - 1) : 0))}
      stroke-linecap="round" transform="rotate(-90 36 40)"/>
    <text x="36" y="37" text-anchor="middle" fill="#e0e0e0" font-size="11" font-weight="800" font-family="monospace">{step + 1}</text>
    <text x="36" y="47" text-anchor="middle" fill="#333" font-size="7" font-family="monospace">/{total}</text>

    <!-- CPU chip -->
    <rect x="72" y="18" width="44" height="44" rx="6" fill="#0d0d18" stroke={phColor(sd.phase)} stroke-width="1.5"/>
    <rect x="80" y="26" width="28" height="28" rx="3" fill={phColor(sd.phase)} opacity="0.1"/>
    {#each [0, 1, 2] as p}
      <rect x={83 + p * 9} y="13"  width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.4"/>
      <rect x={83 + p * 9} y="62"  width="4" height="5" rx="1" fill={phColor(sd.phase)} opacity="0.4"/>
      <rect x="67"  y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.4"/>
      <rect x="116" y={29 + p * 9} width="5" height="4" rx="1" fill={phColor(sd.phase)} opacity="0.4"/>
    {/each}
    <!-- Operation symbol -->
    <text x="94" y="46" text-anchor="middle" fill={phColor(sd.phase)} font-size="16" font-weight="800" font-family="monospace">
      {phSymbol(sd.phase)}
    </text>

    <!-- PC register -->
    <rect x="132" y="14" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="138" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">PC</text>
    <text x="194" y="29" text-anchor="end" fill={phColor(sd.phase)} font-size="10" font-weight="700" font-family="monospace">
      {sd.lineIndex >= 0 ? 'LINE ' + (sd.lineIndex + 1) : sd.phase === 'start' ? 'READY' : 'END'}
    </text>

    <!-- OP register -->
    <rect x="132" y="40" width="68" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="138" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OP</text>
    <text x="194" y="55" text-anchor="end" fill={phColor(sd.phase)} font-size="9" font-weight="700" font-family="monospace">{sd.phase.toUpperCase()}</text>

    <!-- Module-specific right-column registers (x ≥ 210) -->
    {#if registers}{@render registers(sd)}{/if}

    <!-- WRITES gauge (left, always shown) -->
    <rect x="132" y="68" width="108" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="133" y="69" width={Math.min(106, (sd.memOps || 0) * 14)} height="14" rx="2" fill="#f59e0b" opacity="0.2"/>
    <text x="138" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.memOps || 0} WRITES</text>

    <!-- Module-specific right gauge -->
    {#if gauge}
      {@render gauge(sd)}
    {:else}
      <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    {/if}

    <!-- Stack visual (bottom-left) -->
    <text x="10" y="78" fill="#333" font-size="6" font-family="monospace" letter-spacing="1">STACK</text>
    {#if stackSnippet}
      {@render stackSnippet(sd)}
    {:else if !sd.done}
      <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#4ade8044" stroke-width="1"/>
      <text x="16" y="93" fill="#4ade80" font-size="7.5" font-weight="600" font-family="monospace">Global</text>
      <text x="112" y="93" text-anchor="end" fill="#333" font-size="6.5" font-family="monospace">{Object.keys(sd.vars || {}).length} vars</text>
    {:else}
      <rect x="10" y="82" width="108" height="16" rx="3" fill="#0d0d18" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="64" y="93" text-anchor="middle" fill="#222" font-size="7" font-family="monospace">empty</text>
    {/if}

    <!-- Hint text -->
    <text x="10" y="122" fill="#444" font-size="8" font-family="system-ui, sans-serif">{sd.memLabel || ''}</text>
  </svg>

  {#if sd.brain}
    <div class="cpu-explain">{sd.brain}</div>
  {/if}
</div>

<style>
  .cpu-dash { flex-shrink:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; }
  .cpu-svg  { width:100%; height:auto; display:block; }
  .cpu-explain { padding:8px 12px; font-size:0.75rem; color:#c0c0c0; line-height:1.6; border-top:1px solid #1a1a2e; white-space:pre-wrap; font-family:'SF Mono','Fira Code',monospace; }
</style>
