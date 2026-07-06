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

const historyAPI = {
  getHistory: async () => ipcRenderer.invoke("get-history"),
  deleteHistoryEntry: async (id: string) => ipcRenderer.invoke("delete-history-entry", id),
  clearHistory: async () => ipcRenderer.invoke("clear-history"),
  getHistorySuggestions: async (historyList: unknown, currentPage: unknown) =>
    ipcRenderer.invoke("get-history-suggestions", historyList, currentPage),
};

if (isSettingsPage) {
  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
      contextBridge.exposeInMainWorld("electron", electronAPI);
      contextBridge.exposeInMainWorld("historyAPI", historyAPI);
    } catch (error) {
      console.error(error);
    }
  } else {
    // @ts-expect-error (define in dts)
    window.settingsAPI = settingsAPI;
    // @ts-expect-error (define in dts)
    window.electron = electronAPI;
    // @ts-expect-error (define in dts)
    window.historyAPI = historyAPI;
  }
}
