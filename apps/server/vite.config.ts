import { defineConfig } from "vitest/config";

export default defineConfig({
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
