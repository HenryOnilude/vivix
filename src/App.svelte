<script>
  import { onMount } from 'svelte';
  import Home from './lib/Home.svelte';
  import Variables from './lib/Variables.svelte';
  import IfGate from './lib/IfGate.svelte';
  import ForLoop from './lib/ForLoop.svelte';
  import FnCall from './lib/FnCall.svelte';
  import ArrayFlow from './lib/ArrayFlow.svelte';
  import ObjExplorer from './lib/ObjExplorer.svelte';
  import DataStructures from './lib/DataStructures.svelte';
  import AsyncAwait from './lib/AsyncAwait.svelte';
  import Closures from './lib/Closures.svelte';
  import Onboarding from './lib/Onboarding.svelte';

  let route = $state(getRoute());
  let theme = $state('dark');

  function getRoute() {
    const hash = window.location.hash.slice(2) || '';
    return hash || 'home';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  onMount(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);

    const handler = () => { route = getRoute(); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  });
</script>

<div class="app">
  <Onboarding />
  <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
    {theme === 'dark' ? '☀️' : '🌙'}
  </button>
  <div transition:fade={{duration: 300}}>
    {#if route === 'home' || route === ''}
      <Home />
    {:else if route === 'variables'}
      <Variables />
    {:else if route === 'if-gate'}
      <IfGate />
    {:else if route === 'for-loop'}
      <ForLoop />
    {:else if route === 'function'}
      <FnCall />
    {:else if route === 'array'}
      <ArrayFlow />
    {:else if route === 'objects'}
      <ObjExplorer />
    {:else if route === 'data-structures'}
      <DataStructures />
    {:else if route === 'async'}
      <AsyncAwait />
    {:else if route === 'closures'}
      <Closures />
    {:else}
      <div class="not-found">
        <p>Module not found</p>
        <a href="#/">← back to modules</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .app {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
  }

  .not-found p {
    color: #555;
    font-size: 0.9rem;
  }

  .not-found a {
    color: #00ff88;
    text-decoration: none;
    font-size: 0.8rem;
  }

  .not-found a:hover {
    text-decoration: underline;
  }
</style>
