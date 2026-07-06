import { is } from "@electron-toolkit/utils";
import type { BaseWindow } from "electron";
import { WebContentsView, nativeTheme } from "electron";
import { join } from "node:path";
import { SettingsManager } from "../services/SettingsManager";

export class TopBar {
  private readonly webContentsView: WebContentsView;
  private readonly baseWindow: BaseWindow;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();

    // Listen to native theme changes to update topbar background when at normal height
    nativeTheme.on("updated", () => {
      this.updateBackgroundColor();
    });
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

    // Set background color to solid initially to prevent transparent overlay artifacts and color bleeding
    webContentsView.setBackgroundColor(this.getBackgroundColor());

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

    // Use transparent background ONLY when the height is expanded (so dropdown is open)
    // When the topbar is at its normal height (88), use a solid color to prevent
    // any transparent compositing artifacts, ghosting when closing tabs, or subpixel rendering black lines.
    if (height > 88) {
      this.webContentsView.setBackgroundColor("#00000000");
    } else {
      this.webContentsView.setBackgroundColor(this.getBackgroundColor());
    }

    this.setupBounds();
  }

  updateBounds(): void {
    this.setupBounds();
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  private getBackgroundColor(): string {
    try {
      const theme = SettingsManager.getInstance().getSettingsSync().theme;
      const isDark = theme === "dark" || (theme === "system" && nativeTheme.shouldUseDarkColors);
      return isDark ? "#141414" : "#ffffff";
    } catch {
      return "#ffffff";
    }
  }

  public updateBackgroundColor(): void {
    if (this.currentHeight === 88 && !this.webContentsView.webContents.isDestroyed()) {
      this.webContentsView.setBackgroundColor(this.getBackgroundColor());
    }
  }

  public updateThemeBackground(isDarkMode: boolean): void {
    if (this.currentHeight === 88 && !this.webContentsView.webContents.isDestroyed()) {
      this.webContentsView.setBackgroundColor(isDarkMode ? "#141414" : "#ffffff");
    }
  }
}
