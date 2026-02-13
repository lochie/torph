<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TextMorph as Morph } from '../lib/text-morph';

  export let text: string;
  export let locale: Intl.LocalesArgument = 'en';
  export let duration: number = 400;
  export let ease: string = 'cubic-bezier(0.19, 1, 0.22, 1)';
  export let debug: boolean = false;
  export let disabled: boolean = false;
  export let respectReducedMotion: boolean = true;
  export let onAnimationStart: (() => void) | undefined = undefined;
  export let onAnimationComplete: (() => void) | undefined = undefined;
  
  let className: string = '';
  export { className as class };
  export let style: string = '';
  export let as: string = 'div';

  let containerRef: HTMLElement;
  let morphInstance: Morph | null = null;

  onMount(() => {
    if (containerRef) {
      morphInstance = new Morph({
        element: containerRef,
        locale,
        duration,
        ease,
        debug,
        disabled,
        respectReducedMotion,
        onAnimationStart,
        onAnimationComplete,
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

<svelte:element this={as} bind:this={containerRef} class={className} {style}>
</svelte:element>

