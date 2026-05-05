<script>
  import ModuleShell from './ModuleShell.svelte';
  import { dc } from './utils.js';
  import { executeAsyncCode, _fv } from './async-executor.js';

  const ACCENT = '#cc88ff';

  const examples = [
    {
      label: 'Sequential awaits',
      code: 'async function fetchData() {\n  let user = await getUser();\n  let posts = await getPosts(user.id);\n  let comments = await getComments(posts[0]);\n  return comments;\n}',
      complexity: { time: 'O(n) sequential', space: 'O(1)', timeWhy: 'Each await blocks until the previous completes. Total time = sum of all delays. Three requests run one after another: T = t1 + t2 + t3.', spaceWhy: 'Only one response held in memory at a time (previous results stored in variables). No parallel buffers.' }
    },
    {
      label: 'Promise.all (parallel)',
      code: 'async function fetchAll() {\n  let results = await Promise.all([\n    getUser(),\n    getPosts(1),\n    getComments(1)\n  ]);\n  return results;\n}',
      complexity: { time: 'O(1) parallel — max(t1,t2,t3)', space: 'O(n)', timeWhy: 'All three requests fire simultaneously. Total time = the SLOWEST one. This is the key advantage of Promise.all.', spaceWhy: 'All responses are buffered in memory at once until all resolve. n promises = n results in the array.' }
    },
    {
      label: 'Promise.race',
      code: 'async function fastest() {\n  let winner = await Promise.race([\n    slowAPI(),\n    fastAPI(),\n    mediumAPI()\n  ]);\n  return winner;\n}',
      complexity: { time: 'O(1) — min(t1,t2,t3)', space: 'O(n)', timeWhy: 'Returns as soon as the FIRST promise settles. The others are still running but their results are ignored.', spaceWhy: 'All promises are created and running in parallel. Memory for all n is allocated even though only 1 result is used.' }
    },
    {
      label: 'try/catch error handling',
      code: 'async function safeFetch() {\n  let data = null;\n  try {\n    data = await riskyAPI();\n  } catch (err) {\n    data = "fallback";\n  }\n  return data;\n}',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One async call. If it rejects, the catch block runs synchronously — no extra time cost.', spaceWhy: 'Either the resolved value or the fallback — only one is stored.' }
    },
    {
      label: 'Sequential vs Parallel',
      code: 'async function compare() {\n  // Sequential: slow\n  let a = await taskA();\n  let b = await taskB();\n\n  // Parallel: fast\n  let [c, d] = await Promise.all([\n    taskA(),\n    taskB()\n  ]);\n}',
      complexity: { time: 'Seq: O(t1+t2) vs Par: O(max(t1,t2))', space: 'O(1) vs O(n)', timeWhy: 'Sequential: each await blocks. Total = 500ms + 500ms = 1000ms.\nParallel: both fire at once. Total = max(500, 500) = 500ms.\nParallel is 2× faster here!', spaceWhy: 'Sequential holds one result at a time. Parallel buffers all results until all complete.' }
    }
  ];

  // ── Use extracted async executor (testable) ──────────────────
  function executeCode(code) { return executeAsyncCode(code); }

  function _tc(val) {
    if (typeof val === 'number') return '#ffcc66'; if (typeof val === 'string') return '#ff8866';
    if (typeof val === 'boolean') return val ? '#00ff88' : '#ff4466';
    if (Array.isArray(val)) return '#88aaff'; if (typeof val === 'object') return '#cc88ff'; return '#aaa';
  }

  function _tb(val) {
    if (Array.isArray(val)) return 'arr'; if (typeof val === 'number') return 'num';
    if (typeof val === 'string') return 'str'; if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'object') return 'obj'; return '?';
  }

  // One-line TL;DR shown inside the collapsed <details> summary so the
  // engine block occupies ~1 line by default. First non-empty line of
  // the full narrative is used.
  function _brainTldr(brain) {
    if (!brain) return '';
    const first = brain.split(/\n+/).map(s => s.trim()).find(Boolean) || '';
    return first.length > 96 ? first.slice(0, 94) + '…' : first;
  }

  // Event-loop status derived from the current phase. Surfaces the
  // "what is the runtime doing right now?" state next to the panel
  // header so users see IDLE → RUNNING → WAITING → TICK at a glance
  // rather than having to parse the brain narrative.
  function _eventLoopState(sd) {
    if (!sd) return { key: 'idle', label: 'IDLE' };
    const ph = sd.phase || '';
    const hasMicro = (sd.microTasks || []).length > 0;
    const hasStack = (sd.callStack || []).length > 0;
    if (sd.done) return { key: 'idle', label: 'IDLE' };
    if (ph === 'suspended' || ph === 'await-start') return { key: 'waiting', label: 'WAITING' };
    if (hasMicro || ph === 'microtask' || ph === 'await-resume') return { key: 'tick', label: 'TICK' };
    if (hasStack) return { key: 'running', label: 'RUNNING' };
    return { key: 'idle', label: 'IDLE' };
  }
</script>

<svelte:head>
  <title>Async/Await & Microtask Queue Visualizer | Vivix</title>
  <meta name="description" content="Watch async/await execution step by step. See how the event loop, microtask queue, and call stack interact when JavaScript processes promises." />
</svelte:head>

<!-- ── AsyncAwait module ──────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="async"
  titlePrefix="async"
  titleAccent="Await"
  subtitle="— Asynchronous"
  desc="See how the event loop, call stack, and microtask queue work together for async code"
  {executeCode}
  showHeap={false}
>

  {#snippet topPanel(sd)}
    {@const suspending = sd.phase === 'await-start' || sd.phase === 'suspended'}
    {@const elState    = _eventLoopState(sd)}

    <!-- ── Hero row: Call Stack + Event Loop ────────────────────────────
         These two panels ARE the async/await story — bumped ~3× from
         their original sizing and pulled to the top of the view so
         the suspend/resume moment is the first thing visible. The
         engine narrative (previously stacked above) now sits at the
         bottom of the column, collapsed behind a <details>.
    -->
    <div class="runtime-row runtime-row-hero">
      <div class="runtime-panel">
        <div class="runtime-hdr runtime-hdr-hero">
          <span>Call Stack</span>
          {#if suspending}
            <span class="cs-status cs-status-suspend">⏸ suspending</span>
          {:else if (sd.callStack || []).length > 0}
            <span class="cs-status cs-status-running">▶ {sd.callStack.length} frame{sd.callStack.length !== 1 ? 's' : ''}</span>
          {:else}
            <span class="cs-status cs-status-idle">○ idle</span>
          {/if}
        </div>
        <div class="stack-box stack-box-hero">
          {#each [...(sd.callStack || [])].reverse() as frame, i}
            <div class="stack-frame stack-frame-hero"
                 class:stack-top={i === 0}
                 class:stack-suspending={i === 0 && suspending}>
              <span class="stack-name">{frame}</span>
              {#if i === 0}
                {#if suspending}
                  <span class="stack-arrow stack-arrow-suspend">⏸ about to leave</span>
                {:else}
                  <span class="stack-arrow">← running</span>
                {/if}
              {/if}
            </div>
          {/each}
          {#if !sd.callStack || sd.callStack.length === 0}
            <div class="stack-empty stack-empty-hero">— empty (event loop idle) —</div>
          {/if}
        </div>
      </div>

      <div class="runtime-panel">
        <div class="runtime-hdr runtime-hdr-hero">
          <span>Event Loop</span>
          <span class="el-status el-status-{elState.key}">
            <span class="el-dot"></span>{elState.label}
          </span>
        </div>
        <div class="event-box event-box-hero">
          {#if sd.eventLoop && sd.eventLoop.length > 0}
            {#each sd.eventLoop as evt}
              <div class="event-item event-item-hero">{evt}</div>
            {/each}
          {:else}
            <div class="event-empty event-empty-hero">
              {elState.key === 'waiting' ? 'awaiting microtask resolution…'
              : elState.key === 'idle'   ? '— idle —'
              : '(no macrotasks queued)'}
            </div>
          {/if}
          {#if sd.microTasks && sd.microTasks.length > 0}
            <div class="micro-label micro-label-hero">Microtasks ({sd.microTasks.length})</div>
            {#each sd.microTasks as mt}
              <div class="micro-item micro-item-hero">{mt}</div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Variables in current frame -->
    <div class="frames-panel">
      <div class="runtime-hdr">Frames</div>
      <div class="frame-box">
        {#if sd.vars && Object.keys(sd.vars).length > 0}
          {#each Object.entries(sd.vars) as [key, val]}
            <div class="var-row" class:var-flash={sd.highlight === key}>
              <div class="var-left">
                <span class="var-name">{key}</span>
                <span class="var-type" style="color:{_tc(val)}">{_tb(val)}</span>
              </div>
              <span class="var-value" style="color:{_tc(val)}">{_fv(val)}</span>
            </div>
          {/each}
        {:else}
          <!-- Silent skeleton: two faint rows signalling where heap
               variables will land. Replaces the "No variables yet"
               copy which read as a loading state on step 1. -->
          <div class="var-skeleton" aria-hidden="true">
            <div class="var-skeleton-row"></div>
            <div class="var-skeleton-row"></div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Engine narrative — Deep Dive only, collapsed to 1 line ──────
         Previously appeared ABOVE the call stack / event loop. Moved
         to the end of the topPanel flow so the visuals always read
         first. A <details> wrapper keeps the panel at ~1 line until
         the user opts in.
    -->
    <details class="brain-panel brain-details dl-deep">
      <summary class="brain-summary">
        <span class="brain-title">Inside the Engine</span>
        {#if sd.phase === 'suspended'}
          <span class="async-badge suspended">⏸ suspended</span>
        {:else if sd.phase?.startsWith('await')}
          <span class="async-badge awaiting">⏳ await</span>
        {:else if sd.phase?.startsWith('promise')}
          <span class="async-badge parallel">⚡ parallel</span>
        {:else if sd.phase?.startsWith('async')}
          <span class="async-badge asyncbadge">async</span>
        {/if}
        <span class="brain-tldr">{_brainTldr(sd.brain)}</span>
        <span class="brain-toggle" aria-hidden="true"></span>
      </summary>
      <div class="brain-box"
        class:brain-done   ={sd.done}
        class:brain-await  ={sd.phase === 'await-start' || sd.phase === 'suspended'}
        class:brain-resume ={sd.phase === 'await-resume'}
        class:brain-async  ={sd.phase?.startsWith('async-') || sd.phase?.startsWith('promise-')}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
      {#if sd.memLabel}<div class="mem-label">{sd.memLabel}</div>{/if}
    </details>

    <!-- Timeline visualization — shows sequential vs parallel layout -->
    {#if sd.timeline && sd.timeline.length > 0}
      {#key sd.timeline.length}
        {@const tl        = sd.timeline}
        {@const seqOps    = tl.filter(t => t.type === 'seq')}
        {@const parGroups = [...new Set(tl.filter(t => t.type === 'par').map(t => t.groupId))]}
        {@const hasSeq    = seqOps.length > 0}
        {@const hasPar    = parGroups.length > 0}
        <div class="timeline-panel">
          <div class="timeline-hdr">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke={ACCENT} stroke-width="1" opacity="0.5"/>
              <circle cx="1" cy="6" r="1.5" fill={ACCENT} opacity="0.8"/>
              <circle cx="11" cy="6" r="1.5" fill={ACCENT} opacity="0.4"/>
            </svg>
            <span class="timeline-title">EXECUTION TIMELINE</span>
          </div>
          <div class="timeline-body">

            <!-- Sequential operations -->
            {#if hasSeq}
              <div class="tl-row">
                <span class="tl-row-label">sequential</span>
                <div class="tl-bars">
                  {#each seqOps as op, i}
                    <div class="tl-bar tl-seq" class:tl-done={op.done}>
                      <span class="tl-bar-label">{op.label.split('(')[0]}</span>
                    </div>
                    {#if i < seqOps.length - 1}
                      <div class="tl-sep">→</div>
                    {/if}
                  {/each}
                </div>
                <span class="tl-cost tl-cost-slow">T = t₁+t₂+…</span>
              </div>
            {/if}

            <!-- Parallel groups -->
            {#each parGroups as gid}
              {@const groupOps = tl.filter(t => t.groupId === gid)}
              <div class="tl-row">
                <span class="tl-row-label">parallel</span>
                <div class="tl-bars tl-bars-par">
                  {#each groupOps as op}
                    <div class="tl-bar tl-par" class:tl-done={op.done}>
                      <span class="tl-bar-label">{op.label.split('(')[0]}</span>
                    </div>
                  {/each}
                </div>
                <span class="tl-cost tl-cost-fast">T = max(t₁,t₂,…)</span>
              </div>
            {/each}

          </div>
          {#if hasSeq && hasPar}
            <div class="tl-insight">
              Parallel fires all at once — time = slowest, not the sum. That's the win.
            </div>
          {/if}
        </div>
      {/key}
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.awaits || 0} await{sd.awaits !== 1 ? 's' : ''}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.promises || 0} promise{sd.promises !== 1 ? 's' : ''}
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
        <text x="20" y="30" fill="rgba(248,113,113,0.80)" font-size="14" font-family="'Geist Mono', monospace" font-weight="700">sequential:</text>
        <rect x="20" y="38" width="72" height="28" rx="3" fill="rgba(248,113,113,0.08)" stroke="rgba(248,113,113,0.50)" stroke-width="2"/>
        <text x="56" y="57" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 1</text>
        <rect x="98" y="38" width="72" height="28" rx="3" fill="rgba(248,113,113,0.08)" stroke="rgba(248,113,113,0.50)" stroke-width="2"/>
        <text x="134" y="57" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 2</text>
        <rect x="176" y="38" width="72" height="28" rx="3" fill="rgba(248,113,113,0.08)" stroke="rgba(248,113,113,0.50)" stroke-width="2"/>
        <text x="212" y="57" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 3</text>
        <text x="258" y="57" fill="rgba(248,113,113,0.70)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">T=t₁+t₂+t₃</text>
        <text x="20" y="96" fill="rgba(74,222,128,0.80)" font-size="14" font-family="'Geist Mono', monospace" font-weight="700">parallel:</text>
        <rect x="20" y="104" width="72" height="28" rx="3" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.50)" stroke-width="2"/>
        <text x="56" y="123" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 1</text>
        <rect x="20" y="136" width="72" height="28" rx="3" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.50)" stroke-width="2"/>
        <text x="56" y="155" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 2</text>
        <rect x="20" y="168" width="72" height="28" rx="3" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.50)" stroke-width="2"/>
        <text x="56" y="187" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">task 3</text>
        <text x="104" y="155" fill="rgba(74,222,128,0.70)" font-size="13" font-family="'Geist Mono', monospace" font-weight="600">T=max(t₁,t₂,t₃)</text>
        <rect x="20" y="196" width="360" height="20" rx="3" fill="rgba(167,139,250,0.06)" stroke="rgba(167,139,250,0.35)" stroke-width="1.5"/>
        <text x="200" y="210" text-anchor="middle" fill="rgba(167,139,250,0.80)" font-size="12" font-family="'Geist Mono', monospace" font-weight="600">call stack → event loop → microtasks</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to trace async execution</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Brain panel — now a collapsible <details> that sits LAST in the
     column and shows a 1-line TL;DR until the user opens it. On
     mobile `order: 99` ensures it never slips above the visuals. */
  .brain-panel   { background:var(--a11y-surface1); border:1px solid var(--a11y-border); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .brain-details { order: 99; }
  .brain-summary { display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--a11y-surface2); border-bottom:1px solid transparent; cursor:pointer; list-style:none; user-select:none; }
  .brain-summary::-webkit-details-marker { display:none; }
  .brain-details[open] .brain-summary { border-bottom-color: var(--a11y-border); }
  .brain-toggle                        { font-size:0.55rem; color:#cc88ff; font-family:var(--font-code); letter-spacing:0.6px; text-transform:uppercase; flex-shrink:0; }
  .brain-toggle::after                      { content: 'see more'; }
  .brain-details[open] .brain-toggle::after { content: 'see less'; }
  .brain-tldr    { flex:1; min-width:0; font-size:0.72rem; color:#bbb; font-family:var(--font-code); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .brain-hdr    { display:flex; align-items:center; justify-content:space-between; padding:5px 10px; background:var(--a11y-surface2); border-bottom:1px solid var(--a11y-border); }
  .brain-title  { font-size:0.55rem; color:#555; font-family: var(--font-code); letter-spacing:1.5px; font-weight:700; flex-shrink:0; }
  .async-badge  { font-size:0.55rem; padding:1px 6px; border-radius:3px; }
  .suspended    { color:#ffcc66; background:#ffcc6615; }
  .awaiting     { color:#cc88ff; background:#cc88ff15; }
  .parallel     { color:#4ade80; background:#4ade8015; }
  .asyncbadge   { color:#cc88ff; background:#cc88ff15; }
  .brain-box    { background:var(--a11y-bg, #0a0a12); padding:10px 12px; transition:all 0.3s; }
  .brain-done   { border-color:#88aaff33; background:#88aaff08; }
  .brain-await  { border-color:#ffcc6633; background:#ffcc6608; }
  .brain-resume { border-color:#00ff8833; background:#00ff8808; }
  .brain-async  { border-color:#cc88ff33; background:#cc88ff08; }
  .brain-text   { font-size:0.75rem; line-height:1.6; color:#bbb; white-space:pre-wrap; word-wrap:break-word; font-family: var(--font-ui); margin:0; }
  .brain-done .brain-text   { color:#aabbff; }
  .brain-await .brain-text  { color:#ffe099; }
  .brain-resume .brain-text { color:#88ffbb; }
  .brain-async .brain-text  { color:#ddaaff; }
  .mem-label    { background:#08080e; border-top:1px solid #1a1a2e; padding:5px 10px; font-size:0.6rem; color:#555; font-family: var(--font-code); letter-spacing:0.3px; }

  /* Call Stack + Event Loop — base styles (used by timeline sub-rows
     still referencing .runtime-panel etc.) */
  .runtime-row   { display:flex; gap:6px; }
  .runtime-panel { flex:1; min-width:0; background:var(--a11y-bg, #0a0a12); border:1px solid var(--a11y-border, #1a1a2e); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .frames-panel  { background:var(--a11y-bg, #0a0a12); border:1px solid var(--a11y-border, #1a1a2e); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .runtime-hdr   { padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#555; font-family: var(--font-code); letter-spacing:1.5px; font-weight:700; }
  .stack-box     { padding:6px 8px; display:flex; flex-direction:column; gap:3px; min-height:40px; }
  .stack-frame   { display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:3px; border:1px solid #1a1a2e; font-size:0.65rem; transition:all 0.3s; }
  .stack-top     { border-color:#cc88ff44; background:#cc88ff10; }
  .stack-name    { color:#ccc; font-weight:600; font-family: var(--font-code); font-size:0.65rem; }
  .stack-arrow   { font-size:0.5rem; color:#cc88ff; }
  .stack-empty   { font-size:0.6rem; color:#2a2a3e; padding:4px; }
  .event-box     { padding:6px 8px; min-height:40px; }
  .event-item    { font-size:0.6rem; color:#ffcc66; padding:2px 6px; background:#ffcc6610; border-radius:3px; margin-bottom:2px; font-family: var(--font-code); }
  .event-empty   { font-size:0.6rem; color:#2a2a3e; padding:4px; }
  .micro-label   { font-size:0.5rem; color:#444; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
  .micro-item    { font-size:0.6rem; color:#cc88ff; padding:2px 6px; background:#cc88ff10; border-radius:3px; margin-bottom:2px; font-family: var(--font-code); }

  /* ── Hero row (Call Stack + Event Loop, ∼3× upsized) ─────────────
     These rules compose on top of the base .runtime-* classes and
     bump padding / font-size so the two panels dominate the screen.
     The `stack-suspending` modifier gives the top frame a visible
     "about to leave" pulse when the runtime hits an await boundary. */
  .runtime-row-hero    { gap: 10px; }
  .runtime-hdr-hero    { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; font-size:0.82rem; letter-spacing:1.6px; color:rgba(255,255,255,0.94); font-weight:800; text-transform:uppercase; background:var(--a11y-surface2, #0d0d16); border-bottom:1px solid var(--a11y-border, #1a1a2e); }
  .cs-status           { display:inline-flex; align-items:center; gap:5px; font-size:0.62rem; font-weight:700; font-family:var(--font-code); letter-spacing:0.5px; text-transform:none; padding:3px 10px; border-radius:999px; border:1px solid transparent; }
  .cs-status-idle      { color:rgba(255,255,255,0.55); background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.10); }
  .cs-status-running   { color:#cc88ff; background:rgba(204,136,255,0.10); border-color:rgba(204,136,255,0.35); }
  .cs-status-suspend   { color:#ffcc66; background:rgba(255,204,102,0.12); border-color:rgba(255,204,102,0.40); animation: vx-cs-pulse 1.4s ease-in-out infinite; }
  @keyframes vx-cs-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,204,102,0.30); }
    50%      { box-shadow: 0 0 0 4px rgba(255,204,102,0.00); }
  }
  .el-status           { display:inline-flex; align-items:center; gap:6px; font-size:0.62rem; font-weight:700; font-family:var(--font-code); letter-spacing:1px; padding:3px 10px; border-radius:999px; border:1px solid transparent; }
  .el-status .el-dot   { width:7px; height:7px; border-radius:50%; background:currentColor; }
  .el-status-idle      { color:rgba(255,255,255,0.55); background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.10); }
  .el-status-running   { color:#4ade80; background:rgba(74,222,128,0.10); border-color:rgba(74,222,128,0.35); animation: vx-el-pulse 1.6s ease-in-out infinite; }
  .el-status-waiting   { color:#ffcc66; background:rgba(255,204,102,0.12); border-color:rgba(255,204,102,0.35); }
  .el-status-tick      { color:#cc88ff; background:rgba(204,136,255,0.12); border-color:rgba(204,136,255,0.40); animation: vx-el-pulse 1.2s ease-in-out infinite; }
  @keyframes vx-el-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 30%, transparent); }
    50%      { box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 0%, transparent); }
  }
  .stack-box-hero      { padding:14px 16px; gap:10px; min-height:128px; }
  .stack-frame-hero    { padding:12px 16px; border-radius:6px; font-size:1rem; border:1.5px solid #1a1a2e; }
  .stack-frame-hero .stack-name { font-size:1rem; color:#e2e8f0; font-weight:700; }
  .stack-frame-hero.stack-top   { border-color:#cc88ff66; background:#cc88ff14; box-shadow:inset 3px 0 0 #cc88ff; }
  .stack-frame-hero.stack-top .stack-name { color:#fff; }
  .stack-frame-hero .stack-arrow{ font-size:0.72rem; letter-spacing:0.3px; }
  /* Suspend modifier — drawn on the top frame just before it leaves
     the stack (phase === await-start|suspended). Faded opacity,
     warning-amber border and a ghost pulse telegraph "this frame
     is about to be popped off." */
  .stack-frame-hero.stack-suspending {
    border-color:#ffcc66; background:rgba(255,204,102,0.08);
    box-shadow:inset 3px 0 0 #ffcc66, 0 0 0 1px rgba(255,204,102,0.35);
    animation: vx-stack-suspend 1.2s ease-in-out infinite;
  }
  .stack-frame-hero.stack-suspending .stack-name,
  .stack-frame-hero.stack-suspending .stack-arrow { color:#ffcc66; }
  @keyframes vx-stack-suspend {
    0%, 100% { opacity: 1;    transform: translateX(0); }
    50%      { opacity: 0.55; transform: translateX(6px); }
  }
  .stack-arrow-suspend { font-weight:800; }
  .stack-empty-hero    { padding:18px 12px; font-size:0.8rem; color:rgba(255,255,255,0.45); text-align:center; font-style:italic; font-family:var(--font-code); }

  .event-box-hero      { padding:14px 16px; min-height:128px; }
  .event-item-hero     { font-size:0.92rem; padding:8px 12px; border-radius:6px; margin-bottom:6px; background:rgba(255,204,102,0.08); border:1px solid rgba(255,204,102,0.22); color:#ffcc66; font-weight:600; }
  .event-empty-hero    { font-size:0.78rem; padding:14px 6px; color:rgba(255,255,255,0.42); font-style:italic; text-align:center; }
  .micro-label-hero    { font-size:0.6rem; color:rgba(204,136,255,0.8); text-transform:uppercase; letter-spacing:1.2px; margin:10px 0 6px; font-weight:700; font-family:var(--font-code); }
  .micro-item-hero     { font-size:0.86rem; padding:7px 11px; border-radius:6px; background:rgba(204,136,255,0.10); border:1px solid rgba(204,136,255,0.28); color:#cc88ff; font-weight:600; margin-bottom:4px; font-family:var(--font-code); }

  /* Variable frame */
  .frame-box   { padding:8px 10px; }
  .var-row     { display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:4px; transition:all 0.35s; margin-bottom:2px; }
  .var-flash   { background:#cc88ff18; box-shadow:inset 3px 0 0 #cc88ff; }
  .var-left    { display:flex; align-items:center; gap:6px; }
  .var-name    { font-size:0.8rem; color:#88aaff; font-weight:600; font-family: var(--font-code); }
  .var-type    { font-size:0.55rem; padding:1px 5px; border-radius:3px; background:#ffffff08; }
  .var-value   { font-size:0.8rem; font-weight:600; font-family: var(--font-code); }
  /* Silent skeleton replaces the old "No variables yet" copy — two
     faint animated bars preview where frame variables will appear. */
  .var-skeleton     { display:flex; flex-direction:column; gap:6px; padding:10px 4px; }
  .var-skeleton-row {
    height: 10px; border-radius: 3px;
    background: linear-gradient(90deg,
      rgba(136,170,255,0.06) 0%,
      rgba(136,170,255,0.16) 50%,
      rgba(136,170,255,0.06) 100%);
    background-size: 200% 100%;
    animation: vx-var-skeleton-async 2.4s ease-in-out infinite;
  }
  .var-skeleton-row:nth-child(2) { width: 72%; animation-delay: 0.25s; }
  @keyframes vx-var-skeleton-async {
    0%, 100% { background-position: 100% 0; opacity: 0.7; }
    50%      { background-position: 0% 0;   opacity: 1; }
  }

  /* Timeline */
  .timeline-panel  { background:var(--a11y-bg, #0a0a12); border:1px solid var(--a11y-border, #1a1a2e); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .timeline-hdr    { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .timeline-title  { font-size:0.55rem; color:#555; font-family: var(--font-code); letter-spacing:1.5px; font-weight:700; }
  .timeline-body   { padding:8px; display:flex; flex-direction:column; gap:6px; }

  .tl-row        { display:flex; align-items:center; gap:8px; }
  .tl-row-label  { font-size:0.45rem; color:#444; font-family: var(--font-code); min-width:52px; text-align:right; }
  .tl-bars       { display:flex; gap:2px; align-items:center; flex:1; }
  .tl-bars-par   { flex-direction:column; gap:2px; }
  .tl-bar        { padding:3px 8px; border-radius:3px; min-width:50px; transition:all 0.3s; border:1px solid transparent; }
  .tl-seq        { background:#cc88ff18; border-color:#cc88ff33; }
  .tl-par        { background:#4ade8018; border-color:#4ade8033; width:100%; }
  .tl-done.tl-seq { background:#cc88ff30; border-color:#cc88ff66; }
  .tl-done.tl-par { background:#4ade8030; border-color:#4ade8066; }
  .tl-bar-label  { font-size:0.5rem; color:#888; font-family: var(--font-code); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
  .tl-done .tl-bar-label { color:#ccc; }
  .tl-sep        { font-size:0.6rem; color:#333; }
  .tl-cost       { font-size:0.45rem; font-family: var(--font-code); white-space:nowrap; }
  .tl-cost-slow  { color:#f87171; }
  .tl-cost-fast  { color:#4ade80; }
  .tl-insight    { padding:4px 10px 6px; background:#4ade8008; border-top:1px solid #4ade8018; font-size:0.48rem; color:#4ade8077; font-family: var(--font-code); }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family: var(--font-code); }
</style>
