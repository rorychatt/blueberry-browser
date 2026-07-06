import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          sidebar: resolve(__dirname, "src/preload/sidebar.ts"),
          topbar: resolve(__dirname, "src/preload/topbar.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          sidebar: resolve(__dirname, "src/renderer/sidebar/index.html"),
          topbar: resolve(__dirname, "src/renderer/topbar/index.html"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@common": resolve("src/renderer/common"),
        "@renderer": resolve("src/renderer/src"),
      },
    },
    root: "src/renderer",
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
