import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sandboxd/control-plane": resolve(
        import.meta.dirname,
        "../../packages/control-plane/src/index.ts",
      ),
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
        entryFileNames: "cli.js",
        banner: "#!/usr/bin/env node",
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
