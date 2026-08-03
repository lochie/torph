export const examples = {
  vanilla: `const textmorph = new TextMorph({
  element: document.getElementById('morph'),
  // options
});

textmorph.update('#');
`,
  react: `<TextMorph>#</TextMorph>`,
  vue: `<template>
  <TextMorph :text="#" />
</template>

<script setup>
  import { TextMorph } from "torph/vue";
</script>`,
  svelte: `<TextMorph text="#" />`,
};

export const populateExample = (example: string, exampleText: string) => {
  return example.replace("#", exampleText);
};
