import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Tab specific APIs including Settings access
const isSettingsPage =
  window.location.href.includes("/settings/") ||
  window.location.href.includes("/settings") ||
  window.location.pathname.includes("settings");

const settingsAPI = {
  getShortcuts: async () => ipcRenderer.invoke("get-shortcuts"),
  saveShortcuts: async (shortcuts: unknown) => ipcRenderer.invoke("save-shortcuts", shortcuts),
  getSettings: async () => ipcRenderer.invoke("get-settings"),
  saveSettings: async (settings: unknown) => ipcRenderer.invoke("save-settings", settings),
  getPlatform: () => process.platform,
  getVersions: () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }),
};

if (isSettingsPage) {
  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
      contextBridge.exposeInMainWorld("electron", electronAPI);
    } catch (error) {
      console.error(error);
    }
  } else {
    // @ts-expect-error (define in dts)
    window.settingsAPI = settingsAPI;
    // @ts-expect-error (define in dts)
    window.electron = electronAPI;
  }
}
