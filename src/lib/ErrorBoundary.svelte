<script>
  import { onMount } from 'svelte';

  let { children } = $props();

  let hasError = $state(false);
  let errorMessage = $state('');
  let errorStack = $state('');

  function handleError(event) {
    hasError = true;
    errorMessage = event?.error?.message || event?.message || 'An unexpected error occurred';
    errorStack = event?.error?.stack || '';
    event?.preventDefault?.();
  }

  function handleRejection(event) {
    hasError = true;
    errorMessage = event?.reason?.message || String(event?.reason) || 'Unhandled promise rejection';
    errorStack = event?.reason?.stack || '';
    event?.preventDefault?.();
  }

  function reset() {
    hasError = false;
    errorMessage = '';
    errorStack = '';
  }

  onMount(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  });
</script>

{#if hasError}
  <div class="error-boundary">
    <div class="error-card">
      <div class="error-icon">⚠</div>
      <h2>Something went wrong</h2>
      <p class="error-msg">{errorMessage}</p>
      {#if errorStack}
        <details>
          <summary>Technical details</summary>
          <pre class="error-stack">{errorStack}</pre>
        </details>
      {/if}
      <div class="error-actions">
        <button onclick={reset}>Try again</button>
        <a href="#/">← Back to home</a>
      </div>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    background: var(--a11y-bg, #0a0a14);
  }

  .error-card {
    max-width: 480px;
    padding: 32px;
    background: #12121e;
    border: 1px solid #2a2a3e;
    border-radius: 12px;
    text-align: center;
  }

  .error-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
  }

  h2 {
    color: #f87171;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .error-msg {
    color: #aaa;
    font-size: 0.85rem;
    margin: 0 0 16px;
    line-height: 1.5;
  }

  details {
    text-align: left;
    margin-bottom: 16px;
  }

  summary {
    color: #666;
    font-size: 0.75rem;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .error-stack {
    color: #888;
    font-size: 0.7rem;
    background: #0a0a14;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    max-height: 160px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .error-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  button {
    background: #00ff88;
    color: var(--a11y-bg, #0a0a14);
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  button:hover {
    opacity: 0.85;
  }

  a {
    color: #666;
    font-size: 0.8rem;
    text-decoration: none;
  }

  a:hover {
    color: #00ff88;
  }
</style>
