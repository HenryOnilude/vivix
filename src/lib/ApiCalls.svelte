<script>
  import ModuleShell from './ModuleShell.svelte';
  import { executeApiCallsCode } from './api-calls-executor.js';

  const ACCENT = '#8b5cf6';

  const examples = [
    {
      label: 'GET request',
      code: 'async function getUser() {\n  const res = await fetch("/api/user");\n  const data = await res.json();\n  console.log(data.name);\n}\ngetUser();',
      complexity: {
        time: 'O(1) + network latency',
        space: 'O(response size)',
        timeWhy: 'Two awaits: one for the Response headers, one for the body stream. Network latency dominates — the JS execution itself is O(1). Sequential awaits add network round-trips if requests depend on each other.',
        spaceWhy: 'The response body is buffered in memory when you call .json() or .text(). Large responses = large heap allocation. Stream carefully for large payloads.',
      },
    },
    {
      label: 'POST with body',
      code: 'async function createUser() {\n  const res = await fetch("/api/users", {\n    method: "POST",\n    body: JSON.stringify({ name: "Alex" })\n  });\n  const data = await res.json();\n  console.log(data.name);\n}\ncreateUser();',
      complexity: {
        time: 'O(1) + network latency',
        space: 'O(request + response)',
        timeWhy: 'POST requests serialize the body (JSON.stringify), send it, then await the full response. One network round-trip = two await suspensions.',
        spaceWhy: 'Both the request body and response body are held in memory simultaneously during the request. JSON.stringify allocates a string proportional to the payload size.',
      },
    },
    {
      label: 'Error handling',
      code: 'async function safeFetch() {\n  try {\n    const res = await fetch("/api/user");\n    if (!res.ok) {\n      throw new Error("HTTP " + res.status);\n    }\n    const data = await res.json();\n    console.log(data.name);\n  } catch (err) {\n    console.log("Error caught");\n  }\n}\nsafeFetch();',
      complexity: {
        time: 'O(1) + network',
        space: 'O(1)',
        timeWhy: 'try/catch adds no meaningful overhead. The if (!res.ok) check is a single comparison. Error recovery path (catch) is only taken on failure — normally zero cost.',
        spaceWhy: 'The Error object is only allocated when an exception is thrown. The try block itself adds no memory overhead — it just marks a recovery point.',
      },
    },
    {
      label: 'Parallel fetches',
      code: 'async function fetchAll() {\n  const res = await fetch("/api/user");\n  const data = await res.json();\n  console.log(data.name);\n}\nfetchAll();',
      complexity: {
        time: 'O(1) sequential',
        space: 'O(n responses)',
        timeWhy: 'Sequential awaits = requests run one at a time. For parallel requests, use Promise.all([fetch(...), fetch(...)]) — all fire simultaneously and total time = max(t1, t2) not t1+t2.',
        spaceWhy: 'Each response is buffered separately. Parallel requests hold all response bodies in memory at once. Sequential requests release each body before allocating the next.',
      },
    },
  ];

  function executeCode(code) {
    return executeApiCallsCode(code);
  }

  function _reqStateColor(state) {
    if (state === 'parsed')    return '#4ade80';
    if (state === 'received')  return '#f59e0b';
    if (state === 'sending')   return '#8b5cf6';
    if (state === 'parsing')   return '#fbbf24';
    return '#94a3b8';
  }

  function _reqStateIcon(state) {
    if (state === 'parsed')   return '✓';
    if (state === 'received') return '↓';
    if (state === 'sending')  return '→';
    if (state === 'parsing')  return '⏳';
    return '○';
  }
</script>

<!-- ── ApiCalls module ───────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="api-calls"
  titlePrefix="api"
  titleAccent="Calls"
  subtitle="— HTTP & fetch()"
  desc="See how fetch() suspends execution and heap mutations track the request lifecycle"
  {executeCode}
  showHeap={false}
  moduleCaption="event-loop runtime — fetch() is handed off to Web APIs, its .then/await resolution goes on the microtask queue; the event loop drains microtasks before any macrotask (setTimeout, I/O)"
>

  <!-- Event-loop runtime: Call Stack · Web APIs · Microtask queue · Callback queue -->
  {#snippet cpuModuleVisual(sd)}
    {@const phase = sd.phase}
    {@const stack = sd.stack || ['Global']}
    {@const reqs = sd.requests || []}
    {@const inFlight = reqs.filter(r => r.state === 'sending' || r.state === 'parsing')}
    {@const microtaskActive = phase === 'fetch-response' || phase === 'json-done' || phase === 'async-call'}
    {@const W = 520}
    {@const H = 110}
    {@const colW = 120}
    {@const gap = 8}
    {@const startX = 8}

    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- Header -->
      <text x={W/2} y="12" text-anchor="middle" fill="#e2e8f0" font-size="7.5"
        font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="1">JS RUNTIME · EVENT LOOP</text>

      <!-- 4 columns: stack | Web APIs | microtask queue | callback queue -->
      {#each [
        { label: 'CALL STACK', sub: 'synchronous', color: '#60a5fa', items: [...stack].reverse().slice(0, 3), active: stack.length > 0, tag: stack[stack.length - 1] || '' },
        { label: 'WEB APIs', sub: 'fetch / timers', color: ACCENT, items: inFlight.map(r => `${r.method} ${r.url.split('/').pop() || r.url}`).slice(0, 3), active: inFlight.length > 0, tag: `${inFlight.length} in flight` },
        { label: 'MICROTASK Q', sub: '.then / await', color: '#a78bfa', items: microtaskActive ? ['resolve()'] : [], active: microtaskActive, tag: 'drained first' },
        { label: 'CALLBACK Q', sub: 'setTimeout / I/O', color: '#fbbf24', items: [], active: false, tag: 'drained after' },
      ] as col, i}
        {@const cx = startX + i * (colW + gap)}
        <rect x={cx} y="18" width={colW} height="70" rx="4"
          fill={col.active ? `${col.color}14` : '#0b0b14'}
          stroke={col.active ? col.color : '#1a1a2e'}
          stroke-width={col.active ? 1.5 : 1}/>

        <!-- Column header -->
        <text x={cx + 6} y="30"
          fill={col.active ? col.color : '#cbd5e1'}
          font-size="7" font-weight="800"
          font-family="'Geist Mono', monospace" letter-spacing="0.6">{col.label}</text>
        <text x={cx + colW - 6} y="30" text-anchor="end"
          fill="#64748b" font-size="5.5"
          font-family="'Geist Mono', monospace">{col.sub}</text>

        <!-- Items -->
        {#if col.items.length === 0}
          <text x={cx + colW/2} y="56" text-anchor="middle"
            fill="#64748b" font-size="6.5" font-style="italic"
            font-family="'Geist Mono', monospace">empty</text>
        {:else}
          {#each col.items as item, j}
            <rect x={cx + 4} y={36 + j * 13} width={colW - 8} height={11} rx="2"
              fill="#0b0b14" stroke={col.color} stroke-width="0.8" opacity="0.85"/>
            <text x={cx + 8} y={44 + j * 13}
              fill={col.color} font-size="6.5" font-weight="700"
              font-family="'Geist Mono', monospace">
              {item.length > 18 ? item.slice(0, 17) + '…' : item}
            </text>
          {/each}
        {/if}

        <!-- Tag -->
        <text x={cx + colW/2} y="82" text-anchor="middle"
          fill={col.active ? col.color : '#64748b'} font-size="5.5" font-weight="600"
          font-family="'Geist Mono', monospace" letter-spacing="0.3">{col.tag}</text>
      {/each}

      <!-- Event loop arrow underneath queues → stack -->
      <path d="M {startX + 2 * (colW + gap) + colW/2} 92 Q {startX + colW/2} 104 {startX + colW/2} 92"
        fill="none" stroke="#a78bfa" stroke-width="1" stroke-dasharray="2 2"
        opacity={microtaskActive ? 1 : 0.4} marker-end="url(#api-loop-arrow)"/>

      <!-- Footer caption -->
      <text x={W/2} y={H - 1} text-anchor="middle"
        fill={ACCENT} font-size="7.5" font-weight="600"
        font-family="'Geist Mono', monospace">
        {phase === 'fetch-call' ? 'fetch() handed off to Web APIs — stack continues immediately'
          : phase === 'fetch-response' ? 'response ready — resolution queued as microtask'
          : phase === 'json-parse' ? 'parsing body — another microtask'
          : phase === 'json-done' ? 'microtask executes — value returns to await'
          : phase === 'throw' ? 'rejection propagates to nearest try/catch'
          : 'event loop drains microtasks before every macrotask'}
      </text>

      <defs>
        <marker id="api-loop-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#a78bfa"/>
        </marker>
      </defs>
    </svg>
  {/snippet}

  {#snippet topPanel(sd)}
    <!-- Brain explanation — Deep Dive only.
         On Learn/Explore the request-timeline + response panels below
         carry the same information visually. -->
    <div class="brain-panel dl-deep">
      <div class="brain-hdr">
        <span class="brain-title">Engine</span>
        {#if sd.phase === 'fetch-call'}
          <span class="api-badge sending">→ sending</span>
        {:else if sd.phase === 'fetch-response'}
          <span class="api-badge received">↓ received</span>
        {:else if sd.phase === 'json-parse'}
          <span class="api-badge parsing">⏳ parsing</span>
        {:else if sd.phase === 'json-done'}
          <span class="api-badge parsed">✓ parsed</span>
        {:else if sd.phase === 'async-call'}
          <span class="api-badge async">async call</span>
        {:else if sd.phase === 'catch-start' || sd.phase === 'catch-run'}
          <span class="api-badge caught">⚠ caught</span>
        {:else if sd.phase === 'throw'}
          <span class="api-badge thrown">✕ error</span>
        {/if}
      </div>
      <div class="brain-box"
        class:brain-fetch={sd.phase === 'fetch-call' || sd.phase === 'fetch-response'}
        class:brain-json={sd.phase === 'json-parse' || sd.phase === 'json-done'}
        class:brain-error={sd.phase === 'throw' || sd.phase === 'catch-start'}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
    </div>

    <!-- Network requests -->
    <div class="requests-panel">
      <div class="requests-hdr">Network Requests</div>
      {#if sd.requests && sd.requests.length > 0}
        <div class="requests-list">
          {#each sd.requests as req}
            <div class="req-card" style="--rcolor:{_reqStateColor(req.state)}">
              <div class="req-method-url">
                <span class="req-method" style="color:{_reqStateColor(req.state)}">{req.method}</span>
                <span class="req-url">{req.url}</span>
              </div>
              <div class="req-status-row">
                <span class="req-state-icon">{_reqStateIcon(req.state)}</span>
                <span class="req-state" style="color:{_reqStateColor(req.state)}">{req.state}</span>
                {#if req.status}
                  <span class="req-status" style="color:{req.status < 400 ? '#4ade80' : '#f87171'}">{req.status}</span>
                {/if}
              </div>
              {#if req.data}
                <div class="req-data">{req.data}</div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="req-empty">No requests yet</div>
      {/if}
    </div>

    <!-- Call stack + heap vars -->
    <div class="runtime-row">
      <div class="runtime-panel">
        <div class="runtime-hdr">Call Stack</div>
        <div class="stack-box">
          {#if sd.callStack && sd.callStack.length > 0}
            {#each [...sd.callStack].reverse() as frame, i}
              <div class="stack-frame" class:stack-top={i === 0} class:stack-suspended={i === 0 && (sd.phase === 'fetch-call' || sd.phase === 'json-parse')}>
                <span class="stack-name">{frame}</span>
                {#if i === 0 && (sd.phase === 'fetch-call' || sd.phase === 'json-parse')}
                  <span class="stack-state">⏸ suspended</span>
                {:else if i === 0}
                  <span class="stack-state">← running</span>
                {/if}
              </div>
            {/each}
          {:else}
            <div class="stack-empty">empty</div>
          {/if}
        </div>
      </div>

      <div class="runtime-panel">
        <div class="runtime-hdr">Heap Variables</div>
        <div class="vars-box">
          {#if sd.vars && Object.keys(sd.vars).length > 0}
            {#each Object.entries(sd.vars) as [key, val]}
              <div class="var-row" class:var-flash={sd.highlight === key}>
                <span class="var-name">{key}</span>
                <span class="var-value" title={String(val)}>{String(val).length > 30 ? String(val).slice(0, 30) + '…' : val}</span>
              </div>
            {/each}
          {:else}
            <div class="var-empty">No variables yet</div>
          {/if}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.fetchCount || 0} fetch() call{(sd.fetchCount || 0) !== 1 ? 's' : ''}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#fbbf24"/></svg>
      {sd.awaits || 0} await{(sd.awaits || 0) !== 1 ? 's' : ''}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#4ade80"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 200" class="ph-svg">
        <!-- Browser -->
        <rect x="20" y="70" width="100" height="60" rx="5" fill="rgba(139,92,246,0.07)" stroke="rgba(139,92,246,0.4)" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="70" y="96"  text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="9"  font-family="'Geist Mono', monospace">Browser</text>
        <text x="70" y="112" text-anchor="middle" fill="rgba(139,92,246,0.8)" font-size="8" font-family="'Geist Mono', monospace">fetch()</text>
        <!-- Request arrow -->
        <line x1="120" y1="100" x2="180" y2="100" stroke="rgba(139,92,246,0.5)" stroke-width="1.5"/>
        <polygon points="180,96 188,100 180,104" fill="rgba(139,92,246,0.5)"/>
        <text x="150" y="95" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="7" font-family="'Geist Mono', monospace">GET /api/user</text>
        <!-- Server -->
        <rect x="188" y="70" width="100" height="60" rx="5" fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.25)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="238" y="96"  text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="'Geist Mono', monospace">Server</text>
        <text x="238" y="112" text-anchor="middle" fill="rgba(74,222,128,0.5)" font-size="8" font-family="'Geist Mono', monospace">200 OK</text>
        <!-- Response arrow -->
        <line x1="288" y1="100" x2="350" y2="100" stroke="rgba(74,222,128,0.4)" stroke-width="1.5"/>
        <polygon points="350,96 358,100 350,104" fill="rgba(74,222,128,0.4)"/>
        <text x="320" y="95" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="7" font-family="'Geist Mono', monospace">{'{ name: "Alex" }'}</text>
        <rect x="358" y="78" width="32" height="44" rx="4" fill="rgba(74,222,128,0.07)" stroke="rgba(74,222,128,0.3)" stroke-width="1"/>
        <text x="374" y="97"  text-anchor="middle" fill="rgba(74,222,128,0.8)" font-size="6.5" font-family="'Geist Mono', monospace">heap</text>
        <text x="374" y="111" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6"   font-family="'Geist Mono', monospace">data</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to trace the request lifecycle</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .brain-panel { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .brain-hdr   { display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .brain-title { font-size: 0.62rem; color: rgba(255,255,255,0.92); font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; }
  .brain-box   { padding: 8px 10px; transition: background 0.3s; }
  .brain-box.brain-fetch { background: rgba(139,92,246,0.05); }
  .brain-box.brain-json  { background: rgba(74,222,128,0.04); }
  .brain-box.brain-error { background: rgba(248,113,113,0.05); }
  .brain-text  { font-size: 0.62rem; color: var(--a11y-text-sec, #c8c8d4); line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: var(--font-code); }

  .api-badge { font-size: 0.5rem; font-weight: 700; font-family: var(--font-code); padding: 2px 7px; border-radius: 8px; }
  .api-badge.sending  { background: rgba(139,92,246,0.2);  color: #8b5cf6; }
  .api-badge.received { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .api-badge.parsing  { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .api-badge.parsed   { background: rgba(74,222,128,0.15); color: #4ade80; }
  .api-badge.async    { background: rgba(139,92,246,0.12); color: #a78bfa; }
  .api-badge.caught   { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .api-badge.thrown   { background: rgba(248,113,113,0.15); color: #f87171; }

  /* ── Requests ─────────────────────────────────────────────────────── */
  .requests-panel { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .requests-hdr   { font-size: 0.62rem; color: rgba(255,255,255,0.92); font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .requests-list  { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; }
  .req-empty      { font-size: 0.62rem; color: rgba(255,255,255,0.7); font-family: var(--font-code); padding: 8px 10px; }

  .req-card        { background: color-mix(in srgb, var(--rcolor) 6%, transparent); border: 1px solid color-mix(in srgb, var(--rcolor) 25%, transparent); border-radius: 6px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px; transition: all 0.3s; }
  .req-method-url  { display: flex; align-items: center; gap: 8px; }
  .req-method      { font-size: 0.62rem; font-weight: 800; font-family: var(--font-code); }
  .req-url         { font-size: 0.62rem; font-family: var(--font-code); color: rgba(255,255,255,0.88); }
  .req-status-row  { display: flex; align-items: center; gap: 6px; }
  .req-state-icon  { font-size: 0.6rem; }
  .req-state       { font-size: 0.52rem; font-family: var(--font-code); }
  .req-status      { font-size: 0.52rem; font-family: var(--font-code); font-weight: 700; margin-left: auto; }
  .req-data        { font-size: 0.55rem; font-family: var(--font-code); color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); border-radius: 3px; padding: 2px 5px; margin-top: 2px; }

  /* ── Runtime row ─────────────────────────────────────────────────── */
  .runtime-row   { display: flex; gap: 6px; flex-shrink: 0; }
  .runtime-panel { flex: 1; background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; }
  .runtime-hdr   { font-size: 0.62rem; color: rgba(255,255,255,0.92); font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }

  .stack-box   { display: flex; flex-direction: column-reverse; gap: 3px; padding: 8px 10px; min-height: 56px; }
  .stack-frame { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 4px 8px; transition: all 0.3s; }
  .stack-frame.stack-top        { border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.06); }
  .stack-frame.stack-suspended  { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.05); }
  .stack-name  { font-size: 0.65rem; font-family: var(--font-code); color: rgba(255,255,255,0.92); font-weight: 600; }
  .stack-state { font-size: 0.48rem; font-family: var(--font-code); color: #8b5cf6; }
  .stack-state { color: #8b5cf6; }
  .stack-frame.stack-suspended .stack-state { color: #f59e0b; }
  .stack-empty { font-size: 0.6rem; color: rgba(255,255,255,0.6); font-family: var(--font-code); }

  .vars-box  { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; min-height: 56px; }
  .var-row   { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 4px; transition: all 0.3s; }
  .var-row.var-flash { background: rgba(139,92,246,0.08); }
  .var-name  { font-size: 0.6rem; font-weight: 700; font-family: var(--font-code); color: #8b5cf6; min-width: 40px; }
  .var-value { font-size: 0.6rem; font-family: var(--font-code); color: rgba(255,255,255,0.88); text-align: right; }
  .var-empty { font-size: 0.6rem; color: rgba(255,255,255,0.6); font-family: var(--font-code); }

  .vis-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .ph-svg   { width: 380px; height: auto; }
  .ph-text  { font-size: 0.78rem; color: rgba(255,255,255,0.78); text-align: center; }

  .cx-s { display: flex; align-items: center; gap: 4px; font-size: 0.58rem; color: rgba(255,255,255,0.78); font-family: var(--font-code); }
</style>
