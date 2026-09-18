import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "/Dihor.GameKit.Board/",
  resolve: {
    alias: {
      "@dihor/gamekit-board": fileURLToPath(
        new URL("./src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    sourcemap: true,
  },
});
