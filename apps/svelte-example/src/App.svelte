<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TextMorph } from 'torph/svelte';

  const texts = [
    "Animate Text Easily",
    "Animate Text Effortlessly",
    "Animate Text Seamlessly",
    "Fluidly Animate Text",
  ];

  let index = 0;
  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(() => {
      index = (index + 1) % texts.length;
    }, 2000);
  });

  onDestroy(() => {
    clearInterval(interval);
  });

  $: text = texts[index];
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
