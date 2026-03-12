<script>
  const modules = [
    {
      id: 'variables',
      title: 'varStore',
      subtitle: 'Variables & Memory',
      description: 'See how the CPU stores values in memory. Watch bytes get allocated, types get tagged, and values get overwritten.',
      color: '#38bdf8',
      icon: 'x=',
      status: 'live'
    },
    {
      id: 'if-gate',
      title: 'ifGate',
      subtitle: 'Conditionals',
      description: 'A circle approaches a gate. If the condition is true, it slides through. If false, it bounces back.',
      color: '#00ff88',
      icon: '◆',
      status: 'live'
    },
    {
      id: 'for-loop',
      title: 'forLoop',
      subtitle: 'Iteration',
      description: 'A circle orbits a track. Each lap is one iteration. Watch the counter climb as the loop executes.',
      color: '#ffcc66',
      icon: '↻',
      status: 'live'
    },
    {
      id: 'function',
      title: 'fnCall',
      subtitle: 'Functions',
      description: 'A value drops into a function box. Watch the transformation happen inside, then see the output emerge.',
      color: '#ff8866',
      icon: 'ƒ',
      status: 'live'
    },
    {
      id: 'array',
      title: 'arrayFlow',
      subtitle: 'Array Methods',
      description: 'Elements flow through map, filter, and reduce pipelines. See how each method transforms the data.',
      color: '#88aaff',
      icon: '[]',
      status: 'live'
    },
    {
      id: 'objects',
      title: 'objExplorer',
      subtitle: 'Objects & Hash Maps',
      description: 'See how key-value pairs are stored in hash maps. Watch property access, nesting, spread, and destructuring.',
      color: '#c084fc',
      icon: '{}',
      status: 'live'
    },
    {
      id: 'data-structures',
      title: 'dataStruct',
      subtitle: 'Data Structures',
      description: 'Stacks, queues, maps, and sets — see how data is organized for efficient access and modification.',
      color: '#f472b6',
      icon: '⊞',
      status: 'live'
    },
    {
      id: 'async',
      title: 'asyncFlow',
      subtitle: 'Async/Await',
      description: 'Tasks appear on a timeline. See how sequential awaits, Promise.all, and Promise.race differ visually.',
      color: '#cc66ff',
      icon: '⏳',
      status: 'live'
    }
  ];
</script>

<div class="home">
  <header>
    <h1>visual<span class="accent">JS</span></h1>
    <p class="tagline">see how JavaScript thinks</p>
  </header>

  <div class="modules-grid">
    {#each modules as mod}
      {#if mod.status === 'live'}
        <a href="#/{mod.id}" class="module-card" style="--accent: {mod.color}">
          <div class="card-icon" style="color: {mod.color}">{mod.icon}</div>
          <div class="card-body">
            <h3>{mod.title}</h3>
            <span class="card-tag">{mod.subtitle}</span>
            <p>{mod.description}</p>
          </div>
          <div class="card-status live">live</div>
        </a>
      {:else}
        <div class="module-card disabled" style="--accent: {mod.color}">
          <div class="card-icon" style="color: {mod.color}44">{mod.icon}</div>
          <div class="card-body">
            <h3 style="color: #333">{mod.title}</h3>
            <span class="card-tag" style="color: #222">{mod.subtitle}</span>
            <p style="color: #222">{mod.description}</p>
          </div>
          <div class="card-status soon">coming soon</div>
        </div>
      {/if}
    {/each}
  </div>

  <footer>
    <p>Svelte + Acorn + GSAP + D3</p>
  </footer>
</div>

<style>
  .home {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    gap: 40px;
  }

  header {
    text-align: center;
  }

  h1 {
    font-size: 2.4rem;
    font-weight: 800;
    color: #e0e0e0;
    letter-spacing: -1px;
    margin: 0;
  }

  .accent {
    color: #00ff88;
  }

  .tagline {
    font-size: 0.75rem;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 3px;
    margin: 4px 0 0 0;
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    width: 100%;
    max-width: 700px;
  }

  .module-card {
    background: #0d0d14;
    border: 1px solid #1a1a2e;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
    position: relative;
    cursor: pointer;
  }

  .module-card:hover:not(.disabled) {
    border-color: var(--accent, #333);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .module-card.disabled {
    cursor: default;
    opacity: 0.5;
  }

  .card-icon {
    font-size: 1.8rem;
    line-height: 1;
  }

  .card-body h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ccc;
    margin: 0;
  }

  .card-tag {
    font-size: 0.55rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .card-body p {
    font-size: 0.75rem;
    color: #555;
    line-height: 1.5;
    margin: 4px 0 0 0;
  }

  .card-status {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .card-status.live {
    color: #00ff88;
    background: #00ff8811;
    border: 1px solid #00ff8822;
  }

  .card-status.soon {
    color: #333;
    background: #ffffff06;
    border: 1px solid #1a1a2e;
  }

  footer {
    text-align: center;
  }

  footer p {
    font-size: 0.6rem;
    color: #222;
    letter-spacing: 1px;
    margin: 0;
  }

  @media (max-width: 600px) {
    .modules-grid {
      grid-template-columns: 1fr;
    }

    h1 {
      font-size: 1.8rem;
    }
  }
</style>
