<script>
  import { onMount, onDestroy } from 'svelte';

  // ── Demo simulation ───────────────────────────────────────────────────────
  const DEMO_LINES = [
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'name' }, { k: 'op', v: ' = ' }, { k: 'str', v: '"Alex"' }, { k: 'op', v: ';' }],
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'age' },  { k: 'op', v: ' = ' }, { k: 'num', v: '25' },     { k: 'op', v: ';' }],
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'adult' },{ k: 'op', v: ' = ' }, { k: 'id', v: 'age' }, { k: 'op', v: ' >= ' }, { k: 'num', v: '18' }, { k: 'op', v: ';' }],
    [{ k: 'fn', v: 'console' }, { k: 'op', v: '.' }, { k: 'fn', v: 'log' }, { k: 'op', v: '(' }, { k: 'str', v: '"Hello, "' }, { k: 'op', v: ' + ' }, { k: 'id', v: 'name' }, { k: 'op', v: ');' }],
  ];

  const DEMO_STEPS = [
    { line: 0, pc: 'LINE 1', op: 'START',   stack: 'Global',  writes: 0, vars: [],                                                                                                                                                           out: null,            explain: 'Program starts. JS engine sets up the Global call stack frame — ready to execute.' },
    { line: 0, pc: 'LINE 1', op: 'DECLARE', stack: 'Global',  writes: 1, vars: [{ n: 'name',  v: '"Alex"', c: '#4ade80', t: 'string',  bytes: 5  }],                                                                                        out: null,            explain: 'LET: name declared. JS allocates a heap slot, writes "Alex" (5 bytes). 1 memory write.' },
    { line: 1, pc: 'LINE 2', op: 'DECLARE', stack: 'Global',  writes: 2, vars: [{ n: 'name',  v: '"Alex"', c: '#4ade80', t: 'string',  bytes: 5  }, { n: 'age', v: '25', c: '#38bdf8', t: 'number', bytes: 8 }],                           out: null,            explain: 'LET: age declared. Numbers always take 8 bytes (64-bit float). 2 total writes.' },
    { line: 2, pc: 'LINE 3', op: 'COMPARE', stack: 'Global',  writes: 3, vars: [{ n: 'name',  v: '"Alex"', c: '#4ade80', t: 'string',  bytes: 5  }, { n: 'age', v: '25', c: '#38bdf8', t: 'number', bytes: 8 }, { n: 'adult', v: '…', c: '#fbbf24', t: 'boolean', bytes: 0 }], out: null, explain: 'age >= 18 evaluated. JS compares 25 to 18 — result is a boolean, about to be stored.' },
    { line: 2, pc: 'LINE 3', op: 'DECLARE', stack: 'Global',  writes: 3, vars: [{ n: 'name',  v: '"Alex"', c: '#4ade80', t: 'string',  bytes: 5  }, { n: 'age', v: '25', c: '#38bdf8', t: 'number', bytes: 8 }, { n: 'adult', v: 'true', c: '#fbbf24', t: 'boolean', bytes: 1 }], out: null, explain: 'adult = true written to heap. Booleans take just 1 byte. 3 total memory writes.' },
    { line: 3, pc: 'LINE 4', op: 'CALL',    stack: 'console.log', writes: 3, vars: [{ n: 'name', v: '"Alex"', c: '#4ade80', t: 'string', bytes: 5 }, { n: 'age', v: '25', c: '#38bdf8', t: 'number', bytes: 8 }, { n: 'adult', v: 'true', c: '#fbbf24', t: 'boolean', bytes: 1 }], out: null, explain: 'console.log() called — a new frame is pushed onto the call stack above Global.' },
    { line: 3, pc: 'END',    op: 'DONE',    stack: 'Global',  writes: 3, vars: [{ n: 'name',  v: '"Alex"', c: '#4ade80', t: 'string',  bytes: 5  }, { n: 'age', v: '25', c: '#38bdf8', t: 'number', bytes: 8 }, { n: 'adult', v: 'true', c: '#fbbf24', t: 'boolean', bytes: 1 }], out: '"Hello, Alex"', explain: 'Output: "Hello, Alex". Call stack pops back to Global. Program complete — 3 writes, 1 call.' },
  ];

  let demoStep = $state(0);
  let demoTimer;

  const currentStep = $derived(DEMO_STEPS[demoStep]);

  onMount(() => {
    const cards = document.querySelectorAll('.module-card');

    const onMove = (e) => {
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    // Auto-advance demo — pause at end before looping
    demoTimer = setInterval(() => {
      demoStep = (demoStep + 1) % DEMO_STEPS.length;
    }, 1600);

    return () => {
      window.removeEventListener('mousemove', onMove);
      clearInterval(demoTimer);
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
      color: '#2dd4bf',
    }
  ];
</script>

<div class="home" role="main" aria-label="VisualJS home page">

  <!-- ── Hero ── -->
  <section class="hero">

    <!-- Left: copy + CTA -->
    <div class="hero-copy">
      <h1>visual<span class="accent">JS</span></h1>

      <p class="hero-sub">
        Stop reading about JavaScript.<br>Watch it think.
      </p>

      <ul class="hero-features">
        <li><span class="feat-arrow">→</span><span><strong>Line-by-line execution</strong> — step through any concept</span></li>
        <li><span class="feat-arrow">→</span><span><strong>Live memory view</strong> — see variables appear as they're declared</span></li>
        <li><span class="feat-arrow">→</span><span><strong>9 concepts</strong> — variables, loops, closures, async and more</span></li>
      </ul>

      <div class="hero-ctas">
        <a href="#/variables" class="cta-primary">Try it now →</a>
        <a href="#/if-gate"   class="cta-ghost">See conditionals</a>
      </div>

      <p class="hero-hint">No sign-up. Runs in your browser.</p>
    </div>

    <!-- Right: live simulation panel -->
    <div class="demo-shell" aria-hidden="true">

      <!-- macOS window chrome -->
      <div class="demo-bar">
        <span class="demo-dot" style="background:#ff5f57"></span>
        <span class="demo-dot" style="background:#febc2e"></span>
        <span class="demo-dot" style="background:#28c840"></span>
        <span class="demo-title">variables.js</span>
        <span class="demo-concept-tag">Variables &amp; Memory</span>
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
                <text x="26" y="24" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="monospace">{demoStep + 1}</text>
                <text x="26" y="34" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="6.5" font-family="monospace">/{DEMO_STEPS.length}</text>
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
  </section>

  <!-- ── Section divider ── -->
  <div class="section-divider">
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
              <text x="37" y="45" text-anchor="middle" fill={mod.color} font-size="14" font-weight="700" font-family="monospace">x = 5</text>
              <line x1="68" y1="40" x2="98" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <circle cx="103" cy="40" r="2.5" fill={mod.color} opacity="0.9"/>
              <rect x="114" y="24" width="48" height="32" rx="7" fill={mod.color + '18'} stroke={mod.color} stroke-width="1.2" opacity="0.75"/>
              <text x="138" y="44" text-anchor="middle" fill={mod.color} font-size="10" font-family="monospace" font-weight="600">0x4A</text>
            </svg>
          {:else if mod.id === 'if-gate'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <polygon points="100,8 148,40 100,72 52,40" fill={mod.color + '0e'} stroke={mod.color} stroke-width="1.5" opacity="0.85"/>
              <text x="100" y="45" text-anchor="middle" fill={mod.color} font-size="15" font-weight="700" font-family="monospace">?</text>
              <line x1="148" y1="40" x2="180" y2="22" stroke="#4ade80" stroke-width="1.2" opacity="0.7"/>
              <text x="184" y="20" fill="#4ade80" font-size="9" font-family="monospace" font-weight="600">tru</text>
              <line x1="148" y1="40" x2="180" y2="58" stroke="#f87171" stroke-width="1.2" opacity="0.7"/>
              <text x="184" y="62" fill="#f87171" font-size="9" font-family="monospace" font-weight="600">fal</text>
            </svg>
          {:else if mod.id === 'for-loop'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="100" cy="40" r="30" fill="none" stroke={mod.color} stroke-width="1" opacity="0.2"/>
              <circle cx="100" cy="40" r="30" fill="none" stroke={mod.color} stroke-width="1.8" stroke-dasharray="44 144" stroke-dashoffset="-20" opacity="0.9"/>
              <circle cx="129" cy="29" r="4.5" fill={mod.color} opacity="0.95"/>
              <text x="100" y="44" text-anchor="middle" fill={mod.color} font-size="11" font-family="monospace" font-weight="600" opacity="0.75">i++</text>
            </svg>
          {:else if mod.id === 'function'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="26" cy="40" r="9" fill={mod.color + '22'} stroke={mod.color} stroke-width="1.2" opacity="0.8"/>
              <line x1="39" y1="40" x2="65" y2="40" stroke={mod.color} stroke-width="1.2" opacity="0.5" marker-end="url(#arr)"/>
              <rect x="68" y="16" width="64" height="48" rx="9" fill={mod.color + '14'} stroke={mod.color} stroke-width="1.5" opacity="0.8"/>
              <text x="100" y="46" text-anchor="middle" fill={mod.color} font-size="20" font-weight="700" font-family="serif" font-style="italic" opacity="0.9">f</text>
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
              <text x="82" y="33" text-anchor="middle" fill={mod.color} font-size="8.5" font-family="monospace" opacity="0.6">name</text>
              <text x="82" y="52" text-anchor="middle" fill={mod.color} font-size="11" font-family="monospace" font-weight="600" opacity="0.9">"alice"</text>
              <line x1="118" y1="19" x2="118" y2="61" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <text x="148" y="33" text-anchor="middle" fill={mod.color} font-size="8.5" font-family="monospace" opacity="0.6">age</text>
              <text x="148" y="52" text-anchor="middle" fill={mod.color} font-size="11" font-family="monospace" font-weight="600" opacity="0.9">25</text>
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
    font-family: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;

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
    align-items: center;
    gap: 48px;
  }

  /* ── Left: copy ── */
  .hero-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }


  h1 {
    font-family: 'Geist Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: clamp(2.8rem, 5.5vw, 4.2rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    margin: 0;
    line-height: 1.0;
    color: #ffffff;
  }

  .accent {
    background: linear-gradient(135deg, #4ade80 0%, #22d3ee 45%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 1.1rem;
    color: rgba(255,255,255,0.72);
    margin: 18px 0 0 0;
    font-weight: 400;
    line-height: 1.5;
    max-width: 420px;
  }

  .hero-features {
    list-style: none;
    padding: 0;
    margin: 24px 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .hero-features li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.88rem;
    color: rgba(255,255,255,0.52);
    line-height: 1.5;
  }

  .hero-features li strong {
    color: rgba(255,255,255,0.82);
    font-weight: 600;
  }

  .feat-arrow {
    color: #4ade80;
    font-size: 0.82rem;
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.9;
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
    background: linear-gradient(135deg, #4ade80, #22d3ee);
    color: #080810;
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 0.92rem;
    font-weight: 700;
    padding: 11px 24px;
    border-radius: 8px;
    text-decoration: none;
    letter-spacing: -0.1px;
    transition: filter 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 24px rgba(74,222,128,0.25), 0 4px 14px rgba(0,0,0,0.4);
  }

  .cta-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .cta-ghost {
    display: inline-flex;
    align-items: center;
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 0.88rem;
    font-weight: 500;
    color: rgba(255,255,255,0.58);
    text-decoration: none;
    padding: 11px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    transition: all 0.2s ease;
    background: rgba(255,255,255,0.03);
  }

  .cta-ghost:hover {
    color: rgba(255,255,255,0.88);
    border-color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.06);
  }

  .hero-hint {
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.28);
    margin: 14px 0 0 0;
    letter-spacing: 0.1px;
  }

  /* ── Right: demo shell ── */
  .demo-shell {
    flex: 0 0 520px;
    background: #0c0c18;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04),
      0 24px 64px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.06);
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.68rem;
    color: rgba(255,255,255,0.35);
    margin-left: 8px;
  }

  .demo-concept-tag {
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    min-width: 36px;
    flex-shrink: 0;
  }

  .demo-reg-val {
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.45rem;
    color: rgba(255,255,255,0.28);
    letter-spacing: 1px;
  }

  .demo-stack-frame {
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.58rem;
    color: rgba(255,255,255,0.15);
    font-style: italic;
    padding: 4px 2px;
  }

  .demo-heap-var {
    background: color-mix(in srgb, var(--vc) 8%, #0c0c18);
    border: 1px solid color-mix(in srgb, var(--vc) 22%, rgba(255,255,255,0.05));
    border-radius: 5px;
    padding: 5px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.88);
    font-weight: 700;
  }

  .demo-heap-type {
    font-family: 'Geist Mono', monospace;
    font-size: 0.42rem;
    color: rgba(255,255,255,0.30);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .demo-heap-val {
    font-family: 'Geist Mono', monospace;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .demo-heap-bytes {
    display: flex;
    gap: 1.5px;
    margin-top: 2px;
  }

  .demo-byte {
    width: 5px;
    height: 5px;
    border-radius: 1px;
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
    font-family: 'Geist Mono', monospace;
    font-size: 0.42rem;
    color: rgba(74,222,128,0.6);
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .demo-stdout-val {
    font-family: 'Geist Mono', monospace;
    font-size: 0.68rem;
    color: #4ade80;
    font-weight: 700;
    animation: var-appear 0.25s ease;
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
    font-family: 'Geist', system-ui, sans-serif;
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
    background: linear-gradient(90deg, #4ade80, #22d3ee);
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .demo-step-counter {
    font-family: 'Geist Mono', monospace;
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
    font-family: 'Geist', system-ui, sans-serif;
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

  /* ─── Card ───────────────────────────────────────────────────────────────── */
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

    /* Surface: accent-tinted dark */
    background: color-mix(in srgb, var(--c) 6%, #10101a);

    /* Border: clearly visible accent-tinted edge */
    border: 1px solid color-mix(in srgb, var(--c) 28%, rgba(255,255,255,0.08));

    /* Depth: inset top highlight + outer shadow */
    box-shadow:
      inset 0  1px 0 rgba(255,255,255,0.08),
      inset 0 -1px 0 rgba(0,0,0,0.5),
      0 2px 8px rgba(0,0,0,0.4),
      0 8px 24px rgba(0,0,0,0.35);

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

  /* ── Hover ── */
  .module-card:hover {
    transform: translateY(-3px);
    background: color-mix(in srgb, var(--c) 7%, #111118);
    border-color: color-mix(in srgb, var(--c) 40%, rgba(255,255,255,0.08));
    box-shadow:
      inset 0  1px 0 rgba(255,255,255,0.10),
      inset 0 -1px 0 rgba(0,0,0,0.5),
      0 0 0 1px color-mix(in srgb, var(--c) 22%, transparent),
      0 8px 32px color-mix(in srgb, var(--c) 14%, rgba(0,0,0,0.6)),
      0 20px 60px rgba(0,0,0,0.4);
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

  /* ─── Animated rotating border (conic gradient, Chromium only) ────────────
     Paused by default — plays on hover. @property makes it GPU-composited.   */
  @supports (background: conic-gradient(from 0deg, red, blue)) {
    .module-card {
      background-image:
        linear-gradient(color-mix(in srgb, var(--c) 6%, #10101a),
                        color-mix(in srgb, var(--c) 6%, #10101a)),
        conic-gradient(
          from var(--border-angle),
          transparent 0%,
          transparent 55%,
          color-mix(in srgb, var(--c) 90%, white) 68%,
          color-mix(in srgb, var(--c) 70%, transparent) 78%,
          transparent 88%
        );
      background-origin: padding-box, border-box;
      background-clip: padding-box, border-box;
      border-color: transparent;
      /* Permanent outline so card edges are always visible regardless of animation state */
      outline: 1px solid color-mix(in srgb, var(--c) 28%, rgba(255,255,255,0.08));
      outline-offset: -1px;
      animation: border-spin 4s linear infinite paused;
    }

    .module-card:hover {
      animation-play-state: running;
      outline-color: color-mix(in srgb, var(--c) 50%, rgba(255,255,255,0.10));
    }

    @keyframes border-spin {
      to { --border-angle: 360deg; }
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
    font-family: 'Geist Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 1.08rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.4px;
    line-height: 1.2;
  }

  .card-sub {
    font-family: 'Geist', 'Inter', system-ui, sans-serif;
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
    font-family: 'Geist', 'Inter', system-ui, sans-serif;
    font-size: 0.82rem;
    color: rgba(255,255,255,0.65);
    line-height: 1.6;
    margin: 0;
    font-weight: 400;
  }


  /* ─── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 960px) {
    .hero { gap: 32px; }
    .demo-shell { flex: 0 0 400px; }
  }

  @media (max-width: 860px) {
    .home {
      padding: 24px 14px;
      gap: 24px;
      justify-content: flex-start;
      height: auto;
      min-height: 100vh;
    }

    .hero {
      flex-direction: column;
      align-items: stretch;
      gap: 28px;
    }

    .demo-shell { flex: none; width: 100%; }
    .hero-sub { max-width: 100%; }

    .modules-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .card-hero { padding: 18px 14px 8px; min-height: 70px; }
    .card-text { padding: 4px 14px 16px; }
    .card-text h3 { font-size: 0.9rem; }
    .card-text p { font-size: 0.72rem; }
  }

  @media (max-width: 520px) {
    .home { padding: 16px 12px; gap: 16px; }

    h1 { font-size: clamp(2.2rem, 8vw, 3rem); }
    .hero-sub { font-size: 0.92rem; }
    .hero-ctas { gap: 8px; }
    .cta-primary, .cta-ghost { font-size: 0.82rem; padding: 10px 18px; }
    .demo-body { flex-direction: column; }
    .demo-mem { width: 100%; border-right: none; border-top: 1px solid rgba(255,255,255,0.06); flex-direction: row; align-items: stretch; }
    .demo-mem-vars { flex-direction: row; flex-wrap: wrap; gap: 4px; }
    .demo-var { flex: 1; min-width: 80px; }

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
    h1 { font-size: clamp(1.8rem, 8vw, 2.4rem); }
    .hero-sub { font-size: 0.85rem; }
    .cta-primary, .cta-ghost { font-size: 0.78rem; padding: 9px 14px; width: 100%; justify-content: center; }
    .hero-ctas { flex-direction: column; }
    .card-hero { width: 72px; padding: 12px; }
    .hero-svg { max-width: 52px; }
    .card-text { padding: 10px 12px 10px 0; }
    .card-text h3 { font-size: 0.82rem; }
    .card-text p { font-size: 0.65rem; }
  }
</style>
