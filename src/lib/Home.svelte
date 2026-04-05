<script>
  import { onMount } from 'svelte';

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
    return () => window.removeEventListener('mousemove', onMove);
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
  <header>
    <h1>visual<span class="accent">JS</span></h1>
    <p class="tagline">See how JavaScript thinks.</p>
  </header>

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

  <footer>
    <p>Svelte · Acorn · GSAP · D3</p>
  </footer>
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
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 28px;
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

  /* ─── Header ─────────────────────────────────────────────────────────────── */
  header {
    text-align: center;
    max-width: 560px;
  }

  h1 {
    font-family: 'Geist Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: clamp(2.4rem, 5.5vw, 3.6rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    margin: 0;
    line-height: 1.0;
    color: #ffffff;
  }

  /* "JS" — vivid green-cyan-indigo pop */
  .accent {
    background: linear-gradient(135deg, #4ade80 0%, #22d3ee 45%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-family: 'Geist', 'Inter', system-ui, sans-serif;
    font-size: 1.05rem;
    color: rgba(255,255,255,0.62);
    margin: 14px 0 0 0;
    font-weight: 400;
    letter-spacing: 0.1px;
    line-height: 1.5;
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

  /* ─── Footer ─────────────────────────────────────────────────────────────── */
  footer { text-align: center; }
  footer p {
    font-family: 'Geist', 'Inter', system-ui, sans-serif;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.25);
    letter-spacing: 1.2px;
    margin: 0;
    text-transform: uppercase;
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
</style>
