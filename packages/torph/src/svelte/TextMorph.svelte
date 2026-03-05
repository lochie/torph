<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_AS, DEFAULT_TEXT_MORPH_OPTIONS, TextMorph as Morph, type TextMorphOptions } from '../lib/text-morph';
  
  type Props = Omit<TextMorphOptions, "element"> & {
    text: string;
    class?: string;
    style?: string;
    as?: string;
  }

  let {
    text,
    locale = DEFAULT_TEXT_MORPH_OPTIONS.locale,
    duration = DEFAULT_TEXT_MORPH_OPTIONS.duration,
    ease = DEFAULT_TEXT_MORPH_OPTIONS.ease,
    scale = DEFAULT_TEXT_MORPH_OPTIONS.scale,
    debug = DEFAULT_TEXT_MORPH_OPTIONS.debug,
    disabled = DEFAULT_TEXT_MORPH_OPTIONS.disabled,
    respectReducedMotion = DEFAULT_TEXT_MORPH_OPTIONS.respectReducedMotion,
    onAnimationStart = undefined,
    onAnimationComplete = undefined,
    as = DEFAULT_AS,
    ...props
  }: Props = $props();

  let containerRef = $state<HTMLElement>();
  let morphInstance = $state<Morph | null>(null);

  onMount(() => {
    if (containerRef) {
      morphInstance = new Morph({
        element: containerRef,
        locale,
        duration,
        ease,
        debug,
        scale,
        disabled,
        respectReducedMotion,
        onAnimationStart,
        onAnimationComplete,
      });
      morphInstance.update(text);
    }

    return () => {
		  morphInstance?.destroy();
		};
  });

  $effect(() => {
    if (morphInstance) {
      morphInstance.update(text);
    }
  });
</script>

<svelte:element this={as} bind:this={containerRef} {...props}>
</svelte:element>
