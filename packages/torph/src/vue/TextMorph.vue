<template>
  <div ref="containerRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { TextMorph as Morph } from '../lib/text-morph';
import type { TextMorphOptions } from '../lib/text-morph/types';

export interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  text: string;
}

const props = withDefaults(defineProps<TextMorphProps>(), {
  locale: 'en',
  duration: 400,
  ease: 'cubic-bezier(0.19, 1, 0.22, 1)',
});

const containerRef = ref<HTMLDivElement | null>(null);
let morphInstance: Morph | null = null;

onMounted(() => {
  if (containerRef.value) {
    morphInstance = new Morph({
      element: containerRef.value,
      locale: props.locale,
      duration: props.duration,
      ease: props.ease,
      debug: props.debug,
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
  }
);
</script>

