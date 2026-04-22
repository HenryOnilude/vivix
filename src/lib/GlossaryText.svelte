<script>
  /**
   * GlossaryText — renders a string and automatically wraps every
   * glossary term it contains with the <Glossary> hover tooltip.
   *
   * This makes it trivial to enhance any existing prose (brain text,
   * CPU labels, memory-map legends) without the call-site needing to
   * know which words are glossary terms.
   *
   * Usage:
   *   <GlossaryText text={sd.brain} />
   */
  import Glossary from './Glossary.svelte';
  import { tokenize } from './glossary.js';

  /** @type {{ text: string }} */
  let { text = '' } = $props();

  const tokens = $derived(tokenize(text));
</script>

{#each tokens as t}{#if t.term}<Glossary term={t.term}>{t.text}</Glossary>{:else}{t.text}{/if}{/each}
