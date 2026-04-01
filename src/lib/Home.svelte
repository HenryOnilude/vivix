<script>
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
              <rect x="10" y="20" width="50" height="40" rx="8" fill="none" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <text x="35" y="45" text-anchor="middle" fill={mod.color} font-size="14" font-weight="600" font-family="monospace">x = 5</text>
              <line x1="68" y1="40" x2="100" y2="40" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <circle cx="104" cy="40" r="2" fill={mod.color} opacity="0.5"/>
              <rect x="115" y="26" width="44" height="28" rx="6" fill={mod.color + '08'} stroke={mod.color} stroke-width="0.8" opacity="0.35"/>
              <text x="137" y="44" text-anchor="middle" fill={mod.color} font-size="9" font-family="monospace" opacity="0.6">0x4A</text>
            </svg>
          {:else if mod.id === 'if-gate'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <polygon points="100,10 145,40 100,70 55,40" fill="none" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <text x="100" y="44" text-anchor="middle" fill={mod.color} font-size="13" font-weight="600" font-family="monospace">?</text>
              <line x1="145" y1="40" x2="180" y2="22" stroke="#4ade80" stroke-width="0.8" opacity="0.4"/>
              <text x="185" y="20" fill="#4ade80" font-size="8" font-family="monospace" opacity="0.6">true</text>
              <line x1="145" y1="40" x2="180" y2="58" stroke="#f87171" stroke-width="0.8" opacity="0.4"/>
              <text x="185" y="62" fill="#f87171" font-size="8" font-family="monospace" opacity="0.6">false</text>
            </svg>
          {:else if mod.id === 'for-loop'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="100" cy="40" r="28" fill="none" stroke={mod.color} stroke-width="1" opacity="0.25"/>
              <circle cx="100" cy="40" r="28" fill="none" stroke={mod.color} stroke-width="1.2" stroke-dasharray="40 136" stroke-dashoffset="-20" opacity="0.7"/>
              <circle cx="127" cy="30" r="3.5" fill={mod.color} opacity="0.8"/>
              <text x="100" y="44" text-anchor="middle" fill={mod.color} font-size="10" font-family="monospace" opacity="0.5">i++</text>
            </svg>
          {:else if mod.id === 'function'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <circle cx="30" cy="40" r="8" fill={mod.color + '15'} stroke={mod.color} stroke-width="0.8" opacity="0.4"/>
              <line x1="42" y1="40" x2="68" y2="40" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <rect x="72" y="18" width="56" height="44" rx="8" fill="none" stroke={mod.color} stroke-width="1.2" opacity="0.5"/>
              <text x="100" y="44" text-anchor="middle" fill={mod.color} font-size="16" font-weight="600" font-family="serif" font-style="italic" opacity="0.7">f</text>
              <line x1="132" y1="40" x2="158" y2="40" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <circle cx="170" cy="40" r="8" fill={mod.color + '20'} stroke={mod.color} stroke-width="0.8" opacity="0.5"/>
            </svg>
          {:else if mod.id === 'array'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="25" y="24" width="26" height="32" rx="4" fill={mod.color + '10'} stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
              <rect x="58" y="24" width="26" height="32" rx="4" fill={mod.color + '15'} stroke={mod.color} stroke-width="0.8" opacity="0.4"/>
              <rect x="91" y="24" width="26" height="32" rx="4" fill={mod.color + '20'} stroke={mod.color} stroke-width="0.8" opacity="0.5"/>
              <rect x="124" y="24" width="26" height="32" rx="4" fill={mod.color + '25'} stroke={mod.color} stroke-width="0.8" opacity="0.6"/>
              <rect x="157" y="24" width="26" height="32" rx="4" fill={mod.color + '30'} stroke={mod.color} stroke-width="0.8" opacity="0.7"/>
            </svg>
          {:else if mod.id === 'objects'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="40" y="15" width="120" height="50" rx="10" fill="none" stroke={mod.color} stroke-width="1" opacity="0.35"/>
              <text x="70" y="36" fill={mod.color} font-size="8" font-family="monospace" opacity="0.45">name</text>
              <text x="70" y="52" fill={mod.color} font-size="10" font-family="monospace" opacity="0.7">"alice"</text>
              <line x1="115" y1="22" x2="115" y2="58" stroke={mod.color} stroke-width="0.5" opacity="0.2"/>
              <text x="140" y="36" fill={mod.color} font-size="8" font-family="monospace" opacity="0.45">age</text>
              <text x="140" y="52" fill={mod.color} font-size="10" font-family="monospace" opacity="0.7">25</text>
            </svg>
          {:else if mod.id === 'data-structures'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="75" y="6" width="50" height="14" rx="3" fill={mod.color + '12'} stroke={mod.color} stroke-width="0.7" opacity="0.35"/>
              <rect x="75" y="24" width="50" height="14" rx="3" fill={mod.color + '18'} stroke={mod.color} stroke-width="0.7" opacity="0.45"/>
              <rect x="75" y="42" width="50" height="14" rx="3" fill={mod.color + '22'} stroke={mod.color} stroke-width="0.7" opacity="0.55"/>
              <rect x="75" y="60" width="50" height="14" rx="3" fill={mod.color + '2a'} stroke={mod.color} stroke-width="0.7" opacity="0.65"/>
              <text x="100" y="73" text-anchor="middle" fill={mod.color} font-size="5" font-family="monospace" opacity="0.3">stack</text>
            </svg>
          {:else if mod.id === 'async'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <line x1="20" y1="40" x2="180" y2="40" stroke={mod.color} stroke-width="0.6" opacity="0.15"/>
              <circle cx="45" cy="40" r="6" fill={mod.color + '15'} stroke={mod.color} stroke-width="0.8" opacity="0.4"/>
              <circle cx="100" cy="40" r="6" fill={mod.color + '20'} stroke={mod.color} stroke-width="0.8" opacity="0.55"/>
              <circle cx="155" cy="40" r="6" fill={mod.color + '28'} stroke={mod.color} stroke-width="0.8" opacity="0.7"/>
              <path d="M45 40 Q 72 18, 100 40 Q 128 62, 155 40" fill="none" stroke={mod.color} stroke-width="0.8" opacity="0.3"/>
            </svg>
          {:else if mod.id === 'closures'}
            <svg viewBox="0 0 200 80" class="hero-svg">
              <rect x="30" y="10" width="140" height="60" rx="10" fill="none" stroke={mod.color} stroke-width="0.8" opacity="0.2"/>
              <rect x="50" y="22" width="100" height="40" rx="7" fill="none" stroke={mod.color} stroke-width="0.8" opacity="0.35"/>
              <rect x="70" y="32" width="60" height="22" rx="5" fill={mod.color + '0a'} stroke={mod.color} stroke-width="0.8" opacity="0.5"/>
              <circle cx="100" cy="43" r="4" fill={mod.color} opacity="0.4"/>
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
  /* ── Page ────────────────────────────────────────────────────────────────── */
  .home {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px 28px;
    gap: 28px;
    overflow-y: auto;
  }

  /* ── Header — Apple-style: big, bold, minimal ──────────────────────────── */
  header {
    text-align: center;
    max-width: 560px;
  }

  h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #f5f5f7;
    letter-spacing: -1px;
    margin: 0;
    line-height: 1.1;
  }

  .accent {
    background: linear-gradient(135deg, #4ade80, #22d3ee);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: 0.82rem;
    color: #86868b;
    margin: 8px 0 0 0;
    font-weight: 400;
    letter-spacing: -0.1px;
    line-height: 1.4;
  }

  /* ── Grid — 3 columns, generous gap ─────────────────────────────────────── */
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 860px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .module-card-wrap {
    display: contents;
  }

  /* ── Card — clean, minimal, one hero + text ─────────────────────────────── */
  .module-card {
    background: #111118;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    transition: transform 0.35s cubic-bezier(.2,.9,.3,1),
                border-color 0.3s,
                box-shadow 0.35s;
    cursor: pointer;
    overflow: hidden;
  }

  .module-card:hover {
    transform: scale(1.02);
    border-color: rgba(255,255,255,0.1);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  }

  .module-card:hover .hero-svg {
    opacity: 1;
    transform: scale(1.04);
  }

  /* ── Hero illustration — the single focal visual ────────────────────────── */
  .card-hero {
    padding: 18px 16px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60px;
  }

  .hero-svg {
    width: 100%;
    max-width: 160px;
    height: auto;
    display: block;
    opacity: 0.75;
    transition: opacity 0.35s, transform 0.35s cubic-bezier(.2,.9,.3,1);
  }

  /* ── Text — clean hierarchy ─────────────────────────────────────────────── */
  .card-text {
    padding: 2px 16px 14px;
  }

  .card-text h3 {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f5f5f7;
    margin: 0;
    letter-spacing: -0.2px;
    line-height: 1.2;
  }

  .card-sub {
    display: block;
    font-size: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 1.6px;
    margin: 3px 0 6px;
    opacity: 0.7;
    font-weight: 500;
  }

  .card-text p {
    font-size: 0.66rem;
    color: #86868b;
    line-height: 1.4;
    margin: 0;
    font-weight: 400;
  }

  /* ── Footer ─────────────────────────────────────────────────────────────── */
  footer { text-align: center; }
  footer p {
    font-size: 0.65rem;
    color: #333;
    letter-spacing: 0.5px;
    margin: 0;
  }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .home {
      padding: 20px 14px;
      gap: 20px;
      justify-content: flex-start;
      height: auto;
      min-height: 100vh;
    }

    h1 { font-size: 1.7rem; }
    .tagline { font-size: 0.75rem; }

    .modules-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .card-hero { padding: 14px 12px 4px; min-height: 56px; }
    .card-text { padding: 2px 12px 12px; }
    .card-text h3 { font-size: 0.82rem; }
    .card-text p { font-size: 0.62rem; }
  }

  @media (max-width: 520px) {
    .home { padding: 16px 12px; gap: 16px; }
    h1 { font-size: 1.5rem; }
    .tagline { font-size: 0.72rem; }

    .modules-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      max-width: 400px;
    }

    .module-card { flex-direction: row; align-items: center; border-radius: 12px; }
    .card-hero { padding: 16px; min-height: auto; width: 90px; flex-shrink: 0; }
    .hero-svg { max-width: 70px; }
    .card-text { padding: 14px 16px 14px 0; }
    .card-text h3 { font-size: 0.88rem; }
    .card-sub { margin: 2px 0 4px; font-size: 0.5rem; }
    .card-text p { font-size: 0.68rem; }
  }
</style>
