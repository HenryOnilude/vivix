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

  // One-line summary of the engine narrative. We show this inside the
  // <summary> of the collapsed <details> so Deep-Dive users get a quick
  // sense of what's happening without the full three-paragraph block.
  function _brainTldr(brain) {
    if (!brain) return '';
    const first = brain.split(/\n+/).map(s => s.trim()).find(Boolean) || '';
    return first.length > 96 ? first.slice(0, 94) + '…' : first;
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
    <!-- ── Hero row: Promise Chain (1fr) + Microtask Queue (1.6fr) ────
         Visual-first ordering per UX review. The microtask queue is
         the "where does this run" explanation — it gets the larger
         share of the row. The chain panel shows WHICH promises exist
         and their state; the current resolved value folds into the
         chain header as a small badge (no dedicated Current Value
         panel any more — the active node's own value chip covers it).
    -->
    <div class="pc-hero-row">
      <!-- Chain panel (left) -->
      <div class="chain-panel pc-hero-chain">
        <div class="chain-hdr">
          <span>Promise Chain</span>
          {#if sd.currentValue !== undefined && sd.currentValue !== null}
            <span class="chain-cv-badge" style="color:{sd.isRejected ? '#f87171' : ACCENT}">
              {sd.isRejected ? '✕' : '✓'}
              <span class="chain-cv-val" title={String(sd.currentValue)}>{String(sd.currentValue).length > 18 ? String(sd.currentValue).slice(0,16) + '…' : sd.currentValue}</span>
            </span>
          {/if}
        </div>
        <div class="chain-nodes">
          {#if sd.promises && sd.promises.length > 0}
            {#each sd.promises as p, i (p.label)}
              <div class="chain-node pc-node-pop" style="--node-color:{_stateColor(p.state)}">
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
            <!-- Silent skeleton: two ghosted node placeholders mirroring the
                 .chain-node rhythm. Replaces "No Promises yet" copy which
                 read as a loading state on step 1. -->
            <div class="chain-skeleton" aria-hidden="true">
              <div class="chain-skeleton-node"></div>
              <div class="chain-skeleton-node"></div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Microtask queue (right, hero) -->
      <div class="mt-panel-hero">
        <div class="mt-hero-hdr">
          <span>Microtask Queue</span>
          <span class="mt-hero-count">{(sd.microTasks || []).length} queued</span>
        </div>
        <div class="mt-hero-body">
          {#if sd.microTasks && sd.microTasks.length > 0}
            {#each sd.microTasks as mt, i}
              <div class="mt-item-hero" class:mt-next={i === 0}>
                {#if i === 0}<span class="mt-arrow-hero">▶</span>{:else}<span class="mt-dot">·</span>{/if}
                <span class="mt-text">{mt}</span>
              </div>
            {/each}
          {:else}
            <div class="mt-empty-hero" aria-hidden="true">
              <div class="mt-empty-skel"></div>
              <div class="mt-empty-skel"></div>
              <div class="mt-empty-skel mt-empty-skel-short"></div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- ── Engine narrative — Deep Dive only, collapsed to one line ──
         Moved below the hero visuals per UX review. The chain +
         microtask panels carry the story visually; the engine text
         is a bonus for users who opt into Deep Dive AND click the
         disclosure triangle. First non-empty line of `sd.brain` is
         shown as a TL;DR inside the <summary>. -->
    <details class="brain-panel brain-details dl-deep">
      <summary class="brain-summary">
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
        <span class="brain-tldr">{_brainTldr(sd.brain)}</span>
        <span class="brain-toggle" aria-hidden="true"></span>
      </summary>
      <div class="brain-box"
        class:brain-reject={sd.isRejected}
        class:brain-catch={sd.phase === 'catch-run'}
        class:brain-fire={sd.phase === 'then-run'}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
    </details>
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
        <text x="60"  y="98"  text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="9"  font-family="'Geist Mono', monospace">P1</text>
        <text x="60"  y="112" text-anchor="middle" fill="#4ade80"              font-size="8"  font-family="'Geist Mono', monospace">✓ resolved</text>
        <text x="60"  y="124" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8"  font-family="'Geist Mono', monospace">value: 1</text>
        <line x1="100" y1="102" x2="130" y2="102" stroke="rgba(245,158,11,0.4)" stroke-width="1.5" marker-end="url(#arr)"/>
        <rect x="130" y="80" width="80" height="44" rx="6" fill="rgba(245,158,11,0.06)" stroke="rgba(245,158,11,0.35)" stroke-width="1.5" stroke-dasharray="5 3"/>
        <text x="170" y="98"  text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="9"  font-family="'Geist Mono', monospace">P2</text>
        <text x="170" y="112" text-anchor="middle" fill="rgba(74,222,128,0.5)" font-size="8"  font-family="'Geist Mono', monospace">⏳ pending</text>
        <line x1="210" y1="102" x2="240" y2="102" stroke="rgba(245,158,11,0.2)" stroke-width="1.5"/>
        <rect x="240" y="80" width="80" height="44" rx="6" fill="rgba(245,158,11,0.04)" stroke="rgba(245,158,11,0.2)" stroke-width="1" stroke-dasharray="5 3"/>
        <text x="280" y="98"  text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="9"  font-family="'Geist Mono', monospace">P3</text>
        <text x="280" y="112" text-anchor="middle" fill="rgba(74,222,128,0.3)" font-size="8"  font-family="'Geist Mono', monospace">⏳ pending</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see the promise chain</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Engine panel is now a collapsed <details>. The visual hero row
     (chain + microtask) comes first in the DOM; engine sits last. On
     mobile we also push it to flex `order: 99` as a belt-and-braces
     guarantee that text never precedes visuals in the flow. */
  .brain-panel         { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .brain-details       { order: 99; } /* mobile safety — always last */
  .brain-toggle::after                      { content: 'see more'; }
  .brain-details[open] .brain-toggle::after { content: 'see less'; }
  .brain-summary       { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--a11y-surface2); border-bottom: 1px solid transparent; cursor: pointer; list-style: none; user-select: none; }
  .brain-summary::-webkit-details-marker { display:none; }
  .brain-details[open] .brain-summary { border-bottom-color: var(--a11y-border); }
  .brain-title         { font-size: 0.55rem; color: #555; font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
  .brain-tldr          { flex: 1; min-width: 0; font-size: 0.66rem; color: var(--a11y-text-sec, #c8c8d4); font-family: var(--font-code); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brain-toggle        { font-size: 0.55rem; color: var(--acc, #f59e0b); font-family: var(--font-code); letter-spacing: 0.6px; text-transform: uppercase; flex-shrink: 0; }
  .brain-box           { padding: 8px 10px; transition: background 0.3s; }
  .brain-box.brain-reject { background: rgba(248,113,113,0.05); }
  .brain-box.brain-catch  { background: rgba(251,191,36,0.05); }
  .brain-box.brain-fire   { background: rgba(245,158,11,0.06); }
  .brain-text          { font-size: 0.62rem; color: var(--a11y-text-sec, #c8c8d4); line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: var(--font-code); }

  .pc-badge   { font-size: 0.5rem; font-weight: 700; font-family: var(--font-code); padding: 2px 7px; border-radius: 8px; }
  .pc-badge.resolved { background: rgba(74,222,128,0.15); color: #4ade80; }
  .pc-badge.rejected { background: rgba(248,113,113,0.15); color: #f87171; }
  .pc-badge.queued   { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .pc-badge.running  { background: rgba(245,158,11,0.2);  color: #fbbf24; }
  .pc-badge.skipped  { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .pc-badge.caught   { background: rgba(251,191,36,0.15); color: #fbbf24; }

  /* ── Hero row (chain + microtask side-by-side) ───────────────────── */
  .pc-hero-row   { display: grid; grid-template-columns: 1fr 1.6fr; gap: 8px; flex-shrink: 0; }
  @media (max-width: 720px) {
    .pc-hero-row { grid-template-columns: 1fr; }
  }
  .pc-hero-chain { min-width: 0; }

  /* ── Chain visualization ─────────────────────────────────────────── */
  .chain-panel  { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .chain-hdr    { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size: 0.66rem; color: rgba(255,255,255,0.95); font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 800; text-transform: uppercase; padding: 6px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .chain-cv-badge { display:inline-flex; align-items:center; gap:4px; font-size: 0.62rem; font-weight: 700; font-family: var(--font-code); text-transform: none; letter-spacing: 0; }
  .chain-cv-val   { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chain-nodes  { display: flex; align-items: center; gap: 4px; padding: 10px 12px; flex-wrap: wrap; }
  /* Gentle pop-in so each new chain node registers visually as the
     chain grows. No transform on the settled state — so this only
     reads as a "just appeared" cue, not permanent motion. */
  .pc-node-pop   { animation: vx-pc-node-pop 0.32s ease-out both; }
  @keyframes vx-pc-node-pop {
    from { transform: scale(0.82); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  /* Silent skeleton replaces the old "No Promises yet" copy. Two
     ghosted nodes hint at the chain layout without a loading-state
     feel on step 1. */
  .chain-skeleton      { display: flex; align-items: center; gap: 4px; padding: 10px 12px; }
  .chain-skeleton-node {
    width: 76px; height: 36px; border-radius: 6px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 0%,
      rgba(255,255,255,0.10) 50%,
      rgba(255,255,255,0.04) 100%);
    background-size: 200% 100%;
    border: 1.5px dashed rgba(255,255,255,0.10);
    animation: vx-chain-skeleton 2.4s ease-in-out infinite;
  }
  .chain-skeleton-node:nth-child(2) { animation-delay: 0.25s; }
  @keyframes vx-chain-skeleton {
    0%, 100% { background-position: 100% 0; opacity: 0.7; }
    50%      { background-position: 0% 0;   opacity: 1; }
  }

  .chain-node   { display: flex; flex-direction: column; align-items: center; gap: 3px; background: color-mix(in srgb, var(--node-color) 14%, transparent); border: 1.5px solid color-mix(in srgb, var(--node-color) 60%, transparent); border-radius: 6px; padding: 7px 11px; min-width: 76px; transition: all 0.3s; }
  .node-label   { font-size: 0.78rem; font-weight: 800; font-family: var(--font-code); color: var(--node-color); letter-spacing: 0.5px; }
  .node-state   { font-size: 0.62rem; font-weight: 700; font-family: var(--font-code); color: var(--node-color); opacity: 1; }
  .node-value   { font-size: 0.7rem; font-weight: 700; font-family: var(--font-code); color: #f1f5f9; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node-method  { font-size: 0.58rem; font-weight: 600; font-family: var(--font-code); color: rgba(255,255,255,0.7); }

  .chain-arrow  { font-size: 0.95rem; font-weight: 800; color: #f59e0b; }

  /* ── Microtask queue (hero) ──────────────────────────────────────── */
  /* This panel replaces the old .runtime-panel/.mt-box treatment. The
     type scale is ~30% larger and each queued microtask reads as a
     first-class row rather than a tiny chip — reflects that the
     microtask queue IS the core promise-chain story. */
  .mt-panel-hero { min-width: 0; background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .mt-hero-hdr   { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); font-size: 0.82rem; font-weight: 800; font-family: var(--font-code); letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.96); }
  .mt-hero-count { font-size: 0.62rem; font-weight: 700; color: rgba(245,158,11,0.9); letter-spacing: 0.5px; text-transform: none; background: rgba(245,158,11,0.10); border: 1px solid rgba(245,158,11,0.28); border-radius: 999px; padding: 2px 8px; }
  .mt-hero-body  { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; min-height: 96px; flex: 1; }
  .mt-item-hero  { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; font-weight: 600; font-family: var(--font-code); color: rgba(255,255,255,0.88); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 8px 12px; }
  .mt-item-hero.mt-next { color: #fbbf24; font-weight: 800; background: rgba(245,158,11,0.16); border-color: rgba(245,158,11,0.55); box-shadow: 0 0 0 1px rgba(245,158,11,0.35), 0 0 12px rgba(245,158,11,0.20); animation: vx-mt-pulse 1.4s ease-in-out infinite; }
  @keyframes vx-mt-pulse {
    0%, 100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.35), 0 0 12px rgba(245,158,11,0.20); }
    50%      { box-shadow: 0 0 0 2px rgba(245,158,11,0.55), 0 0 18px rgba(245,158,11,0.35); }
  }
  .mt-arrow-hero { color: #fbbf24; font-weight: 900; font-size: 0.95rem; }
  .mt-dot        { color: rgba(255,255,255,0.35); font-weight: 700; font-size: 0.95rem; width: 0.95rem; text-align: center; }
  .mt-text       { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Skeleton for the empty microtask queue — matches the hero sizing */
  .mt-empty-hero { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .mt-empty-skel { height: 32px; border-radius: 6px;
    background: linear-gradient(90deg,
      rgba(245,158,11,0.05) 0%,
      rgba(245,158,11,0.14) 50%,
      rgba(245,158,11,0.05) 100%);
    background-size: 200% 100%;
    border: 1px dashed rgba(245,158,11,0.22);
    animation: vx-mt-empty 2.4s ease-in-out infinite;
  }
  .mt-empty-skel:nth-child(2) { animation-delay: 0.2s; }
  .mt-empty-skel-short { width: 60%; animation-delay: 0.4s; }
  @keyframes vx-mt-empty {
    0%, 100% { background-position: 100% 0; opacity: 0.7; }
    50%      { background-position: 0% 0;   opacity: 1; }
  }

  .vis-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .ph-svg   { width: 360px; height: auto; }
  .ph-text  { font-size: 0.82rem; color: rgba(255,255,255,0.7); text-align: center; }

  .cx-s { display: flex; align-items: center; gap: 4px; font-size: 0.66rem; font-weight: 600; color: rgba(255,255,255,0.85); font-family: var(--font-code); }
</style>
