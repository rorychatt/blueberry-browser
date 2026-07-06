import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: "../../../out/renderer/topbar",
    rollupOptions: {
      external: ["electron"],
    },
  },
  plugins: [react()],
});
