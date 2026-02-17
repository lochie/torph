<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DEFAULT_AS, DEFAULT_TEXT_MORPH_OPTIONS, TextMorph as Morph } from '../lib/text-morph';

  export let text: string;
  export let locale: Intl.LocalesArgument = DEFAULT_TEXT_MORPH_OPTIONS.locale;
  export let duration: number = DEFAULT_TEXT_MORPH_OPTIONS.duration;
  export let ease: string = DEFAULT_TEXT_MORPH_OPTIONS.ease;
  export let debug: boolean = DEFAULT_TEXT_MORPH_OPTIONS.debug;
  export let disabled: boolean = DEFAULT_TEXT_MORPH_OPTIONS.disabled;
  export let respectReducedMotion: boolean = DEFAULT_TEXT_MORPH_OPTIONS.respectReducedMotion;
  export let onAnimationStart: (() => void) | undefined = undefined;
  export let onAnimationComplete: (() => void) | undefined = undefined;
  
  let className: string = '';
  export { className as class };
  export let style: string = '';
  export let as: string = DEFAULT_AS;

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
