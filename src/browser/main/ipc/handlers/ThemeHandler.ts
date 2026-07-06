import type { WebContents } from "electron";
import { ipcMain } from "electron";
import { BaseHandler } from "./BaseHandler";

export class ThemeHandler extends BaseHandler {
  public register(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });

    // Primary color broadcasting
    ipcMain.on("primary-color-changed", (event, primaryColor) => {
      this.broadcastPrimaryColor(event.sender, primaryColor);
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to all tabs
    for (const tab of this.mainWindow.allTabs) {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    }
  }

  private broadcastPrimaryColor(sender: WebContents, primaryColor: string): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send("primary-color-updated", primaryColor);
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send("primary-color-updated", primaryColor);
    }

    // Send to all tabs
    for (const tab of this.mainWindow.allTabs) {
      if (tab.webContents !== sender) {
        tab.webContents.send("primary-color-updated", primaryColor);
      }
    }
  }
}
