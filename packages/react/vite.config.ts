import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      exclude: ["src/**/*.stories.*", "src/**/*.test.*", "src/test"]
    })
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        agents: "src/agents/index.ts"
      },
      cssFileName: "styles",
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ["es"]
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@cloudflare/kumo",
        "@phosphor-icons/react",
        "@tanstack/markdown",
        "@tanstack/markdown/extensions/streaming",
        "@tanstack/markdown/react",
        "ai"
      ]
    }
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
