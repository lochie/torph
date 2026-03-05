export const examples = {
  vanilla: `const textmorph = new TextMorph({
  element: document.getElementById('morph'),
  // options
});

textmorph.update('{EXAMPLE_TEXT}');
`,
  react: `<TextMorph>{EXAMPLE_TEXT}</TextMorph>`,
  vue: `<template>
  <TextMorph>{EXAMPLE_TEXT}</TextMorph>
</template>

<script setup>
  import { TextMorph } from "torph/vue";
</script>`,
  svelte: `<TextMorph text="{EXAMPLE_TEXT}"/>`,
};

export const populateExample = (example: string, exampleText: string) => {
  return example.replace("{EXAMPLE_TEXT}", exampleText);
};
