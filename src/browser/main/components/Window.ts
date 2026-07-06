import { BaseWindow, shell, WebContents } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { getBaseWindowOptions } from "../utils/windowOptions";
import { calculateTabBounds } from "../utils/bounds";
import { registerKeyboardShortcuts } from "../utils/shortcuts";
import {
  type ShortcutConfig,
  type AppSettings,
  SettingsManager,
  DEFAULT_SHORTCUTS,
  DEFAULT_SETTINGS,
} from "../services/SettingsManager";

export class Window {
  private readonly _baseWindow: BaseWindow;
  private readonly tabsMap = new Map<string, Tab>();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private readonly _topBar: TopBar;
  private readonly _sideBar: SideBar;
  public shortcuts: ShortcutConfig = { ...DEFAULT_SHORTCUTS };
  public settings: AppSettings = { ...DEFAULT_SETTINGS };

  constructor() {
    // Load persisted settings asynchronously
    void this.loadSettings();

    // Create the browser window.
    this._baseWindow = new BaseWindow(getBaseWindowOptions());

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);

    // Register standard shortcuts on TopBar and SideBar
    this.registerKeyboardShortcuts(this._topBar.view.webContents);
    this.registerKeyboardShortcuts(this._sideBar.view.webContents);

    // Set the window reference on the LLM client to avoid circular dependency
    this._sideBar.client.setWindow(this);

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._topBar.updateBounds();
      this._sideBar.updateBounds();
      // Notify renderer of resize through active tab
      const bounds = this._baseWindow.getContentBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          height: bounds.height,
          width: bounds.width,
        });
      }
    });

    // Handle external link opening
    this.tabsMap.forEach((tab) => {
      tab.webContents.setWindowOpenHandler((details) => {
        void shell.openExternal(details.url);
        return { action: "deny" };
      });
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      // Clean up all tabs when window is closed
      this.tabsMap.forEach((tab) => {
        tab.destroy();
      });
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return [...this.tabsMap.values()];
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  // Tab management methods
  createTab(url?: string, activate: boolean = true): Tab {
    // If the url is blueberry://settings, check if we already have a tab with this url
    if (url === "blueberry://settings") {
      const existingSettingsTab = [...this.tabsMap.values()].find(
        (t) => t.url === "blueberry://settings",
      );
      if (existingSettingsTab) {
        this.switchActiveTab(existingSettingsTab.id);
        return existingSettingsTab;
      }
    }

    const tabId = `tab-${++this.tabCounter}`;
    const defaultUrl = SettingsManager.getInstance().getSettingsSync().landingPage;
    const tab = new Tab(tabId, url || defaultUrl, () => this.notifyTabsUpdated());

    // Register standard shortcuts on the tab
    this.registerKeyboardShortcuts(tab.webContents);

    // Add the tab's WebContentsView to the window
    this._baseWindow.contentView.addChildView(tab.view);

    // Ensure TopBar and SideBar are always on top of any tabs
    this.bringViewsToFront();

    // Set the bounds to fill the window below the topbar and to the left of sidebar
    const bounds = this._baseWindow.getContentBounds();
    tab.view.setBounds(calculateTabBounds(bounds, this._sideBar.getIsVisible()));

    // Store the tab
    this.tabsMap.set(tabId, tab);

    if (activate) {
      this.switchActiveTab(tabId);
    } else {
      // Hide the tab initially if not activating
      tab.hide();
    }

    this.notifyTabsUpdated();
    return tab;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // If this is the last remaining tab, create a new tab first
    // to prevent the browser window from closing.
    if (this.tabsMap.size === 1) {
      this.createTab();
    }

    // Remove the WebContentsView from the window
    this._baseWindow.contentView.removeChildView(tab.view);

    // Destroy the tab
    tab.destroy();

    // Remove from our tabs map
    this.tabsMap.delete(tabId);

    // If this was the active tab, switch to another tab
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = [...this.tabsMap.keys()];
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    // If no tabs left, close the window (fallback check)
    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    } else {
      this.notifyTabsUpdated();
    }

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // Show the new active tab first
    tab.show();

    // Hide the previously active tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    this.activeTabId = tabId;

    // Focus the tab's WebContents
    tab.webContents.focus();

    // Ensure TopBar and SideBar are always on top
    this.bringViewsToFront();

    // Update the window title to match the tab title
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    this.notifyTabsUpdated();
    return true;
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  // Window methods
  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: { x?: number; y?: number; width?: number; height?: number }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  // Handle window resize to update tab bounds
  private updateTabBounds(): void {
    const bounds = this._baseWindow.getContentBounds();
    const isSidebarVisible = this._sideBar.getIsVisible();

    this.tabsMap.forEach((tab) => {
      if (tab.view.webContents.isDestroyed()) {
        return;
      }
      tab.view.setBounds(calculateTabBounds(bounds, isSidebarVisible));
    });
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.updateTabBounds();
    this._sideBar.updateBounds();
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  // Getter for topBar to access from main process
  get topBar(): TopBar {
    return this._topBar;
  }

  // Getter for all tabs as array
  get tabs(): Tab[] {
    return [...this.tabsMap.values()];
  }

  // Getter for baseWindow to access from Menu
  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }

  // Notify topbar that tabs have been updated
  notifyTabsUpdated(): void {
    if (this._topBar && !this._topBar.view.webContents.isDestroyed()) {
      this._topBar.view.webContents.send("tabs-updated");
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = await SettingsManager.getInstance().getSettings();
    this.shortcuts = this.settings.shortcuts;
  }

  async loadShortcuts(): Promise<void> {
    await this.loadSettings();
  }

  // Register standard keyboard shortcuts on a WebContents
  registerKeyboardShortcuts(webContents: WebContents): void {
    registerKeyboardShortcuts(this, webContents);
  }

  // Bring TopBar and SideBar to the front of the stacking layer
  bringViewsToFront(): void {
    if (this._sideBar && !this._sideBar.view.webContents.isDestroyed()) {
      try {
        this._baseWindow.contentView.removeChildView(this._sideBar.view);
        this._baseWindow.contentView.addChildView(this._sideBar.view);
      } catch (e) {
        console.error("Failed to bring SideBar to front:", e);
      }
    }
    if (this._topBar && !this._topBar.view.webContents.isDestroyed()) {
      try {
        this._baseWindow.contentView.removeChildView(this._topBar.view);
        this._baseWindow.contentView.addChildView(this._topBar.view);
      } catch (e) {
        console.error("Failed to bring TopBar to front:", e);
      }
    }
  }
}
