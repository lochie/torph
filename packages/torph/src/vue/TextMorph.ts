import {
  defineComponent,
  ref,
  computed,
  h,
  watch,
  onUnmounted,
  type PropType,
} from "vue";
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
    class: {
      type: [String, Object, Array] as PropType<
        string | Record<string, boolean> | string[]
      >,
      default: undefined,
    },
    style: { type: Object, default: undefined },
    as: { type: String, default: DEFAULT_AS },
    locale: { type: String, default: DEFAULT_TEXT_MORPH_OPTIONS.locale },
    // Left undefined, so a plugin's ease can stand in when none is chosen.
    duration: { type: Number, default: undefined },
    ease: {
      type: [String, Object] as PropType<TextMorphProps["ease"]>,
      default: undefined,
    },
    debug: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: DEFAULT_TEXT_MORPH_OPTIONS.disabled },
    respectReducedMotion: {
      type: Boolean,
      default: DEFAULT_TEXT_MORPH_OPTIONS.respectReducedMotion,
    },
    onAnimationStart: { type: Function, default: undefined },
    onAnimationComplete: { type: Function, default: undefined },
    onAnimationCancel: { type: Function, default: undefined },
    plugins: {
      type: Array as PropType<TextMorphProps["plugins"]>,
      default: undefined,
    },
  },
  setup(props) {
    const containerRef = ref<HTMLElement | null>(null);
    const controller = new MorphController();

    // Present in SSR markup so hydration matches, and frozen — once mounted the
    // controller owns the children, and re-rendering here would wipe its segments.
    const initialText = props.text;

    const configKey = computed(() =>
      MorphController.serializeConfig({
        locale: props.locale,
        duration: props.duration,
        ease: props.ease,
        debug: props.debug,
        disabled: props.disabled,
        respectReducedMotion: props.respectReducedMotion,
        plugins: props.plugins,
      }),
    );

    function createInstance() {
      if (containerRef.value) {
        controller.attach(containerRef.value, {
          locale: props.locale,
          duration: props.duration,
          ease: props.ease as TextMorphProps["ease"],
          debug: props.debug,
          disabled: props.disabled,
          respectReducedMotion: props.respectReducedMotion,
          plugins: props.plugins,
          onAnimationStart: props.onAnimationStart as (() => void) | undefined,
          onAnimationComplete: props.onAnimationComplete as
            | (() => void)
            | undefined,
          onAnimationCancel: props.onAnimationCancel as
            | (() => void)
            | undefined,
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
      h(
        props.as,
        {
          ref: containerRef,
          class: props.class,
          style: props.style,
        },
        initialText,
      );
  },
});
