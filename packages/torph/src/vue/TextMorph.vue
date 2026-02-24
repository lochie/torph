<template>
  <component
    :is="as"
    ref="containerRef"
    :class="props.class"
    :style="props.style"
  ></component>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
  DEFAULT_AS,
  DEFAULT_TEXT_MORPH_OPTIONS,
  TextMorph as Morph,
} from "../lib/text-morph";
import type { TextMorphProps } from "./types";

const props = withDefaults(defineProps<TextMorphProps>(), {
  locale: DEFAULT_TEXT_MORPH_OPTIONS.locale,
  duration: DEFAULT_TEXT_MORPH_OPTIONS.duration,
  ease: DEFAULT_TEXT_MORPH_OPTIONS.ease,
  scale: DEFAULT_TEXT_MORPH_OPTIONS.scale,
  disabled: DEFAULT_TEXT_MORPH_OPTIONS.disabled,
  respectReducedMotion: DEFAULT_TEXT_MORPH_OPTIONS.respectReducedMotion,
  as: DEFAULT_AS,
});

const containerRef = ref<HTMLElement | null>(null);
let morphInstance: Morph | null = null;

onMounted(() => {
  if (containerRef.value) {
    morphInstance = new Morph({
      element: containerRef.value,
      locale: props.locale,
      duration: props.duration,
      ease: props.ease,
      debug: props.debug,
      scale: props.scale,
      disabled: props.disabled,
      respectReducedMotion: props.respectReducedMotion,
      onAnimationStart: props.onAnimationStart,
      onAnimationComplete: props.onAnimationComplete,
    });
    morphInstance.update(props.text);
  }
});

onUnmounted(() => {
  morphInstance?.destroy();
});

watch(
  () => props.text,
  (newText) => {
    morphInstance?.update(newText);
  },
);
</script>
