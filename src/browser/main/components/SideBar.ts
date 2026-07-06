import { is } from "@electron-toolkit/utils";
import type { BaseWindow } from "electron";
import { WebContentsView } from "electron";
import { join } from "node:path";
import { LLMClient } from "../services/LLMClient";

export class SideBar {
  private readonly webContentsView: WebContentsView;
  private readonly baseWindow: BaseWindow;
  private readonly llmClient: LLMClient;
  private isVisible: boolean = false;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();

    // Initialize LLM client
    this.llmClient = new LLMClient(this.webContentsView.webContents);
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "../preload/sidebar.mjs"),
        sandbox: false, // Need to disable sandbox for preload to work
      },
    });

    // Load the Sidebar React app
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      // In development, load through Vite dev server
      const sidebarUrl = new URL("/sidebar/", process.env.ELECTRON_RENDERER_URL);
      void webContentsView.webContents.loadURL(sidebarUrl.toString());
    } else {
      void webContentsView.webContents.loadFile(join(__dirname, "../renderer/sidebar.html"));
    }

    return webContentsView;
  }

  private setupBounds(): void {
    if (this.webContentsView.webContents.isDestroyed()) {
      return;
    }
    const bounds = this.baseWindow.getContentBounds();
    const GAP = 8;
    if (this.isVisible) {
      this.webContentsView.setBounds({
        height: bounds.height - 88 - 2 * GAP, // Subtract topbar height and vertical margins
        width: 400 - GAP, // Leave GAP on the right side of the sidebar
        x: bounds.width - 400, // Starts at bounds.width - 400, leaving GAP on the right (ends at bounds.width - GAP)
        y: 88 + GAP, // Start below the topbar with a gap
      });
    } else {
      this.webContentsView.setBounds({
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      });
    }
  }

  updateBounds(): void {
    this.setupBounds();
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  get client(): LLMClient {
    return this.llmClient;
  }

  show(): void {
    this.isVisible = true;
    this.setupBounds();
  }

  hide(): void {
    this.isVisible = false;
    if (this.webContentsView.webContents.isDestroyed()) {
      return;
    }
    this.webContentsView.setBounds({
      height: 0,
      width: 0,
      x: 0,
      y: 0,
    });
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }
}
