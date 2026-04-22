<script>
  import { onMount } from 'svelte';
  import Home from './lib/Home.svelte';
  import ErrorBoundary from './lib/ErrorBoundary.svelte';
  import { initTheme } from './lib/a11y-theme.js';
  import { initDepthLevel } from './lib/depth-level.js';
  import { parseHashState } from './lib/url-state.js';

  // Initialize accessibility theme + progressive-disclosure depth
  initTheme();
  initDepthLevel();

  // ── Lazy-loaded route map ──────────────────────────────────────────────────
  // Each module is loaded on-demand via dynamic import() to reduce initial bundle.
  const ROUTE_LOADERS = {
    'variables':        () => import('./lib/Variables.svelte'),
    'if-gate':          () => import('./lib/IfGate.svelte'),
    'for-loop':         () => import('./lib/ForLoop.svelte'),
    'function':         () => import('./lib/FnCall.svelte'),
    'array':            () => import('./lib/ArrayFlow.svelte'),
    'objects':          () => import('./lib/ObjExplorer.svelte'),
    'data-structures':  () => import('./lib/DataStructures.svelte'),
    'async':            () => import('./lib/AsyncAwait.svelte'),
    'closures':         () => import('./lib/Closures.svelte'),
    'promise-chain':    () => import('./lib/PromiseChain.svelte'),
    'event-listeners':  () => import('./lib/EventListeners.svelte'),
    'api-calls':        () => import('./lib/ApiCalls.svelte'),
    'free-form':        () => import('./lib/FreeForm.svelte'),
  };

  let route = $state(getRoute());
  let LazyComponent = $state(null);
  let loadError = $state('');
  let loading = $state(false);

  function getRoute() {
    const parsed = parseHashState();
    return parsed.route;
  }

  async function loadRoute(r) {
    if (r === 'home' || r === '') {
      LazyComponent = null;
      loadError = '';
      loading = false;
      return;
    }
    const loader = ROUTE_LOADERS[r];
    if (!loader) {
      LazyComponent = null;
      loadError = 'not-found';
      loading = false;
      return;
    }
    loading = true;
    loadError = '';
    try {
      const mod = await loader();
      LazyComponent = mod.default;
    } catch (err) {
      loadError = err.message || 'Failed to load module';
      LazyComponent = null;
    }
    loading = false;
  }

  // Load on initial render and route changes
  $effect(() => { loadRoute(route); });

  onMount(() => {
    const handler = () => { route = getRoute(); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  });
</script>

<ErrorBoundary>
  <div class="app" class:is-home={route === 'home' || route === ''}>
    {#if route === 'home' || route === ''}
      <Home />
    {:else if loading}
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading module…</p>
      </div>
    {:else if loadError === 'not-found'}
      <div class="not-found">
        <p>Module not found</p>
        <a href="#/">← back to modules</a>
      </div>
    {:else if loadError}
      <div class="not-found">
        <p>Failed to load module</p>
        <p class="error-detail">{loadError}</p>
        <a href="#/">← back to modules</a>
      </div>
    {:else if LazyComponent}
      <LazyComponent />
    {:else}
      <div class="not-found">
        <p>Module not found</p>
        <a href="#/">← back to modules</a>
      </div>
    {/if}
  </div>
</ErrorBoundary>

<style>
  .app {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  /* Home page needs to scroll — modules stay viewport-locked */
  .app.is-home {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  @media (max-width: 768px) {
    .app {
      height: auto;
      min-height: 100vh;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
    }
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
    color: #00FFD1;
    text-decoration: none;
    font-size: 0.8rem;
  }

  .not-found a:hover {
    text-decoration: underline;
  }

  .not-found .error-detail {
    color: #f87171;
    font-size: 0.75rem;
    font-family: var(--font-code);
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
  }

  .loading-spinner p {
    color: #555;
    font-size: 0.85rem;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #1a1a2e;
    border-top-color: #00FFD1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
