<template>
  <component
    :is="as"
    ref="containerRef"
    :class="props.class"
    :style="props.style"
  ></component>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from "vue";
import {
  DEFAULT_AS,
  DEFAULT_TEXT_MORPH_OPTIONS,
} from "../lib/text-morph";
import { MorphController } from "../lib/text-morph/controller";
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
const controller = new MorphController();

const configKey = computed(() =>
  MorphController.serializeConfig(props),
);

function createInstance() {
  if (containerRef.value) {
    controller.attach(containerRef.value, {
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
  }
}

watch(containerRef, () => createInstance(), { flush: "post" });
watch(configKey, () => createInstance());

onUnmounted(() => {
  controller.destroy();
});

watch(
  () => props.text,
  (newText) => {
    controller.update(newText);
  },
);
</script>
