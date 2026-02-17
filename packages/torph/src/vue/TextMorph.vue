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
  TEXT_MORPH_DEFAULT_AS,
  TEXT_MORPH_DEFAULT_PROPS,
  TextMorph as Morph,
} from "../lib/text-morph";
import type { TextMorphProps } from "./types";

const props = withDefaults(defineProps<TextMorphProps>(), {
  locale: TEXT_MORPH_DEFAULT_PROPS.locale,
  duration: TEXT_MORPH_DEFAULT_PROPS.duration,
  ease: TEXT_MORPH_DEFAULT_PROPS.ease,
  disabled: TEXT_MORPH_DEFAULT_PROPS.disabled,
  respectReducedMotion: TEXT_MORPH_DEFAULT_PROPS.respectReducedMotion,
  as: TEXT_MORPH_DEFAULT_AS,
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
