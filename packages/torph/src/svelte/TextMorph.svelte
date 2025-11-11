<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TextMorph as Morph } from '../lib/text-morph';
  import type { TextMorphOptions } from '../lib/text-morph/types';

  export let text: string;
  export let locale: Intl.LocalesArgument = 'en';
  export let duration: number = 400;
  export let ease: string = 'cubic-bezier(0.19, 1, 0.22, 1)';
  export let debug: boolean = false;

  let containerRef: HTMLDivElement;
  let morphInstance: Morph | null = null;

  onMount(() => {
    if (containerRef) {
      morphInstance = new Morph({
        element: containerRef,
        locale,
        duration,
        ease,
        debug,
      });
      morphInstance.update(text);
    }
  });

  onDestroy(() => {
    morphInstance?.destroy();
  });

  $: if (morphInstance) {
    morphInstance.update(text);
  }
</script>

<div bind:this={containerRef}></div>

