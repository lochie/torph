<script lang="ts">
  import { onMount } from 'svelte';
  import { TextMorph } from 'torph/svelte';

  const texts = [
    "Animate Text Easily",
    "Animate Text Effortlessly",
    "Animate Text Seamlessly",
    "Fluidly Animate Text",
  ];

  let index = $state(0);

  onMount(() => {
    const interval = setInterval(() => {
      index = (index + 1) % texts.length;
    }, 2000);

    return () => clearInterval(interval);
  });

  const text = $derived(texts[index]);
</script>

<div class="container">
  <TextMorph {text} />
</div>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 2rem;
  }
</style>
