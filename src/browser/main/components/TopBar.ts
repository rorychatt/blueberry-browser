import { is } from "@electron-toolkit/utils";
import type { BaseWindow } from "electron";
import { WebContentsView } from "electron";
import { join } from "node:path";

export class TopBar {
  private readonly webContentsView: WebContentsView;
  private readonly baseWindow: BaseWindow;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "../preload/topbar.mjs"),
        sandbox: false, // Need to disable sandbox for preload to work
      },
    });

    // Load the TopBar React app
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      // In development, load through Vite dev server
      const topbarUrl = new URL("/topbar/", process.env.ELECTRON_RENDERER_URL);
      void webContentsView.webContents.loadURL(topbarUrl.toString());
    } else {
      void webContentsView.webContents.loadFile(join(__dirname, "../renderer/topbar.html"));
    }

    return webContentsView;
  }

  private currentHeight: number = 88;

  private setupBounds(): void {
    if (this.webContentsView.webContents.isDestroyed()) {
      return;
    }
    const bounds = this.baseWindow.getContentBounds();
    this.webContentsView.setBounds({
      height: this.currentHeight,
      width: bounds.width,
      x: 0,
      y: 0,
    });
  }

  setHeight(height: number): void {
    if (this.currentHeight === height) {
      return;
    }
    this.currentHeight = height;
    this.setupBounds();
  }

  updateBounds(): void {
    this.setupBounds();
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
