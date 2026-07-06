import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, "browser/main/index.ts"),
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
          sidebar: resolve(__dirname, "browser/preload/sidebar.ts"),
          topbar: resolve(__dirname, "browser/preload/topbar.ts"),
          tab: resolve(__dirname, "browser/preload/tab.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          sidebar: resolve(__dirname, "browser/renderer/sidebar/index.html"),
          topbar: resolve(__dirname, "browser/renderer/topbar/index.html"),
          settings: resolve(__dirname, "browser/renderer/settings/index.html"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@common": resolve(__dirname, "browser/renderer/common"),
        "@renderer": resolve(__dirname, "browser/renderer/src"),
      },
    },
    root: resolve(__dirname, "browser/renderer"),
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
