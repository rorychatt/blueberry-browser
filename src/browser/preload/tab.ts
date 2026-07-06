import { contextBridge, ipcRenderer } from "electron";

// Tab specific APIs including Settings access
const isSettingsPage =
  window.location.href.includes("/settings/") ||
  window.location.href.includes("/settings") ||
  window.location.pathname.includes("settings");

if (isSettingsPage) {
  const settingsAPI = {
    getShortcuts: async () => ipcRenderer.invoke("get-shortcuts"),
    saveShortcuts: async (shortcuts: unknown) => ipcRenderer.invoke("save-shortcuts", shortcuts),
  };

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
