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
    const bounds = this.baseWindow.getBounds();
    if (this.isVisible) {
      this.webContentsView.setBounds({
        height: bounds.height - 88, // Subtract topbar height
        width: 400,
        x: bounds.width - 400, // 400px width sidebar on the right
        y: 88, // Start below the topbar
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
