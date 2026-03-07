import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: "torph/svelte",
        replacement: path.resolve(__dirname, "../../packages/torph/src/svelte"),
      },
      {
        find: /^torph$/,
        replacement: path.resolve(__dirname, "../../packages/torph/src/index.ts"),
      },
    ],
  },
});
