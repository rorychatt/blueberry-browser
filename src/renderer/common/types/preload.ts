export interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

export interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

export interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  removeChatResponseListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;
}

export interface TopBarAPI {
  // Tab management
  createTab: (url?: string) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<unknown>;

  // Sidebar
  toggleSidebar: () => Promise<void>;
}

declare global {
  interface Window {
    electron: import("@electron-toolkit/preload").ElectronAPI;
    sidebarAPI: SidebarAPI;
    topBarAPI: TopBarAPI;
  }
}
