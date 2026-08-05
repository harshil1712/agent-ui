import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), dts({ include: ["src"] })],
  build: {
    lib: {
      entry: "src/index.ts",
      cssFileName: "styles",
      fileName: "index",
      formats: ["es"]
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@cloudflare/kumo", "@phosphor-icons/react"]
    }
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
