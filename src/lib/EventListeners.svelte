<script>
  import ModuleShell from './ModuleShell.svelte';
  import { executeEventListenerCode } from './event-listener-executor.js';

  const ACCENT = '#ec4899';

  const examples = [
    {
      label: 'Click handler',
      code: 'const btn = document.createElement("button");\nbtn.addEventListener("click", () => {\n  console.log("clicked!");\n});\nbtn.click();',
      complexity: {
        time: 'O(k) per event',
        space: 'O(k) listeners',
        timeWhy: 'k = number of listeners for that event type. Each listener is called synchronously. If you have k click handlers, dispatching one click runs all k handlers in registration order.',
        spaceWhy: 'Each addEventListener() stores a reference to the callback in the element\'s listener list. k listeners = k entries in the internal EventListenerList.',
      },
    },
    {
      label: 'Multiple listeners',
      code: 'const box = document.createElement("div");\nbox.addEventListener("click", () => {\n  console.log("listener 1");\n});\nbox.addEventListener("click", () => {\n  console.log("listener 2");\n});\nbox.click();',
      complexity: {
        time: 'O(k)',
        space: 'O(k)',
        timeWhy: 'Two listeners registered for the same event. Both fire in order when clicked. Time grows linearly with k — the number of handlers per event.',
        spaceWhy: 'Each listener is stored separately, even if they handle the same event type. 2 click listeners = 2 entries in the registry.',
      },
    },
    {
      label: 'once: true option',
      code: 'const btn = document.createElement("button");\nbtn.addEventListener("click", () => {\n  console.log("fires once!");\n}, { once: true });\nbtn.click();\nbtn.click();',
      complexity: {
        time: 'O(1) for auto-remove',
        space: 'O(k) before, O(k-1) after',
        timeWhy: '{ once: true } auto-removes the listener after the first fire. The second click finds no listener — O(0). Cleaner than calling removeEventListener() manually.',
        spaceWhy: 'The listener occupies memory until it fires. After firing, it\'s removed — one fewer entry in the registry. Memory is automatically reclaimed.',
      },
    },
    {
      label: 'Custom events',
      code: 'const el = document.createElement("div");\nel.addEventListener("data-loaded", (e) => {\n  console.log("data ready");\n});\nel.dispatchEvent(new CustomEvent("data-loaded", { detail: { count: 5 } }));',
      complexity: {
        time: 'O(k)',
        space: 'O(1) per event',
        timeWhy: 'Custom events use the same dispatch mechanism as built-in events. k listeners for "data-loaded" = k callbacks called in order.',
        spaceWhy: 'The CustomEvent object is allocated on the heap when dispatched, then GC\'d after all handlers run. The event object itself is O(1).',
      },
    },
  ];

  function executeCode(code) {
    return executeEventListenerCode(code);
  }

  // ──────────────────────────────────────────────────────────
  // Plain-English step narrative
  // For each phase emitted by the event-listener executor, give
  // beginners a one-paragraph explanation in everyday language.
  // ──────────────────────────────────────────────────────────
  function explainStep(sd) {
    if (!sd) return null;
    const ph = sd.phase;
    const elNames = sd.elements ? Object.keys(sd.elements) : [];
    const lastEl  = elNames[elNames.length - 1];
    const tag     = lastEl && sd.elements[lastEl]?.tag;

    if (ph === 'start') return {
      title: 'Starting',
      body:  'The script is about to run. No DOM elements exist yet and no listeners are registered. The Call Stack only holds the Global execution context.',
    };
    if (ph === 'create-element') return {
      title: 'Element created',
      body:  `document.createElement("${tag}") allocated a fresh <${tag}> in memory and bound it to the variable "${lastEl}". The element is NOT in the page yet — it lives only as a JavaScript object until you appendChild it somewhere.`,
    };
    if (ph === 'add-listener') {
      const el = sd.elements?.[lastEl];
      const last = el?.listeners?.[el.listeners.length - 1];
      const evt = last?.event || 'event';
      const once = last?.once;
      return {
        title: 'Listener registered',
        body:  `addEventListener('${evt}', …${once ? ', { once: true }' : ''}) saved your callback inside ${lastEl}'s internal listener list. Nothing runs yet — the browser is just remembering: "when '${evt}' fires on this element, call this function."${once ? ' Because once:true was set, the browser will auto-remove this listener after it fires once.' : ''}`,
      };
    }
    if (ph === 'dispatch-event') return {
      title: 'Event dispatched',
      body:  `${lastEl}.click() created a synthetic click Event object and pushed it onto the event queue. The browser now walks ${lastEl}'s listener list looking for 'click' handlers to invoke — in the order they were registered.`,
    };
    if (ph === 'dispatch-custom') return {
      title: 'Custom event dispatched',
      body:  `dispatchEvent(new CustomEvent(…)) is the same machinery as a real click — the event is queued and every matching listener is invoked in registration order. CustomEvents can carry any data you like in their detail field.`,
    };
    if (ph === 'handler-run') return {
      title: 'Handler running',
      body:  `The registered callback is now executing. A new frame was pushed onto the Call Stack; any code inside (like console.log) runs synchronously before the frame pops back off and control returns to the dispatcher.`,
    };
    if (ph === 'remove-listener') return {
      title: 'Listener removed',
      body:  `The once:true listener has done its job and the browser auto-removed it from the listener list. Future events of the same type will find no matching handler — they fire into the void (no-op).`,
    };
    if (ph === 'done') return {
      title: 'Finished',
      body:  `All synchronous code has finished. Final tally: ${sd.listenersRegistered || 0} listener${(sd.listenersRegistered || 0) !== 1 ? 's' : ''} registered, ${sd.eventsDispatched || 0} event${(sd.eventsDispatched || 0) !== 1 ? 's' : ''} dispatched.`,
    };
    return null;
  }

  // Lifecycle stages — used by the progress strip. Each step lights up
  // when its phase has been reached at least once during this run.
  const LIFECYCLE = [
    { id: 'create',   label: 'Create element',     match: ['create-element']                        },
    { id: 'register', label: 'Register listener',  match: ['add-listener']                          },
    { id: 'dispatch', label: 'Dispatch event',     match: ['dispatch-event', 'dispatch-custom']     },
    { id: 'handle',   label: 'Run handler',        match: ['handler-run']                           },
    { id: 'cleanup',  label: 'Cleanup',            match: ['remove-listener', 'done']               },
  ];

  function lifecycleState(sd, stage) {
    if (!sd || !sd.phase) return 'pending';
    if (stage.match.includes(sd.phase)) return 'active';
    // Mark earlier stages as done if we're past them.
    const order = LIFECYCLE.findIndex(s => s.id === stage.id);
    const curr  = LIFECYCLE.findIndex(s => s.match.includes(sd.phase));
    if (curr > order) return 'done';
    return 'pending';
  }
</script>

<!-- ── EventListeners module ─────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="event-listeners"
  titlePrefix="event"
  titleAccent="Listeners"
  subtitle="— DOM Events"
  desc="See how addEventListener registers callbacks and events flow through the queue"
  {executeCode}
  showHeap={false}
>

  {#snippet topPanel(sd)}
    <!-- Brain explanation — Deep Dive only.
         On Learn/Explore the event-queue + element-tree panels below
         carry the same information visually. -->
    <div class="brain-panel dl-deep">
      <div class="brain-hdr">
        <span class="brain-title">Engine</span>
        {#if sd.phase === 'add-listener'}
          <span class="ev-badge register">+ listener</span>
        {:else if sd.phase === 'dispatch-event' || sd.phase === 'dispatch-custom'}
          <span class="ev-badge dispatch">⚡ dispatch</span>
        {:else if sd.phase === 'handler-run'}
          <span class="ev-badge running">▶ handler</span>
        {:else if sd.phase === 'remove-listener'}
          <span class="ev-badge remove">− removed</span>
        {:else if sd.phase === 'create-element'}
          <span class="ev-badge create">new element</span>
        {/if}
      </div>
      <div class="brain-box"
        class:brain-dispatch={sd.phase === 'dispatch-event' || sd.phase === 'dispatch-custom'}
        class:brain-handler={sd.phase === 'handler-run'}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
    </div>

    <!-- Step narrative — plain-English breakdown for Learn/Explore.
         The Deep Dive brain panel above has the technical detail; this
         panel speaks to beginners. -->
    {@const explain = explainStep(sd)}
    <div class="step-narrative dl-learn dl-explore">
      <div class="sn-hdr">
        <span class="sn-label">What's happening</span>
        {#if explain}
          <span class="sn-title">{explain.title}</span>
        {/if}
      </div>

      <!-- Lifecycle progress strip — 5 ordered stages -->
      <ol class="lc-row">
        {#each LIFECYCLE as stage, i}
          {@const state = lifecycleState(sd, stage)}
          <li class="lc-step lc-{state}">
            <span class="lc-num">{i + 1}</span>
            <span class="lc-label">{stage.label}</span>
          </li>
        {/each}
      </ol>

      {#if explain}
        <p class="sn-text">{explain.body}</p>
      {/if}
    </div>

    <!-- Elements + listeners -->
    <div class="elements-row">
      <div class="runtime-panel el-panel">
        <div class="runtime-hdr">DOM Elements</div>
        <div class="el-box">
          {#if sd.elements && Object.keys(sd.elements).length > 0}
            {#each Object.entries(sd.elements) as [name, el]}
              <div class="el-card">
                <div class="el-tag">&lt;{el.tag}&gt;</div>
                <div class="el-name">{name}</div>
                {#if el.listeners && el.listeners.length > 0}
                  <div class="el-listeners">
                    {#each el.listeners as l}
                      <div class="el-listener" style="--lcolor:{ACCENT}">
                        <span class="l-event">'{l.event}'</span>
                        <span class="l-arrow">→</span>
                        <span class="l-handler">{l.handlerName}</span>
                        {#if l.once}<span class="l-once">once</span>{/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="el-no-listeners">no listeners</div>
                {/if}
              </div>
            {/each}
          {:else}
            <div class="el-empty">No elements yet</div>
          {/if}
        </div>
      </div>

      <div class="runtime-panel">
        <div class="runtime-hdr">Call Stack</div>
        <div class="stack-box">
          {#if sd.callStack && sd.callStack.length > 0}
            {#each [...sd.callStack].reverse() as frame, i}
              <div class="stack-frame" class:stack-top={i === 0}>
                <span class="stack-name">{frame}</span>
                {#if i === 0}<span class="stack-arrow">← running</span>{/if}
              </div>
            {/each}
          {:else}
            <div class="stack-empty">empty</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Event queue -->
    {#if sd.eventQueue && sd.eventQueue.length > 0}
      <div class="eq-panel">
        <div class="runtime-hdr">Event Queue</div>
        <div class="eq-box">
          {#each sd.eventQueue as ev}
            <div class="eq-item">⚡ {ev}</div>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.listenersRegistered || 0} listener{(sd.listenersRegistered || 0) !== 1 ? 's' : ''} registered
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#fbbf24"/></svg>
      {sd.eventsDispatched || 0} event{(sd.eventsDispatched || 0) !== 1 ? 's' : ''} dispatched
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#4ade80"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 400 200" class="ph-svg">
        <!-- Element box -->
        <rect x="30" y="60" width="120" height="80" rx="6" fill="rgba(236,72,153,0.06)" stroke="rgba(236,72,153,0.4)" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="90" y="82"  text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10" font-family="'Geist Mono', monospace">&lt;button&gt;</text>
        <text x="90" y="100" text-anchor="middle" fill="rgba(236,72,153,0.8)" font-size="8"  font-family="'Geist Mono', monospace">'click' listener</text>
        <text x="90" y="116" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="7"  font-family="'Geist Mono', monospace">→ handleClick()</text>
        <!-- Arrow to event queue -->
        <line x1="150" y1="100" x2="190" y2="100" stroke="rgba(236,72,153,0.4)" stroke-width="1.5"/>
        <polygon points="190,96 198,100 190,104" fill="rgba(236,72,153,0.4)"/>
        <!-- Event queue -->
        <rect x="198" y="75" width="90" height="50" rx="5" fill="rgba(236,72,153,0.04)" stroke="rgba(236,72,153,0.25)" stroke-width="1" stroke-dasharray="4 3"/>
        <text x="243" y="93"  text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="8" font-family="'Geist Mono', monospace">Event Queue</text>
        <text x="243" y="110" text-anchor="middle" fill="rgba(236,72,153,0.5)" font-size="7" font-family="'Geist Mono', monospace">⚡ click</text>
        <!-- Arrow to handler -->
        <line x1="288" y1="100" x2="320" y2="100" stroke="rgba(236,72,153,0.25)" stroke-width="1"/>
        <text x="345" y="95" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="7" font-family="'Geist Mono', monospace">handler</text>
        <text x="345" y="108" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-size="6" font-family="'Geist Mono', monospace">runs</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see event listeners fire</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  .brain-panel { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .brain-hdr   { display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .brain-title { font-size: 0.55rem; color: #555; font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; }
  .brain-box   { padding: 8px 10px; transition: background 0.3s; }
  .brain-box.brain-dispatch { background: rgba(236,72,153,0.05); }
  .brain-box.brain-handler  { background: rgba(236,72,153,0.07); }
  .brain-text  { font-size: 0.62rem; color: var(--a11y-text-sec, #c8c8d4); line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: var(--font-code); }

  .ev-badge  { font-size: 0.5rem; font-weight: 700; font-family: var(--font-code); padding: 2px 7px; border-radius: 8px; }
  .ev-badge.register { background: rgba(236,72,153,0.15); color: #ec4899; }
  .ev-badge.dispatch { background: rgba(251,191,36,0.15);  color: #fbbf24; }
  .ev-badge.running  { background: rgba(236,72,153,0.2);   color: #f472b6; }
  .ev-badge.remove   { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .ev-badge.create   { background: rgba(74,222,128,0.12);  color: #4ade80; }

  /* ── Step narrative (Learn/Explore) ─────────────────────── */
  .step-narrative { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
  .sn-hdr   { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .sn-label { font-size: 12px; color: #555; font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; }
  .sn-title { font-size: 14px; color: #ec4899; font-weight: 700; font-family: var(--font-ui); }
  .sn-text  { font-size: 13px; color: rgba(255,255,255,0.78); font-family: var(--font-ui); line-height: 1.55; margin: 0; }

  /* Lifecycle progress strip */
  .lc-row     { display: flex; gap: 4px; padding: 0; margin: 0; list-style: none; flex-wrap: wrap; }
  .lc-step    { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: all 0.25s ease; }
  .lc-num     { font-size: 11px; font-weight: 700; font-family: var(--font-code); color: rgba(255,255,255,0.35); width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.06); display: inline-flex; align-items: center; justify-content: center; }
  .lc-label   { font-size: 12px; font-family: var(--font-ui); color: rgba(255,255,255,0.45); white-space: nowrap; }
  .lc-active  { border-color: rgba(236,72,153,0.6); background: rgba(236,72,153,0.10); box-shadow: 0 0 0 1px rgba(236,72,153,0.3); }
  .lc-active .lc-num   { background: #ec4899; color: #fff; }
  .lc-active .lc-label { color: #fff; font-weight: 600; }
  .lc-done    { border-color: rgba(74,222,128,0.25); background: rgba(74,222,128,0.05); }
  .lc-done .lc-num   { background: rgba(74,222,128,0.7); color: #021; }
  .lc-done .lc-label { color: rgba(255,255,255,0.65); }

  /* ── Elements + listeners ──────────────────────────────── */
  .elements-row { display: flex; gap: 6px; flex-shrink: 0; }
  .runtime-panel { flex: 1; background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; }
  .runtime-hdr  { font-size: 12px; color: rgba(255,255,255,0.65); font-family: var(--font-code); letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; padding: 6px 10px; background: var(--a11y-surface2); border-bottom: 1px solid var(--a11y-border); }
  .el-panel     { flex: 1.5; }
  .el-box       { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-height: 60px; }
  .el-empty     { font-size: 12px; color: #555; font-family: var(--font-code); }

  .el-card      { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; }
  .el-tag       { font-size: 14px; font-weight: 700; font-family: var(--font-code); color: #ec4899; }
  .el-name      { font-size: 11px; color: #888; font-family: var(--font-code); margin-bottom: 6px; }
  .el-listeners { display: flex; flex-direction: column; gap: 4px; }
  .el-listener  { display: flex; align-items: center; gap: 6px; font-size: 12px; font-family: var(--font-code); background: color-mix(in srgb, var(--lcolor) 8%, transparent); border-radius: 4px; padding: 4px 8px; }
  .l-event   { color: #fbbf24; }
  .l-arrow   { color: rgba(255,255,255,0.4); }
  .l-handler { color: rgba(255,255,255,0.78); }
  .l-once    { font-size: 10px; background: rgba(248,113,113,0.15); color: #f87171; border-radius: 4px; padding: 2px 5px; font-weight: 700; }
  .el-no-listeners { font-size: 11.5px; color: #555; font-family: var(--font-code); font-style: italic; }

  .stack-box    { display: flex; flex-direction: column-reverse; gap: 4px; padding: 8px 10px; min-height: 60px; }
  .stack-frame  { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 5px 10px; }
  .stack-frame.stack-top { border-color: rgba(236,72,153,0.3); background: rgba(236,72,153,0.06); }
  .stack-name   { font-size: 13px; font-family: var(--font-code); color: rgba(255,255,255,0.78); }
  .stack-arrow  { font-size: 11px; color: #ec4899; font-weight: 600; }
  .stack-empty  { font-size: 12px; color: #555; font-family: var(--font-code); font-style: italic; }

  /* ── Event queue ──────────────────────────────────── */
  .eq-panel { background: var(--a11y-surface1); border: 1px solid var(--a11y-border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .eq-box   { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; }
  .eq-item  { font-size: 12.5px; font-family: var(--font-code); color: #fbbf24; background: rgba(251,191,36,0.10); border-radius: 4px; padding: 4px 10px; font-weight: 600; }

  .vis-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .ph-svg   { width: 360px; height: auto; }
  .ph-text  { font-size: 0.78rem; color: rgba(255,255,255,0.45); text-align: center; }

  .cx-s { display: flex; align-items: center; gap: 5px; font-size: 13px; color: rgba(255,255,255,0.72); font-family: var(--font-code); }
</style>
