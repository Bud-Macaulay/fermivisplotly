import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libInjectCss } from "vite-plugin-lib-inject-css";
import packageJson from "./package.json" assert { type: "json" };

export default defineConfig({
  publicDir: false,
  plugins: [react(), libInjectCss()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.js"),
      fileName: "main",
      formats: ["es"],
    },
    rollupOptions: {
      external: Object.keys(packageJson.peerDependencies ?? {}),
    },
  },
});
