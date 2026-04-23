<script>
  import { onMount, onDestroy } from 'svelte';

  // ── Demo simulation ───────────────────────────────────────────────────────
  const DEMO_LINES = [
    [{ k: 'kw', v: 'async ' }, { k: 'kw', v: 'function ' }, { k: 'fn', v: 'fetchUser' }, { k: 'op', v: '() {' }],
    [{ k: 'kw', v: '  const ' }, { k: 'id', v: 'res' }, { k: 'op', v: ' = ' }, { k: 'kw', v: 'await ' }, { k: 'fn', v: 'Promise' }, { k: 'op', v: '.' }, { k: 'fn', v: 'resolve' }, { k: 'op', v: '(' }, { k: 'str', v: '"Alex"' }, { k: 'op', v: ');' }],
    [{ k: 'kw', v: '  const ' }, { k: 'id', v: 'msg' }, { k: 'op', v: ' = ' }, { k: 'str', v: '"Hello, "' }, { k: 'op', v: ' + ' }, { k: 'id', v: 'res' }, { k: 'op', v: ';' }],
    [{ k: 'kw', v: '  return ' }, { k: 'id', v: 'msg' }, { k: 'op', v: ';' }],
    [{ k: 'op', v: '}' }],
    [{ k: 'fn', v: 'fetchUser' }, { k: 'op', v: '();' }],
  ];

  const DEMO_STEPS = [
    { line: 5, pc: 'LINE 6', op: 'START',   stack: 'Global',      writes: 0, vars: [],                                                                                                                                                                                                     out: null,          explain: 'Program starts. fetchUser() is called — a new async frame is pushed onto the call stack.' },
    { line: 1, pc: 'LINE 2', op: 'AWAIT',   stack: 'fetchUser',   writes: 1, vars: [{ n: 'res', v: 'pending…', c: '#a78bfa', t: 'Promise', bytes: 0 }],                                                                                                                                    out: null,          explain: 'await hit. Promise.resolve("Alex") created. fetchUser suspends — yields to the microtask queue.' },
    { line: 1, pc: 'LINE 2', op: 'RESOLVE', stack: 'fetchUser',   writes: 2, vars: [{ n: 'res', v: '"Alex"',   c: '#4ade80', t: 'string',  bytes: 4 }],                                                                                                                                    out: null,          explain: 'Microtask fires. Promise resolved — "Alex" written to heap. res now holds 4 bytes.' },
    { line: 2, pc: 'LINE 3', op: 'DECLARE', stack: 'fetchUser',   writes: 3, vars: [{ n: 'res', v: '"Alex"',   c: '#4ade80', t: 'string',  bytes: 4 }, { n: 'msg', v: '"Hello, Alex"', c: '#38bdf8', t: 'string', bytes: 12 }],                                                           out: null,          explain: '"Hello, " + res evaluated. Result string written to heap as msg — 12 bytes. 3 memory writes.' },
    { line: 3, pc: 'LINE 4', op: 'RETURN',  stack: 'fetchUser',   writes: 3, vars: [{ n: 'res', v: '"Alex"',   c: '#4ade80', t: 'string',  bytes: 4 }, { n: 'msg', v: '"Hello, Alex"', c: '#38bdf8', t: 'string', bytes: 12 }],                                                           out: null,          explain: 'return msg. fetchUser resolves its outer Promise with "Hello, Alex". Frame about to pop.' },
    { line: 5, pc: 'END',    op: 'DONE',    stack: 'Global',      writes: 3, vars: [{ n: 'res', v: '"Alex"',   c: '#4ade80', t: 'string',  bytes: 4 }, { n: 'msg', v: '"Hello, Alex"', c: '#38bdf8', t: 'string', bytes: 12 }],                                                           out: '"Hello, Alex"', explain: 'fetchUser frame popped. Promise resolved with "Hello, Alex". 3 writes, 1 microtask.' },
  ];

  let demoStep = $state(0);
  let demoTimer;

  const currentStep = $derived(DEMO_STEPS[demoStep]);

  // ── Scrollytelling: GSAP context holder (torn down on unmount) ────────────
  /** @type {any} */
  let scrollCtx;
  /** @type {number|undefined} */
  let rafHandle;
  /** Hero cursor glow — latest mouse position, applied once per frame via
   *  a CSS custom property so we never force layout. */
  let heroEl;
  let heroGlowX = 0;
  let heroGlowY = 0;
  let heroGlowDirty = false;

  /** True when the OS asks for reduced motion. All scroll-driven timelines
   *  short-circuit in this case and each stage renders in its static
   *  completed state so nothing moves underneath the reader. */
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  onMount(() => {
    const cards = document.querySelectorAll('.module-card');

    // Pointer → CSS vars. Runs fully passive; rAF-coalesced writes mean we
    // touch style ops at most once per frame per target, so layout never
    // thrashes even on slow devices.
    const onMove = (e) => {
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
      });
      if (heroEl) {
        const r = heroEl.getBoundingClientRect();
        heroGlowX = e.clientX - r.left;
        heroGlowY = e.clientY - r.top;
        heroGlowDirty = true;
      }
    };

    const pumpGlow = () => {
      if (heroGlowDirty && heroEl) {
        heroEl.style.setProperty('--hero-glow-x', `${heroGlowX}px`);
        heroEl.style.setProperty('--hero-glow-y', `${heroGlowY}px`);
        heroGlowDirty = false;
      }
      rafHandle = requestAnimationFrame(pumpGlow);
    };
    rafHandle = requestAnimationFrame(pumpGlow);

    window.addEventListener('mousemove', onMove, { passive: true });

    // Auto-advance demo — pause at end before looping
    demoTimer = setInterval(() => {
      demoStep = (demoStep + 1) % DEMO_STEPS.length;
    }, 1600);

    // ── Scrollytelling ─────────────────────────────────────────────────────
    // Gate all scroll-scrubbed work behind prefers-reduced-motion. Stages
    // are authored so they look complete without any animation — the CSS
    // fallback simply skips the pinned intro pan and renders the final
    // frame of each stage inline.
    // On narrow viewports (≤768px) we skip scrollytelling entirely. The
    // ScrollTrigger pin-spacers add ~1600px of virtual scroll per stage,
    // which reads as enormous empty gaps on a phone; the MotionPaths are
    // authored against desktop grid coordinates and land on top of the
    // mobile-rearranged labels; and GSAP's inline transforms override the
    // mobile CSS that positions the Epiphany tooltip. The CSS fallback
    // (mirrored from prefers-reduced-motion) renders every stage in its
    // final, legible frame without any motion.
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    let cancelled = false;
    if (!prefersReducedMotion && !isMobile) {
      (async () => {
        const [{ gsap }, { ScrollTrigger }, { MotionPathPlugin }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
          import('gsap/MotionPathPlugin'),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

        scrollCtx = gsap.context(() => {
          // ── Stage 2 — The Reveal ───────────────────────────────────────
          // Pin the split-pane; scroll scrubs a single timeline that
          // (a) sharpens the dashboard from 24px blur to 0, (b) walks
          // the highlighted execution line down the code panel, and
          // (c) arcs a token from the code into the Call Stack via a
          // MotionPath. scrub:1.5 gives silky lag so quick scrolls feel
          // smooth without the user losing position.
          gsap.timeline({
            scrollTrigger: {
              trigger: '.stage-reveal',
              start: 'top top',
              end: '+=1600',
              scrub: 1.5,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
            .fromTo('.sr-dashboard',
              { filter: 'blur(24px)', opacity: 0.2, scale: 0.98 },
              { filter: 'blur(0px)',  opacity: 1,   scale: 1, ease: 'power2.out' }, 0)
            .to('.sr-line', { opacity: 0.35, duration: 0.1 }, 0)
            .to('.sr-line[data-l="0"]', { opacity: 1 }, 0.05)
            .to('.sr-line[data-l="1"]', { opacity: 1 }, 0.2)
            .to('.sr-line[data-l="2"]', { opacity: 1 }, 0.4)
            .to('.sr-line[data-l="3"]', { opacity: 1 }, 0.6)
            .to('.sr-line[data-l="4"]', { opacity: 1 }, 0.8)
            .fromTo('.sr-token',
              { opacity: 0, scale: 0.6 },
              { opacity: 1, scale: 1, duration: 0.1 }, 0.4)
            .to('.sr-token', {
              motionPath: {
                path: '.sr-path-to-stack',
                align: '.sr-path-to-stack',
                alignOrigin: [0.5, 0.5],
                autoRotate: false,
              },
              ease: 'power1.inOut',
              duration: 0.6,
            }, 0.5);

          // ── Stage 3 — The Epiphany ─────────────────────────────────────
          // Second pinned segment. The event-loop ring at centre rotates
          // linearly with scroll; two tokens (setTimeout macrotask,
          // Promise microtask) trace different paths and converge. The
          // tooltip reveals at the exact moment the microtask jumps the
          // queue back into the (empty) stack.
          gsap.timeline({
            scrollTrigger: {
              trigger: '.stage-epiphany',
              start: 'top top',
              end: '+=1600',
              scrub: 1.5,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
            .fromTo('.ep-loop', { rotate: 0 }, { rotate: 360, ease: 'none' }, 0)
            .fromTo('.ep-token-micro', { opacity: 0, scale: 0.6 },
                                        { opacity: 1, scale: 1, duration: 0.05 }, 0)
            .fromTo('.ep-token-macro', { opacity: 0, scale: 0.6 },
                                        { opacity: 1, scale: 1, duration: 0.05 }, 0.05)
            .to('.ep-token-macro', {
              motionPath: { path: '.ep-path-macro', align: '.ep-path-macro', alignOrigin: [0.5, 0.5] },
              ease: 'power1.inOut', duration: 0.35,
            }, 0.1)
            .to('.ep-token-micro', {
              motionPath: { path: '.ep-path-micro', align: '.ep-path-micro', alignOrigin: [0.5, 0.5] },
              ease: 'power1.inOut', duration: 0.35,
            }, 0.3)
            .to('.ep-token-micro', {
              motionPath: { path: '.ep-path-micro-to-stack', align: '.ep-path-micro-to-stack', alignOrigin: [0.5, 0.5] },
              ease: 'power2.inOut', duration: 0.3,
            }, 0.65)
            .fromTo('.ep-tooltip',
              { opacity: 0, y: 8, scale: 0.96 },
              { opacity: 1, y: 0, scale: 1, ease: 'power2.out', duration: 0.25 }, 0.72);

          // ── Stage 4 — Action (peak + CTA) ──────────────────────────────
          // Unpinned: simple entrance timeline. A #00FFD1 pulse rings
          // outward, the single-line message holds briefly, then fades;
          // the IDE-styled input slides in beneath it.
          gsap.timeline({
            scrollTrigger: {
              trigger: '.stage-action',
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            },
          })
            .fromTo('.stage-peak-pulse',
              { opacity: 0.9, scale: 0.2 },
              { opacity: 0, scale: 3, ease: 'power2.out', duration: 1.2 }, 0)
            .fromTo('.stage-peak-line',
              { opacity: 0, y: 6 },
              { opacity: 1, y: 0, ease: 'power2.out', duration: 0.4 }, 0.1)
            .to('.stage-peak-line', { opacity: 0, duration: 0.4 }, '+=1.5')
            .fromTo('.stage-action-cta',
              { opacity: 0, y: 10 },
              { opacity: 1, y: 0, ease: 'power2.out', duration: 0.4 }, '-=0.1');
        });
      })();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('mousemove', onMove);
      clearInterval(demoTimer);
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (scrollCtx) scrollCtx.revert();
    };
  });

  const modules = [
    {
      id: 'variables',
      title: 'varStore',
      subtitle: 'Variables & Memory',
      desc: 'Watch the CPU store values in memory.',
      color: '#38bdf8',
    },
    {
      id: 'if-gate',
      title: 'ifGate',
      subtitle: 'Conditionals',
      desc: 'See how true and false control the flow.',
      color: '#4ade80',
    },
    {
      id: 'for-loop',
      title: 'forLoop',
      subtitle: 'Iteration',
      desc: 'Watch counters climb as the loop runs.',
      color: '#fbbf24',
    },
    {
      id: 'function',
      title: 'fnCall',
      subtitle: 'Functions',
      desc: 'Values go in, transformations come out.',
      color: '#fb923c',
    },
    {
      id: 'array',
      title: 'arrayFlow',
      subtitle: 'Array Methods',
      desc: 'Elements flow through map, filter, reduce.',
      color: '#818cf8',
    },
    {
      id: 'objects',
      title: 'objExplorer',
      subtitle: 'Objects & Hash Maps',
      desc: 'See key-value pairs stored in hash maps.',
      color: '#c084fc',
    },
    {
      id: 'data-structures',
      title: 'dataStruct',
      subtitle: 'Data Structures',
      desc: 'Stacks, queues, maps — organized data.',
      color: '#f472b6',
    },
    {
      id: 'async',
      title: 'asyncFlow',
      subtitle: 'Async / Await',
      desc: 'Watch promises resolve on a timeline.',
      color: '#a78bfa',
    },
    {
      id: 'closures',
      title: 'closureScope',
      subtitle: 'Closures & Scope',
      desc: 'See which variables a closure captures.',
      color: '#00FFD1',
    },
    {
      id: 'promise-chain',
      title: 'promiseChain',
      subtitle: 'Promise Methods',
      desc: 'Watch .then() and .catch() chain through the microtask queue.',
      color: '#f59e0b',
    },
    {
      id: 'event-listeners',
      title: 'eventListeners',
      subtitle: 'DOM Events',
      desc: 'See how addEventListener registers callbacks and events dispatch.',
      color: '#ec4899',
    },
    {
      id: 'api-calls',
      title: 'apiCalls',
      subtitle: 'HTTP & fetch()',
      desc: 'Trace fetch() requests through suspend, response, and parse.',
      color: '#8b5cf6',
    },
  ];
</script>

<div class="home" role="main" aria-label="Vivix home page">

  <!-- ── Hero — Stage 1: Resonant Frustration ── -->
  <section class="hero" bind:this={heroEl}>

    <!-- Cursor-follow ambient glow. Sits behind the copy so the static
         text surface feels subtly alive — hinting that the invisible
         engine underneath is already thinking. Purely presentational so
         aria-hidden is appropriate. -->
    <div class="hero-glow" aria-hidden="true"></div>

    <!-- Centered copy -->
    <div class="hero-copy">
      <h1 class="hero-title">
        <span class="hero-title-line">See Inside JavaScript</span>
        <span class="hero-title-line hero-title-accent">As It <span class="accent">Thinks</span></span>
      </h1>

      <p class="hero-sub">
        Vivix makes the invisible visible — step through every instruction and watch the JavaScript engine think.
      </p>

      <!-- Stage 1 artefact: the "confusing" async snippet. Purely static —
           it sets up the question that stages 2–3 answer. -->
      <pre class="hero-snippet" aria-label="Example asynchronous JavaScript"><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'1'</span><span class="tok-op">);</span>
<span class="tok-fn">setTimeout</span><span class="tok-op">(() =&gt; </span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'2'</span><span class="tok-op">), </span><span class="tok-num">0</span><span class="tok-op">);</span>
<span class="tok-fn">Promise</span><span class="tok-op">.</span><span class="tok-fn">resolve</span><span class="tok-op">().</span><span class="tok-fn">then</span><span class="tok-op">(() =&gt; </span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'3'</span><span class="tok-op">));</span>
<span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'4'</span><span class="tok-op">);</span></pre>

      <div class="hero-ctas">
        <a href="#/variables" class="cta-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg>
          Try it now
        </a>
        <button class="cta-ghost" onclick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}>See all 12 modules</button>
      </div>

      <p class="hero-hint">No account. No install. Free and open source.</p>
    </div>

    <!-- Product preview: the star of the hero -->
    <div class="demo-shell" aria-hidden="true">

      <!-- macOS window chrome -->
      <div class="demo-bar">
        <span class="demo-dot" style="background:#ff5f57"></span>
        <span class="demo-dot" style="background:#febc2e"></span>
        <span class="demo-dot" style="background:#28c840"></span>
        <span class="demo-title">async.js</span>
        <span class="demo-concept-tag">Async / Await</span>
        <span class="demo-badge">● LIVE</span>
      </div>

      <!-- Main body: code left, viz right -->
      <div class="demo-body">

        <!-- Code panel -->
        <div class="demo-code">
          {#each DEMO_LINES as tokens, i}
            <div class="demo-line" class:demo-line-active={currentStep.line === i}>
              <span class="demo-ln">{i + 1}</span>
              <span class="demo-arrow">{currentStep.line === i ? '▶' : ' '}</span>
              <span class="demo-tokens">
                {#each tokens as tok}
                  <span class="tok-{tok.k}">{tok.v}</span>
                {/each}
              </span>
            </div>
          {/each}
        </div>

        <!-- Viz panel — the real unique parts -->
        <div class="demo-viz">

          <!-- CPU dashboard row -->
          <div class="demo-cpu">
            <!-- Circular step gauge -->
            <div class="demo-gauge">
              <svg viewBox="0 0 52 52" width="52" height="52">
                <circle cx="26" cy="26" r="22" fill="none" stroke="#1a1a2e" stroke-width="4"/>
                <circle cx="26" cy="26" r="22" fill="none" stroke="#4ade80" stroke-width="3.5"
                  stroke-dasharray="{(demoStep / (DEMO_STEPS.length - 1)) * 138} 138"
                  stroke-linecap="round"
                  transform="rotate(-90 26 26)"
                  style="transition: stroke-dasharray 0.5s ease"/>
                <text x="26" y="24" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="'Geist Mono', monospace">{demoStep + 1}</text>
                <text x="26" y="34" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="6.5" font-family="'Geist Mono', monospace">/{DEMO_STEPS.length}</text>
              </svg>
            </div>

            <!-- CPU chip icon -->
            <div class="demo-chip" class:demo-chip-active={currentStep.op !== 'DONE'}>
              <svg viewBox="0 0 36 36" width="36" height="36">
                <rect x="8" y="8" width="20" height="20" rx="3" fill="#0d0d1a" stroke="#4ade80" stroke-width="1.5"/>
                <rect x="12" y="12" width="12" height="12" rx="2" fill="#4ade8015" stroke="#4ade80" stroke-width="1"/>
                {#if currentStep.op !== 'DONE'}
                  <circle cx="18" cy="18" r="2.5" fill="#4ade80" opacity="0.9"/>
                {:else}
                  <path d="M14 18 l3 3 l6-6" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linecap="round"/>
                {/if}
              </svg>
            </div>

            <!-- Registers -->
            <div class="demo-registers">
              <div class="demo-reg">
                <span class="demo-reg-label">PC</span>
                <span class="demo-reg-val">{currentStep.pc}</span>
              </div>
              <div class="demo-reg">
                <span class="demo-reg-label">OP</span>
                <span class="demo-reg-val demo-reg-op" class:op-done={currentStep.op === 'DONE'}>{currentStep.op}</span>
              </div>
              <div class="demo-reg">
                <span class="demo-reg-label">WRITES</span>
                <span class="demo-reg-val" style="color:#fbbf24">{currentStep.writes}</span>
              </div>
            </div>
          </div>

          <!-- Call stack -->
          <div class="demo-stack-row">
            <span class="demo-stack-label">STACK</span>
            <span class="demo-stack-frame" class:frame-call={currentStep.stack !== 'Global'}>{currentStep.stack}</span>
          </div>

          <!-- Heap memory -->
          <div class="demo-heap">
            <div class="demo-heap-hdr">HEAP MEMORY</div>
            <div class="demo-heap-vars">
              {#each currentStep.vars as v (v.n)}
                <div class="demo-heap-var" style="--vc: {v.c}">
                  <div class="demo-heap-top">
                    <span class="demo-heap-name">{v.n}</span>
                    <span class="demo-heap-type">{v.t}</span>
                  </div>
                  <span class="demo-heap-val" style="color:{v.c}">{v.v}</span>
                  {#if v.bytes}
                    <div class="demo-heap-bytes">
                      {#each Array(Math.min(v.bytes, 8)) as _}
                        <span class="demo-byte" style="background:{v.c}"></span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
              {#if currentStep.vars.length === 0}
                <span class="demo-heap-empty">no variables yet…</span>
              {/if}
            </div>
            {#if currentStep.out}
              <div class="demo-stdout">
                <span class="demo-stdout-label">› console.log</span>
                <span class="demo-stdout-val">{currentStep.out}</span>
              </div>
            {/if}
          </div>

          <!-- Memory map — matches the real module view -->
          {#if currentStep.vars.length > 0}
            <div class="demo-memmap">
              <div class="demo-memmap-hdr">
                <span class="demo-memmap-icon">⣿</span>
                <span class="demo-memmap-title">MEMORY MAP</span>
                <span class="demo-memmap-usage">~{currentStep.vars.reduce((s, v) => s + (v.bytes || 0), 0)}B used</span>
              </div>
              <div class="demo-memmap-rows">
                {#each currentStep.vars as v (v.n)}
                  <div class="demo-memmap-row">
                    <span class="demo-memmap-name">{v.n}</span>
                    <span class="demo-memmap-type">{v.t}</span>
                    <div class="demo-memmap-bar">
                      {#each Array(Math.min(v.bytes || 1, 8)) as _}
                        <span class="demo-memmap-byte" style="background:{v.c}"></span>
                      {/each}
                    </div>
                    <span class="demo-memmap-size">{v.bytes || 0}B</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Status row — shows completion stats like real module -->
          {#if currentStep.op === 'DONE'}
            <div class="demo-status">
              <span class="demo-status-check">✓</span>
              <span class="demo-status-label">Program Complete</span>
              <span class="demo-status-stats">{currentStep.vars.length} vars · {currentStep.writes} writes</span>
            </div>
          {/if}

        </div>
      </div>

      <!-- Explanation strip -->
      <div class="demo-explain">
        <span class="demo-explain-icon">◈</span>
        <span class="demo-explain-text">{currentStep.explain}</span>
      </div>

      <!-- Progress bar -->
      <div class="demo-footer">
        <div class="demo-progress-track">
          <div class="demo-progress-fill" style="width: {((demoStep + 1) / DEMO_STEPS.length) * 100}%"></div>
        </div>
        <span class="demo-step-counter">step {demoStep + 1} / {DEMO_STEPS.length}</span>
      </div>

    </div>

    <!-- Feature highlights — below the demo -->
    <div class="hero-highlights">
      <div class="highlight">
        <span class="hl-icon" style="--fc:#4ade80">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M12 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div class="hl-text">
          <strong>Step-by-step execution</strong>
          <span>Scrub through every instruction with ⟪ ◁ ▷ ⟫ controls</span>
        </div>
      </div>
      <div class="highlight">
        <span class="hl-icon" style="--fc:#38bdf8">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="7" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="11" y="7" width="7" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>
        </span>
        <div class="hl-text">
          <strong>Live memory view</strong>
          <span>Watch variables, types, and byte sizes appear in real time</span>
        </div>
      </div>
      <div class="highlight">
        <span class="hl-icon" style="--fc:#c084fc">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </span>
        <div class="hl-text">
          <strong>12 interactive concepts</strong>
          <span>Variables, loops, functions, closures, async/await, and more</span>
        </div>
      </div>
    </div>

  </section>

  <!-- ════════════════════════════════════════════════════════════════════
       SCROLLYTELLING — Stages 2 → 4
       Each stage wraps in .stage-wrap which enforces the 120px breathing
       room the brief requires and provides the ScrollTrigger anchor. All
       transforms below are transform/opacity only (plus filter on the
       initial sharpening blur) so Chrome can composite on the GPU. If the
       user opts out of motion, the pinning/scrubbing is skipped and each
       stage renders in its final frame thanks to the CSS below.
       ════════════════════════════════════════════════════════════════════ -->

  <!-- ── Stage 2 — The Reveal (Epistemic Curiosity) ── -->
  <section class="stage-wrap stage-wrap-reveal" aria-label="Stage 2: the engine revealed">
    <div class="stage stage-reveal">
      <header class="stage-head">
        <span class="stage-kicker">Stage 02</span>
        <h2 class="stage-title">The engine comes into focus</h2>
        <p class="stage-sub">Scroll to scrub through the instructions. The dashboard sharpens as the engine starts to think.</p>
      </header>

      <div class="stage-body sr-body">

        <!-- Sticky-pinned code panel on the left -->
        <div class="sr-code-shell">
          <div class="sr-window-bar">
            <span class="demo-dot" style="background:#ff5f57"></span>
            <span class="demo-dot" style="background:#febc2e"></span>
            <span class="demo-dot" style="background:#28c840"></span>
            <span class="sr-window-title">eventloop.js</span>
          </div>
          <pre class="sr-code" aria-hidden="true"><span class="sr-line" data-l="0"><span class="sr-ln">1</span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'1'</span><span class="tok-op">);</span></span>
<span class="sr-line" data-l="1"><span class="sr-ln">2</span><span class="tok-fn">setTimeout</span><span class="tok-op">(() =&gt; </span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'2'</span><span class="tok-op">), </span><span class="tok-num">0</span><span class="tok-op">);</span></span>
<span class="sr-line" data-l="2"><span class="sr-ln">3</span><span class="tok-fn">Promise</span><span class="tok-op">.</span><span class="tok-fn">resolve</span><span class="tok-op">().</span><span class="tok-fn">then</span><span class="tok-op">(() =&gt; </span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'3'</span><span class="tok-op">));</span></span>
<span class="sr-line" data-l="3"><span class="sr-ln">4</span><span class="tok-fn">console</span><span class="tok-op">.</span><span class="tok-fn">log</span><span class="tok-op">(</span><span class="tok-str">'4'</span><span class="tok-op">);</span></span>
<span class="sr-line" data-l="4"><span class="sr-ln">5</span><span class="tok-op">// engine drains queues…</span></span></pre>
        </div>

        <!-- Dashboard that sharpens into view -->
        <div class="sr-dashboard" aria-hidden="true">
          <div class="sr-dash-row">
            <div class="sr-zone sr-zone-stack">
              <span class="sr-zone-label">Call Stack</span>
              <div class="sr-zone-body">
                <div class="sr-stack-frame">console.log</div>
              </div>
            </div>
            <div class="sr-zone sr-zone-webapi">
              <span class="sr-zone-label">Web APIs</span>
              <div class="sr-zone-body sr-zone-body-wire"></div>
            </div>
            <div class="sr-zone sr-zone-queue">
              <span class="sr-zone-label">Task Queue</span>
              <div class="sr-zone-body sr-zone-body-wire"></div>
            </div>
          </div>

          <!-- MotionPath SVG overlay — the token flies along sr-path-to-stack. -->
          <svg class="sr-overlay" viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden="true">
            <path class="sr-path-to-stack" d="M 30 30 C 160 20, 220 130, 80 170" fill="none" stroke="rgba(0,255,209,0.18)" stroke-width="1" stroke-dasharray="2 3"/>
          </svg>
          <div class="sr-token">log</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Stage 3 — The Epiphany (Eureka Effect) ── -->
  <section class="stage-wrap stage-wrap-epiphany" aria-label="Stage 3: event loop epiphany">
    <div class="stage stage-epiphany">
      <header class="stage-head">
        <span class="stage-kicker">Stage 03</span>
        <h2 class="stage-title">The Event Loop, finally legible</h2>
        <p class="stage-sub">Watch the microtask jump the queue. Macrotasks wait their turn.</p>
      </header>

      <div class="ep-board" aria-hidden="true">

        <!-- Lanes — Call Stack, Web APIs, Microtask Queue, Macrotask Queue. -->
        <div class="ep-lane ep-lane-stack">
          <span class="ep-lane-label">Call Stack</span>
          <div class="ep-lane-body"></div>
        </div>
        <div class="ep-lane ep-lane-webapi">
          <span class="ep-lane-label">Web APIs</span>
          <div class="ep-lane-body"></div>
        </div>
        <div class="ep-lane ep-lane-micro">
          <span class="ep-lane-label">Microtask Queue</span>
          <div class="ep-lane-body"></div>
        </div>
        <div class="ep-lane ep-lane-macro">
          <span class="ep-lane-label">Macrotask Queue</span>
          <div class="ep-lane-body"></div>
        </div>

        <!-- Rotating event-loop ring in the dead centre. Its colour
             follows the brand teal and its inner ticks mimic a clock
             face so the rotation reads legibly even at a glance. -->
        <div class="ep-loop-wrap">
          <div class="ep-loop">
            <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,255,209,0.16)" stroke-width="2"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#00FFD1" stroke-width="2" stroke-dasharray="12 294" stroke-linecap="round"/>
              <circle cx="60" cy="60" r="38" fill="rgba(0,255,209,0.05)"/>
              <text x="60" y="58" text-anchor="middle" fill="#00FFD1" font-size="10" font-family="'Geist Mono', monospace" font-weight="700">EVENT</text>
              <text x="60" y="72" text-anchor="middle" fill="#00FFD1" font-size="10" font-family="'Geist Mono', monospace" font-weight="700">LOOP</text>
            </svg>
          </div>
        </div>

        <!-- Motion paths — invisible guides for the two tokens. -->
        <svg class="ep-paths" viewBox="0 0 800 440" preserveAspectRatio="none" aria-hidden="true">
          <!-- setTimeout → Web APIs → Macrotask Queue -->
          <path class="ep-path-macro" d="M 240 80 C 560 80, 620 220, 620 360" fill="none" stroke="none"/>
          <!-- Promise.resolve().then → Microtask Queue -->
          <path class="ep-path-micro" d="M 240 80 C 500 100, 200 260, 180 360" fill="none" stroke="none"/>
          <!-- Microtask queue → back up into the empty Call Stack -->
          <path class="ep-path-micro-to-stack" d="M 180 360 C 120 260, 200 120, 240 80" fill="none" stroke="none"/>
        </svg>

        <!-- Tokens. Start co-located with the code origin; MotionPath
             re-positions them via transform so no reflow is triggered. -->
        <!-- Labels name the *callback* that gets queued, not the call itself.
             setTimeout(fn, 0) enqueues `fn` to the Macrotask Queue;
             Promise.resolve().then(fn) enqueues `fn` to the Microtask Queue. -->
        <div class="ep-token ep-token-macro" style="--tc:#f59e0b">setTimeout cb</div>
        <div class="ep-token ep-token-micro" style="--tc:#9C40FF">.then cb</div>

        <!-- Epiphany tooltip — reveals at the exact scrub moment the
             microtask is promoted to the empty stack. -->
        <div class="ep-tooltip" role="note">
          <span class="ep-tooltip-arrow" aria-hidden="true"></span>
          The Event Loop only moves tasks to the Call Stack when the Stack is completely empty. <strong>Microtasks always skip the line.</strong>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Stage 4 — Empowered Action ── -->
  <section class="stage-wrap stage-wrap-action" aria-label="Stage 4: empowered action">
    <div class="stage stage-action">

      <!-- Peak moment: one pulse of #00FFD1 + one-line payoff. -->
      <div class="stage-peak" aria-hidden="true">
        <div class="stage-peak-pulse"></div>
      </div>
      <p class="stage-peak-line" role="status">The engine is no longer invisible.</p>

      <!-- IDE-styled input pane + CTA. The visible shell doubles as a
           visual promise of what the visualiser looks like. -->
      <div class="stage-action-cta">
        <div class="stage-action-copy">Now try it with your own code.</div>
        <a href="#/free-form" class="stage-action-ide" aria-label="Launch Visualizer">
          <div class="stage-action-ide-bar">
            <span class="demo-dot" style="background:#ff5f57"></span>
            <span class="demo-dot" style="background:#febc2e"></span>
            <span class="demo-dot" style="background:#28c840"></span>
            <span class="stage-action-ide-title">your-code.js</span>
          </div>
          <div class="stage-action-ide-body">
            <span class="stage-action-ide-caret">▸</span>
            <span class="stage-action-ide-placeholder">paste or type JavaScript…</span>
          </div>
          <div class="stage-action-ide-launch">
            Launch Visualizer
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 7h8M7.5 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </a>
      </div>
    </div>
  </section>

  <!-- ── Free-form mode entry ── -->
  <a href="#/free-form" class="freeform-card" aria-label="Free-form mode: paste any JavaScript and see it visualized">
    <div class="freeform-icon">
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <rect x="6" y="6" width="36" height="36" rx="8" fill="#00FFD112" stroke="#00FFD1" stroke-width="1.5"/>
        <text x="24" y="21" text-anchor="middle" fill="#00FFD1" font-size="9" font-family="'Geist Mono', monospace" font-weight="700" opacity="0.7">{'{ }'}</text>
        <line x1="14" y1="28" x2="34" y2="28" stroke="#00FFD1" stroke-width="1" opacity="0.4"/>
        <line x1="14" y1="33" x2="28" y2="33" stroke="#00FFD1" stroke-width="1" opacity="0.3"/>
        <line x1="14" y1="38" x2="22" y2="38" stroke="#00FFD1" stroke-width="1" opacity="0.2"/>
      </svg>
    </div>
    <div class="freeform-text">
      <h3 class="freeform-title">Free-Form Mode</h3>
      <p class="freeform-desc">Paste any JavaScript and watch the engine narrate every step. Pattern detection identifies recursion, closures, async/await, scope chains, hoisting, and prototype patterns automatically.</p>
    </div>
    <span class="freeform-arrow">→</span>
  </a>

  <!-- ── Section divider ── -->
  <div id="modules" class="section-divider">
    <span class="divider-label">Pick a concept to explore</span>
  </div>

  <ul class="modules-grid" aria-label="Learning modules">
    {#each modules as mod}
      <li class="module-card-wrap">
      <a href="#/{mod.id}" class="module-card" style="--c: {mod.color}" aria-label="{mod.subtitle}: {mod.desc}">

        <!-- Hero illustration area -->
        <div class="card-hero">
          {#if mod.id === 'variables'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="10" y="18" width="54" height="44" rx="9" fill={mod.color + '14'} stroke={mod.color} stroke-width="1.5" opacity="0.8"/>
              <text x="37" y="45" text-anchor="middle" fill={mod.color} font-size="14" font-weight="700" font-family="'Geist Mono', monospace">x = 5</text>
              <line x1="68" y1="40" x2="98" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <circle cx="103" cy="40" r="2.5" fill={mod.color} opacity="0.9"/>
              <rect x="114" y="24" width="48" height="32" rx="7" fill={mod.color + '18'} stroke={mod.color} stroke-width="1.2" opacity="0.75"/>
              <text x="138" y="44" text-anchor="middle" fill={mod.color} font-size="10" font-family="'Geist Mono', monospace" font-weight="600">0x4A</text>
            </svg>
          {:else if mod.id === 'if-gate'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <polygon points="100,8 148,40 100,72 52,40" fill={mod.color + '0e'} stroke={mod.color} stroke-width="1.5" opacity="0.85"/>
              <text x="100" y="45" text-anchor="middle" fill={mod.color} font-size="15" font-weight="700" font-family="'Geist Mono', monospace">?</text>
              <line x1="148" y1="40" x2="180" y2="22" stroke="#4ade80" stroke-width="1.2" opacity="0.7"/>
              <text x="184" y="20" fill="#4ade80" font-size="9" font-family="'Geist Mono', monospace" font-weight="600">tru</text>
              <line x1="148" y1="40" x2="180" y2="58" stroke="#f87171" stroke-width="1.2" opacity="0.7"/>
              <text x="184" y="62" fill="#f87171" font-size="9" font-family="'Geist Mono', monospace" font-weight="600">fal</text>
            </svg>
          {:else if mod.id === 'for-loop'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="100" cy="40" r="30" fill="none" stroke={mod.color} stroke-width="1" opacity="0.2"/>
              <circle cx="100" cy="40" r="30" fill="none" stroke={mod.color} stroke-width="1.8" stroke-dasharray="44 144" stroke-dashoffset="-20" opacity="0.9"/>
              <circle cx="129" cy="29" r="4.5" fill={mod.color} opacity="0.95"/>
              <text x="100" y="44" text-anchor="middle" fill={mod.color} font-size="11" font-family="'Geist Mono', monospace" font-weight="600" opacity="0.75">i++</text>
            </svg>
          {:else if mod.id === 'function'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="26" cy="40" r="9" fill={mod.color + '22'} stroke={mod.color} stroke-width="1.2" opacity="0.8"/>
              <line x1="39" y1="40" x2="65" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.5" marker-end="url(#arr)"/>
              <rect x="68" y="16" width="64" height="48" rx="9" fill={mod.color + '14'} stroke={mod.color} stroke-width="1.5" opacity="0.8"/>
              <text x="100" y="46" text-anchor="middle" fill={mod.color} font-size="20" font-weight="700" font-family="'Geist Sans', sans-serif" font-style="italic" opacity="0.9">f</text>
              <line x1="136" y1="40" x2="162" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <circle cx="172" cy="40" r="9" fill={mod.color + '28'} stroke={mod.color} stroke-width="1.2" opacity="0.85"/>
            </svg>
          {:else if mod.id === 'array'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="18" y="22" width="28" height="36" rx="5" fill={mod.color + '16'} stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <rect x="52" y="22" width="28" height="36" rx="5" fill={mod.color + '22'} stroke={mod.color} stroke-width="1.3" opacity="0.65"/>
              <rect x="86" y="22" width="28" height="36" rx="5" fill={mod.color + '2e'} stroke={mod.color} stroke-width="1.4" opacity="0.78"/>
              <rect x="120" y="22" width="28" height="36" rx="5" fill={mod.color + '3a'} stroke={mod.color} stroke-width="1.5" opacity="0.88"/>
              <rect x="154" y="22" width="28" height="36" rx="5" fill={mod.color + '46'} stroke={mod.color} stroke-width="1.6" opacity="0.95"/>
            </svg>
          {:else if mod.id === 'objects'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="36" y="12" width="128" height="56" rx="10" fill={mod.color + '0e'} stroke={mod.color} stroke-width="1.4" opacity="0.75"/>
              <text x="82" y="33" text-anchor="middle" fill={mod.color} font-size="8.5" font-family="'Geist Mono', monospace" opacity="0.6">name</text>
              <text x="82" y="52" text-anchor="middle" fill={mod.color} font-size="11" font-family="'Geist Mono', monospace" font-weight="600" opacity="0.9">"alice"</text>
              <line x1="118" y1="19" x2="118" y2="61" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <text x="148" y="33" text-anchor="middle" fill={mod.color} font-size="8.5" font-family="'Geist Mono', monospace" opacity="0.6">age</text>
              <text x="148" y="52" text-anchor="middle" fill={mod.color} font-size="11" font-family="'Geist Mono', monospace" font-weight="600" opacity="0.9">25</text>
            </svg>
          {:else if mod.id === 'data-structures'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="72" y="4" width="56" height="16" rx="4" fill={mod.color + '1a'} stroke={mod.color} stroke-width="1.1" opacity="0.5"/>
              <rect x="72" y="23" width="56" height="16" rx="4" fill={mod.color + '26'} stroke={mod.color} stroke-width="1.2" opacity="0.65"/>
              <rect x="72" y="42" width="56" height="16" rx="4" fill={mod.color + '30'} stroke={mod.color} stroke-width="1.3" opacity="0.78"/>
              <rect x="72" y="61" width="56" height="16" rx="4" fill={mod.color + '3c'} stroke={mod.color} stroke-width="1.4" opacity="0.9"/>
            </svg>
          {:else if mod.id === 'async'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <line x1="18" y1="40" x2="182" y2="40" stroke={mod.color} stroke-width="1" opacity="0.25"/>
              <circle cx="45" cy="40" r="7" fill={mod.color + '1e'} stroke={mod.color} stroke-width="1.3" opacity="0.65"/>
              <circle cx="100" cy="40" r="7" fill={mod.color + '2a'} stroke={mod.color} stroke-width="1.4" opacity="0.8"/>
              <circle cx="155" cy="40" r="7" fill={mod.color + '36'} stroke={mod.color} stroke-width="1.5" opacity="0.95"/>
              <path d="M45 40 Q 72 16, 100 40 Q 128 64, 155 40" fill="none" stroke={mod.color} stroke-width="1.4" opacity="0.5"/>
            </svg>
          {:else if mod.id === 'closures'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="22" y="8" width="156" height="64" rx="12" fill={mod.color + '08'} stroke={mod.color} stroke-width="1" opacity="0.4"/>
              <rect x="40" y="20" width="120" height="44" rx="9" fill={mod.color + '10'} stroke={mod.color} stroke-width="1.2" opacity="0.6"/>
              <rect x="60" y="30" width="80" height="26" rx="6" fill={mod.color + '1c'} stroke={mod.color} stroke-width="1.4" opacity="0.85"/>
              <circle cx="100" cy="43" r="5" fill={mod.color} opacity="0.7"/>
            </svg>
          {:else if mod.id === 'promise-chain'}
            <!-- Four linked promise nodes with .then() arcs and a
                 diverging .catch() tail — the signature of a chain. -->
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="28"  cy="40" r="9" fill={mod.color + '1e'} stroke={mod.color} stroke-width="1.3" opacity="0.75"/>
              <circle cx="74"  cy="40" r="9" fill={mod.color + '2a'} stroke={mod.color} stroke-width="1.4" opacity="0.85"/>
              <circle cx="120" cy="40" r="9" fill={mod.color + '36'} stroke={mod.color} stroke-width="1.5" opacity="0.95"/>
              <circle cx="170" cy="22" r="7" fill="#f87171" stroke="#f87171" stroke-width="1.2" opacity="0.8" fill-opacity="0.18"/>
              <path d="M37 40 Q 51 24, 65 40"   fill="none" stroke={mod.color} stroke-width="1.3" opacity="0.7"/>
              <path d="M83 40 Q 97 24, 111 40"  fill="none" stroke={mod.color} stroke-width="1.3" opacity="0.7"/>
              <path d="M129 40 Q 148 30, 163 26" fill="none" stroke="#f87171" stroke-width="1.2" opacity="0.55" stroke-dasharray="3 3"/>
              <text x="28"  y="43" text-anchor="middle" fill={mod.color} font-size="7" font-family="'Geist Mono', monospace" font-weight="700">.then</text>
              <text x="74"  y="43" text-anchor="middle" fill={mod.color} font-size="7" font-family="'Geist Mono', monospace" font-weight="700">.then</text>
              <text x="120" y="43" text-anchor="middle" fill={mod.color} font-size="7" font-family="'Geist Mono', monospace" font-weight="700">.then</text>
              <text x="170" y="25" text-anchor="middle" fill="#f87171" font-size="6" font-family="'Geist Mono', monospace" font-weight="700">catch</text>
            </svg>
          {:else if mod.id === 'event-listeners'}
            <!-- DOM target (rounded rect) with a lightning bolt zapping
                 it — addEventListener firing a callback. -->
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="44" y="22" width="112" height="36" rx="8" fill={mod.color + '12'} stroke={mod.color} stroke-width="1.3" opacity="0.75"/>
              <text x="100" y="45" text-anchor="middle" fill={mod.color} font-size="11" font-family="'Geist Mono', monospace" font-weight="600" opacity="0.88">click</text>
              <polygon points="20,26 32,26 25,40 36,40 18,60 26,44 16,44" fill={mod.color} opacity="0.85"/>
              <circle cx="172" cy="40" r="4" fill={mod.color} opacity="0.55">
              </circle>
              <line x1="156" y1="40" x2="168" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.55" stroke-dasharray="2 2"/>
            </svg>
          {:else if mod.id === 'api-calls'}
            <!-- Client box on the left, cloud/server cluster on the
                 right, with a request/response arc between them. -->
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="14" y="26" width="44" height="30" rx="5" fill={mod.color + '16'} stroke={mod.color} stroke-width="1.3" opacity="0.8"/>
              <text x="36" y="44" text-anchor="middle" fill={mod.color} font-size="8" font-family="'Geist Mono', monospace" font-weight="700" opacity="0.85">app</text>
              <path d="M142 40 Q 150 26, 158 30 Q 170 22, 178 32 Q 186 34, 184 44 Q 186 54, 172 54 Q 160 58, 152 52 Q 140 52, 142 40 Z"
                fill={mod.color + '1c'} stroke={mod.color} stroke-width="1.3" opacity="0.8"/>
              <text x="164" y="46" text-anchor="middle" fill={mod.color} font-size="7" font-family="'Geist Mono', monospace" font-weight="700" opacity="0.9">api</text>
              <path d="M62 36 Q 100 12, 138 36" fill="none" stroke={mod.color} stroke-width="1.4" opacity="0.55"/>
              <path d="M138 48 Q 100 68, 62 48" fill="none" stroke={mod.color} stroke-width="1.4" opacity="0.55" stroke-dasharray="3 3"/>
              <polygon points="136,34 142,36 136,39" fill={mod.color} opacity="0.8"/>
              <polygon points="64,50 58,48 64,45" fill={mod.color} opacity="0.65"/>
            </svg>
          {/if}
        </div>

        <!-- Text -->
        <div class="card-text">
          <h3>{mod.title}</h3>
          <span class="card-sub" style="color: {mod.color}">{mod.subtitle}</span>
          <p>{mod.desc}</p>
        </div>

      </a>
      </li>
    {/each}
  </ul>

</div>

<style>
  /* ════════════════════════════════════════════════════════════════════
     SCROLLYTELLING STAGES
     Stages 2–4 sit between the hero and the existing free-form card.
     Each stage lives inside `.stage-wrap` which enforces a 120px vertical
     breathing zone top and bottom (the brief's minimum) plus a dark,
     atmospheric backdrop consistent with the rest of the marketing page.
     All animated transforms are composite-friendly (transform + opacity
     + one initial filter blur) so frame budget stays under a millisecond.
     ════════════════════════════════════════════════════════════════════ */

  /* ─── Hero cursor-follow glow ─────────────────────────────────────── */
  .hero {
    position: relative;
    isolation: isolate;
  }
  .hero-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(
        260px circle at var(--hero-glow-x, 50%) var(--hero-glow-y, 50%),
        rgba(0, 255, 209, 0.10) 0%,
        rgba(0, 255, 209, 0.04) 35%,
        transparent 70%
      );
    transition: background 0.18s ease;
    will-change: background;
  }
  .hero > *:not(.hero-glow) { position: relative; z-index: 1; }

  /* ─── Hero static confusing snippet ───────────────────────────────── */
  .hero-snippet {
    margin: 24px auto 8px;
    padding: 14px 18px;
    max-width: 560px;
    width: 100%;
    background: rgba(9, 9, 11, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(10px) saturate(130%);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
    font-family: var(--font-code);
    font-size: 0.78rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.78);
    text-align: left;
    white-space: pre;
    overflow-x: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    animation: hero-fade-in 0.9s ease 0.2s both;
  }

  /* ─── Common stage wrappers ───────────────────────────────────────── */
  .stage-wrap {
    width: 100%;
    max-width: 1200px;
    /* 48px reads as a deliberate beat between stages. Earlier values
       (120px → 72px) kept stacking with stage padding + action padding
       into ~130–250px of dead space. Now the wrap gutter carries the
       full inter-stage rhythm and the stages themselves have zero
       vertical padding. */
    margin: 48px auto 0;
    padding: 0 24px;
    position: relative;
  }
  .stage-wrap:last-of-type { margin-bottom: 24px; }

  .stage {
    position: relative;
    /* Content-sized, zero vertical padding. ScrollTrigger pins the
       stage regardless of its own height — its pin-spacer supplies the
       scroll distance — and the .stage-wrap margin owns the gap to the
       next stage. */
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 0;
    border-radius: 20px;
  }

  .stage-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 640px;
  }
  .stage-kicker {
    font-family: var(--font-code);
    font-size: 0.68rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #00FFD1;
    opacity: 0.75;
  }
  .stage-title {
    font-family: var(--font-ui);
    font-size: clamp(1.6rem, 3.4vw, 2.4rem);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.94);
    margin: 0;
    letter-spacing: -0.4px;
    line-height: 1.15;
  }
  .stage-sub {
    font-family: var(--font-ui);
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.55;
  }

  /* ════════════════════════════════════════════════════════════════════
     STAGE 2 — The Reveal
     A two-column split: code panel on the left, glass dashboard on the
     right. The dashboard starts heavily blurred; GSAP scrubs the filter
     to 0 as the user scrolls, and the MotionPath in `.sr-overlay` routes
     a token from the code into the Call Stack zone.
     ════════════════════════════════════════════════════════════════════ */
  .sr-body {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    gap: 28px;
    align-items: start;
  }

  .sr-code-shell {
    background: rgba(12, 12, 18, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
    position: sticky;
    top: 88px;
  }
  .sr-window-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: #111120;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .sr-window-title {
    margin-left: 8px;
    font-family: var(--font-code);
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
  }
  .sr-code {
    margin: 0;
    padding: 20px 18px;
    font-family: var(--font-code);
    font-size: 0.82rem;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.78);
    white-space: pre;
    overflow-x: auto;
  }
  .sr-line {
    display: block;
    padding: 1px 8px;
    margin: 0 -8px;
    border-radius: 6px;
    opacity: 1;
    transition: background 0.15s ease;
  }
  /* Scroll-scrubbed highlight: GSAP ramps opacity from 0.35 → 1 on the
     active line. We add a subtle teal wash to reinforce the "current
     instruction" reading. */
  .sr-line[data-l]:not([data-l="4"]) {
    background: color-mix(in srgb, #00FFD1 0%, transparent);
  }
  .sr-ln {
    display: inline-block;
    width: 20px;
    margin-right: 10px;
    color: rgba(255, 255, 255, 0.22);
    user-select: none;
  }

  /* Dashboard — glassmorphic; starts blurred via inline filter that
     GSAP animates to 0. Transform/opacity only thereafter. */
  .sr-dashboard {
    position: relative;
    min-height: 320px;
    padding: 24px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    filter: blur(24px);
    opacity: 0.2;
    will-change: filter, opacity, transform;
  }
  .sr-dash-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .sr-zone {
    padding: 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    min-height: 180px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sr-zone-label {
    font-family: var(--font-code);
    font-size: 0.64rem;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .sr-zone-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .sr-zone-body-wire {
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }
  .sr-stack-frame {
    padding: 8px 10px;
    background: rgba(0, 255, 209, 0.08);
    border: 1px solid rgba(0, 255, 209, 0.28);
    border-radius: 8px;
    font-family: var(--font-code);
    font-size: 0.78rem;
    color: #00FFD1;
  }

  .sr-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .sr-token {
    position: absolute;
    top: 0; left: 0;
    padding: 4px 10px;
    border-radius: 999px;
    background: #00FFD1;
    color: #051715;
    font-family: var(--font-code);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.2px;
    box-shadow: 0 0 20px rgba(0, 255, 209, 0.55);
    opacity: 0;
    will-change: transform, opacity;
    pointer-events: none;
  }

  /* ════════════════════════════════════════════════════════════════════
     STAGE 3 — The Epiphany
     Four lanes around a central rotating event-loop ring. Two tokens
     trace MotionPaths to their respective queues; the tooltip reveals
     at the climax.
     ════════════════════════════════════════════════════════════════════ */
  .ep-board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: 140px 140px;
    gap: 18px;
    padding: 24px;
    min-height: 440px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .ep-lane {
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ep-lane-stack  { grid-column: 1 / 2; grid-row: 1 / 2; border-color: rgba(0, 255, 209, 0.28); }
  .ep-lane-webapi { grid-column: 4 / 5; grid-row: 1 / 2; border-color: rgba(56, 189, 248, 0.28); }
  .ep-lane-micro  { grid-column: 1 / 2; grid-row: 2 / 3; border-color: rgba(156, 64, 255, 0.35); }
  .ep-lane-macro  { grid-column: 4 / 5; grid-row: 2 / 3; border-color: rgba(245, 158, 11, 0.32); }
  .ep-lane-label {
    font-family: var(--font-code);
    font-size: 0.62rem;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.52);
  }
  .ep-lane-body  { flex: 1; border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.08); }

  .ep-loop-wrap {
    grid-column: 2 / 4;
    grid-row: 1 / 3;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ep-loop {
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
    transform-origin: center;
  }

  .ep-paths {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .ep-token {
    position: absolute;
    top: 0; left: 0;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--tc, #00FFD1);
    color: #051715;
    font-family: var(--font-code);
    font-size: 0.68rem;
    font-weight: 800;
    box-shadow: 0 0 18px color-mix(in srgb, var(--tc, #00FFD1) 55%, transparent);
    opacity: 0;
    will-change: transform, opacity;
    pointer-events: none;
  }
  /* The Microtask token renders in a darker value on its purple chip so
     the contrast hits WCAG AA on the #9C40FF background. */
  .ep-token-micro { color: #0c0016; }

  .ep-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 72px);
    max-width: 380px;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(9, 9, 11, 0.92);
    border: 1px solid rgba(0, 255, 209, 0.4);
    box-shadow: 0 10px 40px rgba(0, 255, 209, 0.18);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.88);
    opacity: 0;
    z-index: 3;
    pointer-events: none;
  }
  .ep-tooltip strong { color: #00FFD1; font-weight: 700; }
  .ep-tooltip-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 10px;
    height: 10px;
    background: rgba(9, 9, 11, 0.92);
    border-top: 1px solid rgba(0, 255, 209, 0.4);
    border-left: 1px solid rgba(0, 255, 209, 0.4);
  }

  /* ════════════════════════════════════════════════════════════════════
     STAGE 4 — Empowered Action
     ════════════════════════════════════════════════════════════════════ */
  .stage-action {
    /* Content-sized, centered. The peak pulse + peak line are both
       absolutely positioned (see below) so only the CTA owns the flow
       layout — this is what makes the Stage-3 → Stage-4 gap match the
       48px wrap margin instead of +200px of reserved peak space. */
    position: relative;
    min-height: auto;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 0;
    text-align: center;
  }
  .stage-peak {
    /* Absolute: the brief pulse flourish overlays the CTA location
       rather than pushing it down 120px. */
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .stage-peak-pulse {
    position: absolute;
    inset: 30%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,255,209,0.9), rgba(0,255,209,0) 70%);
    will-change: transform, opacity;
    opacity: 0;
  }
  .stage-peak-line {
    /* Also absolute — sits just above where the CTA heading lives so
       the single-line payoff reads in the same spot the eye is about
       to settle, without reserving its own row in flow. */
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-ui);
    font-size: clamp(1.1rem, 2.4vw, 1.55rem);
    font-weight: 600;
    color: #00FFD1;
    margin: 0;
    white-space: nowrap;
    letter-spacing: 0.2px;
    opacity: 0;
    text-shadow: 0 0 24px rgba(0, 255, 209, 0.4);
    pointer-events: none;
  }

  .stage-action-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    max-width: 520px;
    width: 100%;
    opacity: 0;
    will-change: transform, opacity;
  }
  .stage-action-copy {
    font-family: var(--font-ui);
    font-size: 1.05rem;
    color: rgba(255, 255, 255, 0.75);
  }
  .stage-action-ide {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: rgba(12, 12, 18, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    box-shadow: 0 16px 56px rgba(0, 0, 0, 0.5);
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .stage-action-ide:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 255, 209, 0.45);
    box-shadow: 0 20px 60px rgba(0, 255, 209, 0.22);
  }
  .stage-action-ide-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: #111120;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .stage-action-ide-title {
    margin-left: 8px;
    font-family: var(--font-code);
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
  }
  .stage-action-ide-body {
    padding: 32px 20px;
    font-family: var(--font-code);
    font-size: 0.92rem;
    color: rgba(255, 255, 255, 0.35);
    text-align: left;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 80px;
  }
  .stage-action-ide-caret { color: #00FFD1; font-weight: 700; }
  .stage-action-ide-launch {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: #00FFD1;
    color: #051715;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.1px;
  }

  /* ════════════════════════════════════════════════════════════════════
     RESPONSIVE — Stages collapse to single column on ≤960px so the
     pinned content remains readable without horizontal scroll. Below
     640px the stages unpin entirely (via the reduced-motion rule,
     inherited by the mobile fallback, and the width-of-board queries).
     ════════════════════════════════════════════════════════════════════ */
  @media (max-width: 960px) {
    .sr-body { grid-template-columns: 1fr; }
    .sr-code-shell { position: static; }
    .ep-board { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, auto); min-height: 520px; }
    .ep-lane-stack  { grid-column: 1 / 2; grid-row: 1 / 2; }
    .ep-lane-webapi { grid-column: 2 / 3; grid-row: 1 / 2; }
    .ep-loop-wrap   { grid-column: 1 / 3; grid-row: 2 / 3; min-height: 140px; }
    .ep-lane-micro  { grid-column: 1 / 2; grid-row: 3 / 4; }
    .ep-lane-macro  { grid-column: 2 / 3; grid-row: 3 / 4; }
  }
  @media (max-width: 768px) {
    /* Collapse the 120px + 32px stacked gap between stages into a ~48px
       inter-stage beat. Mobile viewports don't have the vertical real
       estate for the desktop breathing room. */
    .stage-wrap { margin-top: 48px; padding: 0 16px; }
    .stage { min-height: auto; padding: 8px 0; gap: 16px; }
    .stage-title { font-size: clamp(1.35rem, 5.5vw, 1.8rem); }
    .stage-sub { font-size: 0.88rem; }

    /* Clear the ~70px iOS URL bar when headings are scrolled into view. */
    .stage-head { scroll-margin-top: 80px; }

    /* Because scrollytelling is disabled on mobile (see Home.svelte JS —
       GSAP skipped when innerWidth ≤ 768), we force every stage into
       its final, legible frame here. This mirrors the prefers-reduced-
       motion fallback below. Without this block the dashboard stays
       blurred at opacity 0.2 and tokens/tooltip stay hidden. */
    .sr-dashboard { filter: none !important; opacity: 1 !important; transform: none !important; padding: 16px; min-height: 280px; }
    .sr-dash-row  { grid-template-columns: 1fr; }
    .sr-zone      { min-height: 120px; }
    .sr-line      { opacity: 1 !important; }
    /* The "log" token follows a MotionPath authored for the desktop
       split-pane; on mobile it lands on top of the TASK QUEUE label.
       Hide it — the highlighted lines + stack-frame chip tell the story. */
    .sr-token     { display: none !important; }

    /* Hero snippet — cap width, let it scroll rather than hard-clip. */
    .hero-snippet {
      font-size: 0.66rem;
      line-height: 1.65;
      padding: 12px 14px;
      max-width: 100%;
      overflow-x: auto;
    }

    /* Code blocks inside the Stage 2 & 3 window-chromes must scroll
       horizontally rather than being hard-clipped by the shell. The
       shell itself has overflow:hidden for its rounded corners, so we
       ensure the inner <pre> is the scroll container with min-width:0
       so flex/grid parents don't force it wider than the viewport. */
    .sr-code-shell { max-width: 100%; }
    .sr-code       {
      max-width: 100%;
      min-width: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      font-size: 0.78rem;
      padding: 16px 14px;
    }

    /* Stage 3 — Epiphany tooltip. GSAP is off on mobile so the tooltip
       otherwise stays at opacity 0. Take it out of absolute positioning,
       span it across the grid, and place it as a normal flow child
       AFTER the Microtask/Macrotask row so it never covers the diagram. */
    .ep-tooltip {
      position: static !important;
      transform: none !important;
      top: auto;
      left: auto;
      grid-column: 1 / -1;
      grid-row: auto;
      max-width: 100%;
      margin-top: 4px;
      font-size: 0.78rem;
      opacity: 1 !important;
    }
    .ep-tooltip-arrow { display: none; }

    /* Motion-path tokens in Stage 3 — same rationale as sr-token. */
    .ep-token-macro, .ep-token-micro { display: none !important; }

    /* Drop the 520px min-height imposed at ≤960px — it creates a tall
       empty middle band. Let the grid size to content; the event-loop
       ring itself already has a fixed 120×120 intrinsic size. */
    .ep-board     { min-height: auto; padding: 16px; gap: 12px; }
    .ep-loop-wrap { min-height: 96px; }
    .ep-loop      { animation: none; }

    /* Stage 4 — force peak/CTA visible since GSAP isn't running. */
    .stage-peak-pulse { display: none; }
    .stage-peak-line  { opacity: 1 !important; }
    .stage-action-cta { opacity: 1 !important; transform: none !important; }

    .stage-action-ide-body { font-size: 0.82rem; padding: 22px 16px; }
  }

  /* ════════════════════════════════════════════════════════════════════
     PREFERS-REDUCED-MOTION FALLBACK
     When the OS asks for reduced motion we never register ScrollTrigger.
     That leaves the dashboard stuck in its initial blurred state, the
     tokens hidden, and the peak invisible — which looks broken. This
     block flips every stage into its final, readable frame statically.
     ════════════════════════════════════════════════════════════════════ */
  @media (prefers-reduced-motion: reduce) {
    .hero-glow { display: none; }

    /* Stage 2 */
    .sr-dashboard { filter: none; opacity: 1; }
    .sr-token { display: none; }
    .sr-line { opacity: 1 !important; }

    /* Stage 3 */
    .ep-loop { animation: none; }
    .ep-token-macro, .ep-token-micro { display: none; }
    .ep-tooltip { opacity: 1; transform: translate(-50%, 72px); }

    /* Stage 4 */
    .stage-peak-pulse { display: none; }
    .stage-peak-line  { opacity: 1; }
    .stage-action-cta { opacity: 1; }
  }

  /* ─── @property: animatable border rotation ──────────────────────────────── */
  @property --border-angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }

  /* ─── Page ───────────────────────────────────────────────────────────────── */
  .home {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 56px 28px 48px;
    gap: 32px;
    overflow-y: auto;
    position: relative;

    /* Geist for all homepage UI text */
    font-family: var(--font-ui);

    /* Near-black with a blue-violet tint — not pure black */
    background-color: #0c0c11;

    /* Atmospheric mesh: stronger orbs for real depth */
    background-image:
      radial-gradient(ellipse 80% 60% at 15%  5%,  rgba(99,102,241,0.20) 0%, transparent 60%),
      radial-gradient(ellipse 65% 50% at 85% 10%,  rgba(139,92,246,0.16) 0%, transparent 55%),
      radial-gradient(ellipse 60% 55% at 50% 100%, rgba(56,189,248,0.12) 0%, transparent 55%);
  }

  /* Noise texture overlay — adds tactile depth (3.5% opacity, barely perceptible) */
  .home::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 182px;
  }

  /* Keep all direct children above the noise layer */
  .home > * { position: relative; z-index: 1; }

  /* ─── Hero ───────────────────────────────────────────────────────────────── */
  .hero {
    width: 100%;
    max-width: 1040px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  /* ── Centered copy ── */
  .hero-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
    animation: hero-fade-in 0.8s ease both;
  }

  @keyframes hero-fade-in {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hero-title {
    /* Space Grotesk is reserved exclusively for this one headline. */
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 5.2vw, 3.6rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    margin: 0;
    line-height: 1.08;
    color: rgba(255,255,255,0.94);
  }

  .hero-title-line {
    display: block;
  }

  .hero-title-accent {
    color: #ffffff;
  }

  .accent {
    background: linear-gradient(135deg, #00FFD1 0%, #22d3ee 55%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-family: var(--font-ui);
    font-size: 1.05rem;
    color: rgba(255,255,255,0.50);
    margin: 18px 0 0 0;
    font-weight: 400;
    line-height: 1.6;
    max-width: 560px;
  }

  .hero-ctas {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 32px;
    flex-wrap: wrap;
  }

  .cta-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, var(--accent), var(--accent));
    color: #051715;
    font-family: var(--font-ui);
    font-size: 0.92rem;
    font-weight: 700;
    padding: 11px 24px;
    border-radius: 8px;
    text-decoration: none;
    letter-spacing: -0.1px;
    transition: filter 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 24px var(--accent-glow), 0 4px 14px rgba(0,0,0,0.45);
  }

  .cta-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .cta-ghost {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-ui);
    font-size: 0.88rem;
    font-weight: 500;
    color: rgba(255,255,255,0.58);
    text-decoration: none;
    padding: 11px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    transition: all 0.2s ease;
    background: rgba(255,255,255,0.03);
    cursor: pointer;
  }

  .cta-ghost:hover {
    color: rgba(255,255,255,0.88);
    border-color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.06);
  }

  .hero-hint {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.28);
    margin: 14px 0 0 0;
    letter-spacing: 0.1px;
  }


  /* ── Demo shell: full-width product preview ── */
  .demo-shell {
    width: 100%;
    max-width: 860px;
    margin-top: 40px;
    background: var(--a11y-surface3, #0c0c18);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04),
      0 24px 64px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.06);
    animation: demo-rise 0.9s ease 0.15s both;
  }

  @keyframes demo-rise {
    from { opacity: 0; transform: translateY(28px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Feature highlights strip ── */
  .hero-highlights {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    width: 100%;
    max-width: 860px;
    margin-top: 36px;
    animation: hero-fade-in 0.8s ease 0.4s both;
  }

  .highlight {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.2s, background 0.2s;
  }

  .highlight:hover {
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
  }

  .hl-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 9px;
    color: var(--fc);
    background: color-mix(in srgb, var(--fc) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--fc) 18%, transparent);
  }

  .hl-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .hl-text strong {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    font-weight: 700;
    color: rgba(255,255,255,0.88);
  }

  .hl-text span {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.40);
    line-height: 1.5;
  }

  .demo-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: #111120;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .demo-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    opacity: 0.85;
  }

  .demo-title {
    font-family: var(--font-code);
    font-size: 0.68rem;
    color: rgba(255,255,255,0.35);
    margin-left: 8px;
  }

  .demo-concept-tag {
    font-family: var(--font-code);
    font-size: 0.6rem;
    color: rgba(74,222,128,0.7);
    background: rgba(74,222,128,0.08);
    border: 1px solid rgba(74,222,128,0.18);
    border-radius: 4px;
    padding: 1px 7px;
    margin-left: 6px;
    flex: 1;
    width: fit-content;
  }

  .demo-badge {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: #4ade80;
    letter-spacing: 0.5px;
    animation: badge-pulse 1.4s ease-in-out infinite;
  }

  .demo-body {
    display: flex;
    min-height: 200px;
  }

  /* Code side */
  .demo-code {
    flex: 1;
    padding: 14px 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    min-width: 0;
  }

  .demo-line {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 3px 14px 3px 0;
    min-height: 28px;
    transition: background 0.3s ease;
    border-left: 2px solid transparent;
  }

  .demo-line-active {
    background: rgba(74,222,128,0.07);
    border-left-color: #4ade80;
  }

  .demo-ln {
    width: 32px;
    text-align: right;
    font-family: var(--font-code);
    font-size: 0.65rem;
    color: rgba(255,255,255,0.18);
    padding-right: 8px;
    flex-shrink: 0;
    user-select: none;
  }

  .demo-arrow {
    width: 16px;
    font-size: 0.6rem;
    color: #4ade80;
    flex-shrink: 0;
    transition: opacity 0.2s;
  }

  .demo-tokens {
    font-family: var(--font-code);
    font-size: 0.78rem;
    white-space: pre;
    line-height: 1.5;
  }

  /* Token colours */
  .tok-kw  { color: #c084fc; }
  .tok-id  { color: #e2e8f0; }
  .tok-str { color: #4ade80; }
  .tok-num { color: #38bdf8; }
  .tok-op  { color: rgba(255,255,255,0.35); }
  .tok-fn  { color: #fbbf24; }

  /* ── Viz panel (right side) ── */
  .demo-viz {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #0a0a15;
    overflow: hidden;
  }

  /* CPU dashboard row */
  .demo-cpu {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #09090f;
  }

  .demo-gauge { flex-shrink: 0; }

  .demo-chip {
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.3s;
  }
  .demo-chip-active { opacity: 1; }

  .demo-registers {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .demo-reg {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .demo-reg-label {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    min-width: 36px;
    flex-shrink: 0;
  }

  .demo-reg-val {
    font-family: var(--font-code);
    font-size: 0.65rem;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
  }

  .demo-reg-op { color: #38bdf8; }
  .op-done { color: #4ade80; }

  /* Call stack row */
  .demo-stack-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: #08080e;
  }

  .demo-stack-label {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 1px;
  }

  .demo-stack-frame {
    font-family: var(--font-code);
    font-size: 0.62rem;
    font-weight: 700;
    color: rgba(255,255,255,0.72);
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 3px;
    padding: 1px 6px;
    transition: all 0.3s;
  }

  .frame-call {
    color: #fbbf24;
    background: rgba(251,191,36,0.10);
    border-color: rgba(251,191,36,0.25);
  }

  /* Heap memory */
  .demo-heap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .demo-heap-hdr {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 1.5px;
    padding: 6px 10px 4px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .demo-heap-vars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 8px;
    overflow: hidden;
  }

  .demo-heap-empty {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: rgba(255,255,255,0.15);
    font-style: italic;
    padding: 4px 2px;
  }

  .demo-heap-var {
    background: color-mix(in srgb, var(--vc) 8%, var(--a11y-surface3, #0c0c18));
    border: 1px solid color-mix(in srgb, var(--vc) 22%, rgba(255,255,255,0.05));
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    animation: var-appear 0.25s ease;
  }

  @keyframes var-appear {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .demo-heap-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .demo-heap-name {
    font-family: var(--font-code);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.88);
    font-weight: 700;
  }

  .demo-heap-type {
    font-family: var(--font-code);
    font-size: 0.42rem;
    color: rgba(255,255,255,0.30);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .demo-heap-val {
    font-family: var(--font-code);
    font-size: 0.88rem;
    font-weight: 800;
  }

  .demo-heap-bytes {
    display: flex;
    gap: 1.5px;
    margin-top: 2px;
  }

  .demo-byte {
    width: 7px;
    height: 7px;
    border-radius: 1.5px;
    opacity: 0.5;
  }

  .demo-stdout {
    border-top: 1px solid rgba(74,222,128,0.15);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(74,222,128,0.06);
  }

  .demo-stdout-label {
    font-family: var(--font-code);
    font-size: 0.42rem;
    color: rgba(74,222,128,0.6);
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .demo-stdout-val {
    font-family: var(--font-code);
    font-size: 0.68rem;
    color: #4ade80;
    font-weight: 700;
    animation: var-appear 0.25s ease;
  }

  /* Memory map */
  .demo-memmap {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 8px 10px;
    background: rgba(255,255,255,0.015);
    animation: var-appear 0.25s ease;
  }

  .demo-memmap-hdr {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .demo-memmap-icon {
    font-size: 0.55rem;
    color: rgba(56,189,248,0.5);
  }

  .demo-memmap-title {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255,255,255,0.30);
    letter-spacing: 1.5px;
    flex: 1;
  }

  .demo-memmap-usage {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(56,189,248,0.60);
    letter-spacing: 0.5px;
  }

  .demo-memmap-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .demo-memmap-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  .demo-memmap-name {
    font-family: var(--font-code);
    font-size: 0.58rem;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
    min-width: 38px;
  }

  .demo-memmap-type {
    font-family: var(--font-code);
    font-size: 0.40rem;
    color: rgba(255,255,255,0.22);
    min-width: 32px;
  }

  .demo-memmap-bar {
    display: flex;
    gap: 1.5px;
    flex: 1;
  }

  .demo-memmap-byte {
    width: 8px;
    height: 8px;
    border-radius: 1.5px;
    opacity: 0.50;
  }

  .demo-memmap-size {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    min-width: 20px;
    text-align: right;
  }

  /* Status row */
  .demo-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid rgba(74,222,128,0.15);
    background: rgba(74,222,128,0.05);
    animation: var-appear 0.3s ease;
  }

  .demo-status-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: rgba(74,222,128,0.18);
    color: #4ade80;
    font-size: 0.6rem;
    font-weight: 800;
  }

  .demo-status-label {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    font-weight: 700;
    color: #4ade80;
  }

  .demo-status-stats {
    font-family: var(--font-code);
    font-size: 0.52rem;
    color: rgba(255,255,255,0.35);
    margin-left: auto;
  }

  /* Explanation strip */
  .demo-explain {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(74,222,128,0.04);
    min-height: 48px;
  }

  .demo-explain-icon {
    font-size: 0.7rem;
    color: #4ade80;
    opacity: 0.7;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .demo-explain-text {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.62);
    line-height: 1.55;
    transition: opacity 0.3s ease;
  }

  /* Progress bar + step counter */
  .demo-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .demo-progress-track {
    flex: 1;
    height: 3px;
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .demo-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .demo-step-counter {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: rgba(255,255,255,0.28);
    white-space: nowrap;
    letter-spacing: 0.3px;
  }

  /* ── Section divider ── */
  .section-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: 920px;
  }

  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.07);
  }

  .divider-label {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ─── Grid ───────────────────────────────────────────────────────────────── */
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    width: 100%;
    max-width: 920px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .module-card-wrap {
    display: contents;
  }

  /* ─── Card (frosted glass) ─────────────────────────────────────────────── */
  .module-card {
    position: relative;
    border-radius: 14px;
    padding: 0;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    overflow: hidden;
    isolation: isolate;

    /* Glass treatment: frosted translucent pane over the noise-textured
       void. Accent tint of the module leaks through faintly from the
       SVG illustration rather than the card background itself. */
    background: var(--glass-bg);
    border: var(--glass-border);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);

    box-shadow:
      inset 0  1px 0 rgba(255,255,255,0.05),
      0 2px 12px rgba(0,0,0,0.45),
      0 12px 40px rgba(0,0,0,0.35);

    transition:
      transform      0.25s cubic-bezier(0.075, 0.82, 0.165, 1),
      border-color   0.25s ease,
      box-shadow     0.25s ease,
      background     0.25s ease;
  }

  /* ── Noise texture on each card (subtle tactile feel) */
  .module-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E");
    background-size: 182px;
  }

  /* ── Mouse-tracked spotlight inside each card */
  .module-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.3s ease;
    background: radial-gradient(
      380px circle at var(--mouse-x, -999px) var(--mouse-y, -999px),
      color-mix(in srgb, var(--c) 10%, transparent),
      transparent 75%
    );
  }

  /* All card children sit above the pseudo-elements */
  .module-card > * { position: relative; z-index: 2; }

  /* ── Hover: lift + soften the glass and let the accent glow through */
  .module-card:hover {
    transform: translateY(-3px);
    background: rgba(255, 255, 255, 0.045);
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow:
      inset 0  1px 0 rgba(255,255,255,0.10),
      0 0 0 1px var(--accent-soft),
      0 18px 44px rgba(0, 0, 0, 0.55),
      0 0 24px var(--accent-soft);
  }

  /* Activate spotlight on hover */
  .module-card:hover::after { opacity: 1; }

  /* SVG glow on hover */
  .module-card:hover .hero-svg {
    opacity: 1;
    transform: scale(1.07);
    filter:
      drop-shadow(0 0 6px color-mix(in srgb, var(--c) 60%, transparent))
      drop-shadow(0 0 16px color-mix(in srgb, var(--c) 30%, transparent));
  }

  /* ─── Border Beam ─────────────────────────────────────────────────────────
     A single streak of #00FFD1 travels once around the card perimeter on
     hover. Implemented as a conic-gradient layered under the glass pane,
     masked so only the 1px border ring is visible. @property animates the
     rotation angle on the compositor (GPU-cheap). ─────────────────────── */
  @supports (background: conic-gradient(from 0deg, red, blue)) {
    .module-card::before {
      /* Repurpose the existing ::before (previously noise) as the beam. */
      background-image: conic-gradient(
        from var(--border-angle),
        transparent 0deg,
        transparent 280deg,
        rgba(0, 255, 209, 0.15) 310deg,
        #00FFD1 340deg,
        rgba(0, 255, 209, 0.15) 350deg,
        transparent 360deg
      );
      background-size: auto;
      opacity: 0;
      /* Mask the gradient so only a 1px ring at the card edge shows. */
      padding: 1px;
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
              mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
              mask-composite: exclude;
      transition: opacity 0.15s ease;
    }

    .module-card:hover::before {
      opacity: 1;
      animation: border-beam 800ms cubic-bezier(.55,.05,.25,1) both;
    }

    @keyframes border-beam {
      0%   { --border-angle:   0deg; }
      100% { --border-angle: 360deg; }
    }
  }

  /* ─── Scroll-driven card reveal (Chrome 115+, progressive) ──────────────── */
  @supports (animation-timeline: view()) {
    .module-card {
      animation: card-rise linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 25%;
    }

    @keyframes card-rise {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Stagger */
    .module-card-wrap:nth-child(1) .module-card { animation-delay:   0ms; }
    .module-card-wrap:nth-child(2) .module-card { animation-delay:  60ms; }
    .module-card-wrap:nth-child(3) .module-card { animation-delay: 120ms; }
    .module-card-wrap:nth-child(4) .module-card { animation-delay:  80ms; }
    .module-card-wrap:nth-child(5) .module-card { animation-delay: 140ms; }
    .module-card-wrap:nth-child(6) .module-card { animation-delay: 200ms; }
    .module-card-wrap:nth-child(7) .module-card { animation-delay: 160ms; }
    .module-card-wrap:nth-child(8) .module-card { animation-delay: 220ms; }
    .module-card-wrap:nth-child(9) .module-card { animation-delay: 280ms; }
  }

  /* ─── Hero illustration ──────────────────────────────────────────────────── */
  .card-hero {
    padding: 26px 20px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 96px;
  }

  .hero-svg {
    width: 100%;
    max-width: 180px;
    height: auto;
    display: block;
    opacity: 0.92;
    transition:
      opacity 0.3s ease,
      transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1),
      filter 0.3s ease;
  }

  /* ─── Text ───────────────────────────────────────────────────────────────── */
  .card-text {
    padding: 8px 20px 22px;
  }

  .card-text h3 {
    /* Monospace — module names are code identifiers */
    font-family: var(--font-code);
    font-size: 1.08rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.4px;
    line-height: 1.2;
  }

  .card-sub {
    font-family: var(--font-ui);
    display: block;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 1.8px;
    margin: 6px 0 10px;
    font-weight: 700;
    /* Full opacity — accent colour carries the contrast */
    opacity: 1;
  }

  .card-text p {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    color: rgba(255,255,255,0.65);
    line-height: 1.6;
    margin: 0;
    font-weight: 400;
  }


  /* ─── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .home {
      padding: 24px 14px;
      gap: 24px;
      justify-content: flex-start;
      height: auto;
      min-height: 100vh;
    }

    .hero-title { font-size: clamp(1.8rem, 4.5vw, 2.6rem); }
    .hero-highlights { grid-template-columns: 1fr; gap: 12px; }

    .modules-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .card-hero { padding: 18px 14px 8px; min-height: 70px; }
    .card-text { padding: 4px 14px 16px; }
    .card-text h3 { font-size: 0.9rem; }
    .card-text p { font-size: 0.72rem; }
  }

  /* ─── Mobile ≤768px ──────────────────────────────────────────────────────
     Standardises the hero for phone-sized viewports (tested at 390px,
     iPhone 15 width). Subheadline stays within three lines, CTAs stack
     as equal-width full-width buttons, feature highlights use a uniform
     16px internal padding so they never feel oversized next to the
     surrounding 12–14px page gutter. */
  @media (max-width: 768px) {
    .hero-sub {
      max-width: 100%;
      font-size: 0.95rem;
      /* Keep the line balance visually calm — a subtle wrap budget that
         works out to three lines at 390px while the browser still does
         the heavy lifting for smaller or larger mobile widths. */
      text-wrap: balance;
    }

    .hero-ctas {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      flex-wrap: nowrap;
    }
    .cta-primary,
    .cta-ghost {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    /* Feature highlights — 16px internal padding across every mobile size. */
    .highlight { padding: 16px; }
  }

  @media (max-width: 520px) {
    .home { padding: 16px 12px; gap: 16px; }

    .hero-title { font-size: clamp(1.5rem, 6vw, 2rem); }
    .hero-sub { font-size: 0.88rem; }
    .cta-primary, .cta-ghost { font-size: 0.82rem; padding: 10px 18px; }
    .hero-highlights { grid-template-columns: 1fr; gap: 10px; margin-top: 24px; }
    .hl-icon { width: 32px; height: 32px; }
    .demo-shell { margin-top: 28px; }
    .demo-body { flex-direction: column; }

    .modules-grid {
      grid-template-columns: 1fr;
      gap: 10px;
      max-width: 420px;
    }

    .module-card { flex-direction: row; align-items: center; }
    .card-hero { padding: 16px; min-height: auto; width: 88px; flex-shrink: 0; }
    .hero-svg { max-width: 68px; }
    .card-text { padding: 14px 16px 14px 0; }
    .card-text h3 { font-size: 0.92rem; }
    .card-sub { margin: 3px 0 6px; font-size: 0.56rem; }
    .card-text p { font-size: 0.72rem; }
  }

  @media (max-width: 360px) {
    .home { padding: 12px 8px; gap: 12px; }
    .hero-title { font-size: clamp(1.3rem, 5.5vw, 1.7rem); }
    .hero-sub { font-size: 0.82rem; }
    .cta-primary, .cta-ghost { font-size: 0.78rem; padding: 9px 14px; }
    .card-hero { width: 72px; padding: 12px; }
    .hero-svg { max-width: 52px; }
    .card-text { padding: 10px 12px 10px 0; }
    .card-text h3 { font-size: 0.82rem; }
    .card-text p { font-size: 0.65rem; }
  }

  /* ─── Free-form mode card ─────────────────────────────────────────────── */
  .freeform-card {
    display: flex;
    align-items: center;
    gap: 20px;
    width: 100%;
    max-width: 720px;
    padding: 20px 28px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(0,255,209,0.06) 0%, rgba(0,255,209,0.02) 100%);
    border: 1.5px solid rgba(0,255,209,0.25);
    text-decoration: none;
    transition: all 0.25s ease;
    cursor: pointer;
  }

  .freeform-card:hover {
    border-color: rgba(0,255,209,0.5);
    background: linear-gradient(135deg, rgba(0,255,209,0.10) 0%, rgba(0,255,209,0.04) 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,255,209,0.08);
  }

  .freeform-icon {
    flex-shrink: 0;
  }

  .freeform-text {
    flex: 1;
    min-width: 0;
  }

  .freeform-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #00FFD1;
    margin: 0 0 6px;
    font-family: var(--font-code);
  }

  .freeform-desc {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.55);
    line-height: 1.5;
    margin: 0;
  }

  .freeform-arrow {
    font-size: 1.4rem;
    color: rgba(0,255,209,0.4);
    flex-shrink: 0;
    transition: color 0.2s, transform 0.2s;
  }

  .freeform-card:hover .freeform-arrow {
    color: #00FFD1;
    transform: translateX(4px);
  }

  @media (max-width: 600px) {
    .freeform-card { padding: 16px 18px; gap: 14px; }
    .freeform-title { font-size: 0.95rem; }
    .freeform-desc { font-size: 0.72rem; }
    .freeform-icon svg { width: 36px; height: 36px; }
  }

  @media (max-width: 360px) {
    .freeform-card { padding: 12px 14px; gap: 10px; }
    .freeform-icon svg { width: 28px; height: 28px; }
  }
</style>
