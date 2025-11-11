export const examples = {
  vanilla: `import { TextMorph } from 'torph';

const textmorph = new TextMorph({
  element: document.getElementById('morph'),
  {luke/jobs-api-integration
    // options
  }
});

textmorph.update('{EXAMPLE_TEXT}');
`,
  react: `import { TextMorph } from 'torph/react';

<TextMorph>{EXAMPLE_TEXT}</TextMorph>`,
  vue: `<template>
  <TextMorph>{EXAMPLE_TEXT}</TextMorph>
</template>

<script>
import { TextMorph } from 'torph/vue';
export default {
  components: {
    TextMorph
  }
}
</script>`,
  svelte: `<script>
  import { TextMorph } from 'torph/svelte';
</script>

<TextMorph>{EXAMPLE_TEXT}</TextMorph>`,
};

export const populateExample = (example: string, exampleText: string) => {
  return example.replace("{EXAMPLE_TEXT}", exampleText);
};
