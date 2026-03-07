import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sandboxd/core": resolve(import.meta.dirname, "../../packages/core/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    ssr: "src/index.ts",
    target: "node24",
    rollupOptions: {
      output: {
        entryFileNames: "server.js",
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
