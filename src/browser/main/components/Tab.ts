import type { NativeImage } from "electron";
import { WebContentsView } from "electron";
import { is } from "@electron-toolkit/utils";
import { join } from "node:path";

export class Tab {
  private readonly webContentsView: WebContentsView;
  private readonly _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;
  private readonly onUpdate?: () => void;

  constructor(id: string, url: string = "https://www.google.com", onUpdate?: () => void) {
    this._id = id;
    this._url = url;
    this._title = "New Tab";
    this.onUpdate = onUpdate;

    // Create the WebContentsView for web content only
    this.webContentsView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "../preload/tab.mjs"),
        sandbox: false, // Need to disable sandbox for preload to work
        webSecurity: true,
      },
    });

    // Set up event listeners
    this.setupEventListeners();

    // Load the initial URL
    void this.loadURL(url);
  }

  private setupEventListeners(): void {
    // Update title when page title changes
    this.webContentsView.webContents.on("page-title-updated", (_, title) => {
      this._title = title;
      this.onUpdate?.();
    });

    // Update URL when navigation occurs
    this.webContentsView.webContents.on("did-navigate", (_, url) => {
      if (url.includes("/settings/") || url.includes("settings/index.html")) {
        this._url = "blueberry://settings";
      } else {
        this._url = url;
      }
      this.onUpdate?.();
    });

    this.webContentsView.webContents.on("did-navigate-in-page", (_, url) => {
      if (url.includes("/settings/") || url.includes("settings/index.html")) {
        this._url = "blueberry://settings";
      } else {
        this._url = url;
      }
      this.onUpdate?.();
    });
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get url(): string {
    return this._url;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  // Public methods
  show(): void {
    this._isVisible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this._isVisible = false;
    this.webContentsView.setVisible(false);
  }

  async screenshot(): Promise<NativeImage> {
    return this.webContentsView.webContents.capturePage();
  }

  async runJs(code: string): Promise<unknown> {
    return this.webContentsView.webContents.executeJavaScript(code);
  }

  async getTabHtml(): Promise<string> {
    const html = await this.runJs("document.documentElement.outerHTML");
    return html as string;
  }

  async getTabText(): Promise<string> {
    const text = await this.runJs("document.body.innerText || document.documentElement.innerText");
    return text as string;
  }

  async loadURL(url: string): Promise<void> {
    if (url === "blueberry://settings") {
      this._url = "blueberry://settings";
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        const settingsUrl = new URL("/settings/", process.env.ELECTRON_RENDERER_URL);
        return this.webContentsView.webContents.loadURL(settingsUrl.toString());
      } else {
        return this.webContentsView.webContents.loadFile(
          join(__dirname, "../renderer/settings/index.html"),
        );
      }
    }
    this._url = url;
    return this.webContentsView.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoBack()) {
      this.webContentsView.webContents.navigationHistory.goBack();
    }
  }

  // Go forward logic
  goForward(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoForward()) {
      this.webContentsView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.webContentsView.webContents.reload();
  }

  stop(): void {
    this.webContentsView.webContents.stop();
  }

  destroy(): void {
    this.webContentsView.webContents.close();
  }
}
