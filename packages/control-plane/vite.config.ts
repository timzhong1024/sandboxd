import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sandboxd/core": resolve(import.meta.dirname, "../core/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    ssr: "src/index.ts",
    target: "node24",
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
