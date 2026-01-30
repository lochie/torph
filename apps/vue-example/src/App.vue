<template>
  <div class="container">
    <TextMorph :text="text" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { TextMorph } from "torph/vue";

const texts = [
  "Animate Text Easily",
  "Animate Text Effortlessly",
  "Animate Text Seamlessly",
  "Fluidly Animate Text",
];

const index = ref(0);
let interval: ReturnType<typeof setInterval>;

onMounted(() => {
  interval = setInterval(() => {
    index.value = (index.value + 1) % texts.length;
  }, 2000);
});

onUnmounted(() => {
  clearInterval(interval);
});

const text = computed(() => texts[index.value]);
</script>

<style>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 2rem;
}
</style>
