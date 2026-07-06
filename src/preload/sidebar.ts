import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface MessageContentPart {
  type: "text" | "image";
  text?: string;
  image?: string;
}

interface PreloadChatMessage {
  role: "user" | "assistant" | "system";
  content: string | MessageContentPart[];
}

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: async (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: async () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: async () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => {
      callback(data);
    });
  },

  onMessagesUpdated: (callback: (messages: PreloadChatMessage[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) => {
      callback(messages);
    });
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: async () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: async () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: async () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: async () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),

  // E2E Playwright-alternative testing APIs
  getE2ETests: async () => electronAPI.ipcRenderer.invoke("get-e2e-tests"),
  saveE2ETest: async (filename: string, content: string) =>
    electronAPI.ipcRenderer.invoke("save-e2e-test", filename, content),
  getE2EScreenshot: async (filename: string) =>
    electronAPI.ipcRenderer.invoke("get-e2e-screenshot", filename),
  runE2ETest: async (filename: string) => electronAPI.ipcRenderer.invoke("run-e2e-test", filename),
  runE2ETestInBrowser: async (filename: string) =>
    electronAPI.ipcRenderer.invoke("run-e2e-test-in-browser", filename),
  onE2ETestLog: (
    callback: (data: { type: "stdout" | "stderr" | "system"; text: string }) => void,
  ) => {
    electronAPI.ipcRenderer.on("e2e-test-log", (_, data) => {
      callback(data);
    });
  },
  removeE2ETestLogListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("e2e-test-log");
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// Renderer only if context isolation is enabled, otherwise
// Just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.sidebarAPI = sidebarAPI;
}
