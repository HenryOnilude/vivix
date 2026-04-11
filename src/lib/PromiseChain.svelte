<script>
  import ModuleShell from './ModuleShell.svelte';
  import { executePromiseChainCode } from './promise-chain-executor.js';

  const ACCENT = '#f59e0b';

  const examples = [
    {
      label: 'Basic .then() chain',
      code: 'Promise.resolve(1)\n  .then(x => x + 1)\n  .then(x => x * 3)\n  .then(x => console.log(x));',
      complexity: {
        time: 'O(n) microtasks',
        space: 'O(n) promises',
        timeWhy: 'Each .then() creates one microtask. n handlers = n microtask queue entries. They run sequentially — each fires after the previous Promise resolves.',
        spaceWhy: 'Each .then() allocates a new Promise on the heap. A chain of n handlers = n Promise objects in memory simultaneously.',
      },
    },
    {
      label: '.catch() error recovery',
      code: 'Promise.reject("network error")\n  .then(data => console.log(data))\n  .catch(err => "fallback value")\n  .then(val => console.log(val));',
      complexity: {
        time: 'O(n)',
        space: 'O(n)',
        timeWhy: '.then() handlers are skipped when the chain is rejected. Only .catch() fires. After recovery, .then() handlers continue normally.',
        spaceWhy: 'All Promise objects are allocated regardless of whether they resolve or reject. Skipped .then() handlers still create Promise wrappers.',
      },
    },
    {
      label: 'Data pipeline',
      code: 'Promise.resolve("  hello world  ")\n  .then(s => s.trim())\n  .then(s => s.toUpperCase())\n  .then(s => console.log(s));',
      complexity: {
        time: 'O(n) microtasks',
        space: 'O(n)',
        timeWhy: 'Three .then() handlers = three microtasks, processed one after another by the microtask queue. Still O(n) — n is the chain length.',
        spaceWhy: 'Each transformation creates a new string (strings are immutable in JS) plus a new Promise wrapper. 3 strings + 3 Promises on the heap.',
      },
    },
    {
      label: 'Chaining with functions',
      code: 'Promise.resolve(10)\n  .then(n => n * n)\n  .then(n => n + 5)\n  .then(n => n / 3)\n  .then(n => console.log(n));',
      complexity: {
        time: 'O(n)',
        space: 'O(n)',
        timeWhy: 'Linear chain of 4 microtasks. No branching, no loops. Each resolves the next in strict sequence.',
        spaceWhy: '4 Promise objects allocated. In practice, V8 optimizes short chains, but the logical model is one Promise per .then().',
      },
    },
  ];

  function executeCode(code) {
    return executePromiseChainCode(code);
  }

  function _stateColor(state) {
    if (state === 'resolved') return '#4ade80';
    if (state === 'rejected') return '#f87171';
    return '#fbbf24';
  }

  function _stateIcon(state) {
    if (state === 'resolved') return '✓';
    if (state === 'rejected') return '✕';
    return '…';
  }
</script>

<!-- ── Promise Chain module ──────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="promise-chain"
  titlePrefix="promise"
  titleAccent="Chain"
  subtitle="— Promise Methods"
  desc="See how .then() and .catch() chain together through the microtask queue"
  {executeCode}
  showHeap={false}
>

  {#snippet topPanel(sd)}
    <!-- Brain: engine explanation -->
    <div class="brain-panel">
      <div class="brain-hdr">
        <span class="brain-title">Engine</span>
        {#if sd.phase === 'promise-resolve'}
          <span class="pc-badge resolved">✓ resolved</span>
        {:else if sd.phase === 'promise-reject'}
          <span class="pc-badge rejected">✕ rejected</span>
        {:else if sd.phase === 'then-queue'}
          <span class="pc-badge queued">⏳ microtask queued</span>
        {:else if sd.phase === 'then-run'}
          <span class="pc-badge running">⚡ microtask fires</span>
        {:else if sd.phase === 'then-skip'}
          <span class="pc-badge skipped">⊘ skipped</span>
        {:else if sd.phase === 'catch-run'}
          <span class="pc-badge caught">⚠ caught</span>
        {/if}
      </div>
      <div class="brain-box"
        class:brain-reject={sd.isRejected}
        class:brain-catch={sd.phase === 'catch-run'}
        class:brain-fire={sd.phase === 'then-run'}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
    </div>

    <!-- Promise chain visualization -->
    <div class="chain-panel">
      <div class="chain-hdr">Promise Chain</div>
      <div class="chain-nodes">
        {#if sd.promises && sd.promises.length > 0}
          {#each sd.promises as p, i}
            <div class="chain-node" style="--node-color:{_stateColor(p.state)}">
              <div class="node-label">{p.label}</div>
              <div class="node-state">{_stateIcon(p.state)} {p.state}</div>
              <div class="node-value" title={p.value}>{p.value.length > 12 ? p.value.slice(0, 12) + '…' : p.value}</div>
              <div class="node-method">.{p.method}()</div>
            </div>
            {#if i < sd.promises.length - 1}
              <div class="chain-arrow">→</div>
            {/if}
          {/each}
        {:else}
          <div class="chain-empty">No Promises yet</div>
        {/if}
      </div>
    </div>

    <!-- Microtask queue + current value -->
    <div class="runtime-row">
      <div class="runtime-panel">
        <div class="runtime-hdr">Microtask Queue</div>
        <div class="mt-box">
          {#if sd.microTasks && sd.microTasks.length > 0}
            {#each sd.microTasks as mt, i}
              <div class="mt-item" class:mt-next={i === 0}>
                {#if i === 0}<span class="mt-arrow">▶</span>{/if}
                {mt}
              </div>
            {/each}
          {:else}
            <div class="mt-empty">empty</div>
          {/if}
        </div>
      </div>

      <div class="runtime-panel">
        <div class="runtime-hdr">Current Value</div>
        <div class="cv-box">
          {#if sd.currentValue !== undefined && sd.currentValue !== null}
            <div class="cv-value" style="color:{sd.isRejected ? '#f87171' : ACCENT}">
              {sd.currentValue}
            </div>
            <div class="cv-state" style="color:{sd.isRejected ? '#f87171' : '#4ade80'}">
              {sd.isRejected ? '✕ rejected' : '✓ resolved'}
            </div>
          {:else}
            <div class="cv-empty">—</div>
          {/if}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.thenCount || 0} .then(){(sd.thenCount || 0) !== 1 ? 's' : ''} fired
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#f87171"/></svg>
      {sd.catchCount || 0} .catch(){(sd.catchCount || 0) !== 1 ? 'es' : ''} processed
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#4ade80"/></svg>
      {sd.promises?.length || 0} Promises
    </span>
  {/snippet}

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 200" class="ph-svg">
        <rect x="20"  y="80" width="80" height="44" rx="6" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.5)" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="60"  y="98"  text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="9"  font-family="monospace">P1</text>
        <text x="60"  y="112" text-anchor="middle" fill="#4ade80"              font-size="8"  font-family="monospace">✓ resolved</text>
        <text x="60"  y="124" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8"  font-family="monospace">value: 1</text>
        <line x1="100" y1="102" x2="130" y2="102" stroke="rgba(245,158,11,0.4)" stroke-width="1.5" marker-end="url(#arr)"/>
        <rect x="130" y="80" width="80" height="44" rx="6" fill="rgba(245,158,11,0.06)" stroke="rgba(245,158,11,0.35)" stroke-width="1.5" stroke-dasharray="5 3"/>
        <text x="170" y="98"  text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="9"  font-family="monospace">P2</text>
        <text x="170" y="112" text-anchor="middle" fill="rgba(74,222,128,0.5)" font-size="8"  font-family="monospace">⏳ pending</text>
        <line x1="210" y1="102" x2="240" y2="102" stroke="rgba(245,158,11,0.2)" stroke-width="1.5"/>
        <rect x="240" y="80" width="80" height="44" rx="6" fill="rgba(245,158,11,0.04)" stroke="rgba(245,158,11,0.2)" stroke-width="1" stroke-dasharray="5 3"/>
        <text x="280" y="98"  text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="9"  font-family="monospace">P3</text>
        <text x="280" y="112" text-anchor="middle" fill="rgba(74,222,128,0.3)" font-size="8"  font-family="monospace">⏳ pending</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see the promise chain</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .brain-panel { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .brain-hdr   { display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .brain-title { font-size: 0.55rem; color: #555; font-family: monospace; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; }
  .brain-box   { padding: 8px 10px; transition: background 0.3s; }
  .brain-box.brain-reject { background: rgba(248,113,113,0.05); }
  .brain-box.brain-catch  { background: rgba(251,191,36,0.05); }
  .brain-box.brain-fire   { background: rgba(245,158,11,0.06); }
  .brain-text  { font-size: 0.62rem; color: var(--a11y-text-sec, #c8c8d4); line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: 'Geist Mono', monospace; }

  .pc-badge   { font-size: 0.5rem; font-weight: 700; font-family: monospace; padding: 2px 7px; border-radius: 8px; }
  .pc-badge.resolved { background: rgba(74,222,128,0.15); color: #4ade80; }
  .pc-badge.rejected { background: rgba(248,113,113,0.15); color: #f87171; }
  .pc-badge.queued   { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .pc-badge.running  { background: rgba(245,158,11,0.2);  color: #fbbf24; }
  .pc-badge.skipped  { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .pc-badge.caught   { background: rgba(251,191,36,0.15); color: #fbbf24; }

  /* ── Chain visualization ─────────────────────────────────────────── */
  .chain-panel  { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .chain-hdr    { font-size: 0.55rem; color: #555; font-family: monospace; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .chain-nodes  { display: flex; align-items: center; gap: 4px; padding: 10px 12px; flex-wrap: wrap; }
  .chain-empty  { font-size: 0.6rem; color: #333; font-family: monospace; }

  .chain-node   { display: flex; flex-direction: column; align-items: center; gap: 2px; background: color-mix(in srgb, var(--node-color) 8%, transparent); border: 1px solid color-mix(in srgb, var(--node-color) 35%, transparent); border-radius: 6px; padding: 6px 10px; min-width: 72px; transition: all 0.3s; }
  .node-label   { font-size: 0.65rem; font-weight: 800; font-family: monospace; color: var(--node-color); }
  .node-state   { font-size: 0.48rem; font-family: monospace; color: var(--node-color); opacity: 0.85; }
  .node-value   { font-size: 0.58rem; font-family: monospace; color: rgba(255,255,255,0.7); max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node-method  { font-size: 0.44rem; font-family: monospace; color: rgba(255,255,255,0.3); }

  .chain-arrow  { font-size: 0.75rem; color: rgba(245,158,11,0.4); }

  /* ── Runtime row ─────────────────────────────────────────────────── */
  .runtime-row    { display: flex; gap: 6px; flex-shrink: 0; }
  .runtime-panel  { flex: 1; background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; }
  .runtime-hdr    { font-size: 0.55rem; color: #555; font-family: monospace; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }

  .mt-box   { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; min-height: 48px; }
  .mt-item  { display: flex; align-items: center; gap: 5px; font-size: 0.55rem; font-family: monospace; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.03); border-radius: 4px; padding: 3px 7px; }
  .mt-item.mt-next { color: #f59e0b; background: rgba(245,158,11,0.08); }
  .mt-arrow { color: #f59e0b; font-size: 0.55rem; }
  .mt-empty { font-size: 0.55rem; color: #333; font-family: monospace; }

  .cv-box   { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px; min-height: 48px; }
  .cv-value { font-size: 1rem; font-weight: 800; font-family: monospace; }
  .cv-state { font-size: 0.5rem; font-family: monospace; }
  .cv-empty { font-size: 0.6rem; color: #333; font-family: monospace; }

  .vis-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .ph-svg   { width: 360px; height: auto; }
  .ph-text  { font-size: 0.78rem; color: rgba(255,255,255,0.45); text-align: center; }

  .cx-s { display: flex; align-items: center; gap: 4px; font-size: 0.55rem; color: #444; font-family: monospace; }
</style>
