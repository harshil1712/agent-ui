import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), dts({ include: ["src"] })],
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
        "ai"
      ]
    }
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
