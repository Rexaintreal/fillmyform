import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    crx({
      manifest,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        content: "src/content/content.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "content") {
            return "content.js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
