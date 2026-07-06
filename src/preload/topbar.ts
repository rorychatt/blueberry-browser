import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// TopBar specific APIs
const topBarAPI = {
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
};

// Use `contextBridge` APIs to expose Electron APIs to
// Renderer only if context isolation is enabled, otherwise
// Just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.topBarAPI = topBarAPI;
}
