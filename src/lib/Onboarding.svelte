<script>
  import { onMount } from 'svelte';

  let show = $state(false);

  onMount(() => {
    const hasSeen = localStorage.getItem('onboarding-seen');
    if (!hasSeen) {
      show = true;
    }
  });

  function close() {
    show = false;
    localStorage.setItem('onboarding-seen', 'true');
  }
</script>

{#if show}
  <div class="onboarding-overlay" onclick={close}>
    <div class="onboarding-modal" onclick|stopPropagation>
      <h2>Welcome to visualJS!</h2>
      <p>See how JavaScript thinks with interactive animations.</p>
      <ol>
        <li>Choose a module from the home page.</li>
        <li>Type or select example code.</li>
        <li>Hit Play to watch the animation.</li>
        <li>Use step controls for detailed execution.</li>
      </ol>
      <button onclick={close}>Got it!</button>
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .onboarding-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    text-align: center;
  }

  .onboarding-modal h2 {
    color: var(--text-secondary);
    margin-bottom: 10px;
  }

  .onboarding-modal p {
    color: var(--text-primary);
    margin-bottom: 15px;
  }

  .onboarding-modal ol {
    text-align: left;
    color: var(--text-primary);
    margin-bottom: 20px;
  }

  .onboarding-modal button {
    background: var(--accent-variables);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
  }
</style>