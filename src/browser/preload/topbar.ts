import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// TopBar specific APIs
const topBarAPI = {
  platform: process.platform,
  // Tab management
  createTab: async (url?: string) => electronAPI.ipcRenderer.invoke("create-tab", url),
  closeTab: async (tabId: string) => electronAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: async (tabId: string) => electronAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: async () => electronAPI.ipcRenderer.invoke("get-tabs"),

  // Tab navigation
  navigateTab: async (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: async (tabId: string) => electronAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: async (tabId: string) => electronAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: async (tabId: string) => electronAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: async (tabId: string) => electronAPI.ipcRenderer.invoke("tab-screenshot", tabId),
  tabRunJs: async (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke("tab-run-js", tabId, code),

  // Sidebar
  toggleSidebar: async () => electronAPI.ipcRenderer.invoke("toggle-sidebar"),

  // Dynamic height
  setHeight: async (height: number) => electronAPI.ipcRenderer.invoke("set-topbar-height", height),
};

const historyAPI = {
  getHistory: async () => electronAPI.ipcRenderer.invoke("get-history"),
  deleteHistoryEntry: async (id: string) =>
    electronAPI.ipcRenderer.invoke("delete-history-entry", id),
  clearHistory: async () => electronAPI.ipcRenderer.invoke("clear-history"),
  getHistorySuggestions: async (historyList: unknown, currentPage: unknown) =>
    electronAPI.ipcRenderer.invoke("get-history-suggestions", historyList, currentPage),
};

// Use `contextBridge` APIs to expose Electron APIs to
// Renderer only if context isolation is enabled, otherwise
// Just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
    contextBridge.exposeInMainWorld("historyAPI", historyAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.topBarAPI = topBarAPI;
  // @ts-expect-error (define in dts)
  window.historyAPI = historyAPI;
}
