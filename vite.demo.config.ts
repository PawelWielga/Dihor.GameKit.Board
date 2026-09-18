import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "/Dihor.GameKit.Board/",
  resolve: {
    alias: [
      {
        find: "@dihor/gamekit-board/three",
        replacement: fileURLToPath(new URL("./src/three/index.ts", import.meta.url)),
      },
      {
        find: "@dihor/gamekit-board",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    sourcemap: true,
  },
});
