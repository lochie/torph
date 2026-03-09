import { defineComponent, ref, computed, h, watch, onUnmounted } from "vue";
import {
  DEFAULT_AS,
  DEFAULT_TEXT_MORPH_OPTIONS,
  MorphController,
} from "../lib/text-morph";
import type { TextMorphProps } from "./types";

export default defineComponent({
  name: "TextMorph",
  props: {
    text: { type: String, required: true },
    class: { type: [String, Object, Array] as any, default: undefined },
    style: { type: Object, default: undefined },
    as: { type: String, default: DEFAULT_AS },
    locale: { type: String, default: DEFAULT_TEXT_MORPH_OPTIONS.locale },
    duration: { type: Number, default: DEFAULT_TEXT_MORPH_OPTIONS.duration },
    ease: { type: [String, Object] as any, default: DEFAULT_TEXT_MORPH_OPTIONS.ease },
    scale: { type: Boolean, default: DEFAULT_TEXT_MORPH_OPTIONS.scale },
    debug: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: DEFAULT_TEXT_MORPH_OPTIONS.disabled },
    respectReducedMotion: {
      type: Boolean,
      default: DEFAULT_TEXT_MORPH_OPTIONS.respectReducedMotion,
    },
    onAnimationStart: { type: Function, default: undefined },
    onAnimationComplete: { type: Function, default: undefined },
  },
  setup(props) {
    const containerRef = ref<HTMLElement | null>(null);
    const controller = new MorphController();

    const configKey = computed(() =>
      MorphController.serializeConfig(props as any),
    );

    function createInstance() {
      if (containerRef.value) {
        controller.attach(containerRef.value, {
          locale: props.locale,
          duration: props.duration,
          ease: props.ease as TextMorphProps["ease"],
          debug: props.debug,
          scale: props.scale,
          disabled: props.disabled,
          respectReducedMotion: props.respectReducedMotion,
          onAnimationStart: props.onAnimationStart as (() => void) | undefined,
          onAnimationComplete: props.onAnimationComplete as (() => void) | undefined,
        });
        controller.update(props.text);
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

    return () =>
      h(props.as, {
        ref: containerRef,
        class: props.class,
        style: props.style,
      }, import.meta?.server ? props.text : undefined);
  },
});
