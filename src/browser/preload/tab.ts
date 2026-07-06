import { contextBridge, ipcRenderer } from "electron";

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
};

if (isSettingsPage) {
  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
    } catch (error) {
      console.error(error);
    }
  } else {
    // @ts-expect-error (define in dts)
    window.settingsAPI = settingsAPI;
  }
}
