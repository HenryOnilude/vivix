<!--
  Vivix — JavaScript Visualizer

  @author     Henry Onilude
  @copyright  2026 Henry Onilude
  @license    MIT
  @link       https://github.com/HenryOnilude/vivix
-->

<script>
  // Auto-wraps glossary terms in a string with <Glossary> tooltips.
  import Glossary from './Glossary.svelte';
  import { tokenize } from './glossary.js';

  /** @type {{ text: string }} */
  let { text = '' } = $props();

  const tokens = $derived(tokenize(text));
</script>

{#each tokens as t}{#if t.term}<Glossary term={t.term}>{t.text}</Glossary>{:else}{t.text}{/if}{/each}
