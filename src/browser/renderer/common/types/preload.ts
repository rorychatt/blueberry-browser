export interface MessageContentPart {
  type: "text" | "image" | "file";
  text?: string;
  image?: string;
  data?: string;
  mediaType?: string;
}

export interface PreloadChatMessage {
  role: "user" | "assistant" | "system";
  content: string | MessageContentPart[];
}

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
  canGoBack?: boolean;
  canGoForward?: boolean;
}

export interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  clearChat: () => Promise<void>;
  getMessages: () => Promise<PreloadChatMessage[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: PreloadChatMessage[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // E2E Playwright-alternative testing APIs
  getE2ETests: () => Promise<{ filename: string; name: string; content: string }[]>;
  saveE2ETest: (filename: string, content: string) => Promise<{ success: boolean; error?: string }>;
  getE2EScreenshot: (filename: string) => Promise<string | null>;
  runE2ETest: (
    filename: string,
    headful?: boolean,
  ) => Promise<{ success: boolean; error?: string; code?: number }>;
  runE2ETestInBrowser: (filename: string) => Promise<{ success: boolean; error?: string }>;
  killE2ETest: () => Promise<{ killed: boolean; success: boolean; error?: string }>;
  onE2ETestLog: (
    callback: (data: { type: "stdout" | "stderr" | "system"; text: string }) => void,
  ) => void;
  removeE2ETestLogListener: () => void;
}

export interface TopBarAPI {
  platform: string;
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

  // Dynamic height
  setHeight: (height: number) => Promise<void>;
}

export interface SettingsAPI {
  getShortcuts: () => Promise<unknown>;
  saveShortcuts: (shortcuts: unknown) => Promise<boolean>;
  getSettings: () => Promise<unknown>;
  saveSettings: (settings: unknown) => Promise<boolean>;
  getPlatform?: () => string;
  getVersions?: () => {
    electron?: string;
    chrome?: string;
    node?: string;
  };
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface HistorySuggestion {
  title: string;
  url: string;
  reason: string;
  type: "search" | "history" | "tool";
}

export interface HistoryAPI {
  getHistory: () => Promise<HistoryEntry[]>;
  deleteHistoryEntry: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
  getHistorySuggestions: (
    historyList: HistoryEntry[],
    currentPage: { url: string; title: string } | null,
  ) => Promise<{ suggestions: HistorySuggestion[] }>;
}

declare global {
  interface Window {
    electron: import("@electron-toolkit/preload").ElectronAPI;
    sidebarAPI: SidebarAPI;
    topBarAPI: TopBarAPI;
    settingsAPI: SettingsAPI;
    historyAPI: HistoryAPI;
  }
}
