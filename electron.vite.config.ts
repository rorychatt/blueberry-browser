import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, "src/browser/main/index.ts"),
      },
      rollupOptions: {
        external: ["electron"],
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        external: ["electron"],
        input: {
          sidebar: resolve(__dirname, "src/browser/preload/sidebar.ts"),
          topbar: resolve(__dirname, "src/browser/preload/topbar.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          sidebar: resolve(__dirname, "src/browser/renderer/sidebar/index.html"),
          topbar: resolve(__dirname, "src/browser/renderer/topbar/index.html"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@common": resolve("src/browser/renderer/common"),
        "@renderer": resolve("src/browser/renderer/src"),
      },
    },
    root: "src/browser/renderer",
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
