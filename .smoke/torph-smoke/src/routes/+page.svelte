<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TextMorph } from 'torph/svelte';

  const texts = [
    'Animate Text Easily',
    'Animate Text Effortlessly',
    'Animate Text Seamlessly',
    'Fluidly Animate Text'
  ];

  let index = $state(0);
  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(() => {
      index = (index + 1) % texts.length;
    }, 2000);
  });

  onDestroy(() => {
    clearInterval(interval);
  });

  const text = $derived(texts[index]);
</script>

<main class="container">
  <TextMorph {text} as="h1" />
</main>

<style>
  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    font-size: 2rem;
  }
</style>
