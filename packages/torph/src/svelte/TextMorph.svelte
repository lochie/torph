<script lang="ts">
  import { DEFAULT_AS, DEFAULT_TEXT_MORPH_OPTIONS, type TextMorphOptions } from '../lib/text-morph';
  import { MorphController } from '../lib/text-morph/controller';

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
  const controller = new MorphController();

  const options = $derived({
    locale, duration, ease, debug, scale,
    disabled, respectReducedMotion,
    onAnimationStart, onAnimationComplete,
  });

  const configKey = $derived(
    MorphController.serializeConfig(options)
  );

  $effect(() => {
    configKey;

    if (containerRef) {
      controller.attach(containerRef, options);

      return () => {
        controller.destroy();
      };
    }
  });

  $effect(() => {
    controller.update(text);
  });
</script>

<svelte:element this={as} bind:this={containerRef} {...props}>
</svelte:element>
