import { ipcMain } from "electron";
import type { Window } from "../components/Window";
import type { IpcHandler } from "./handlers/BaseHandler";
import { TabHandler } from "./handlers/TabHandler";
import { SidebarHandler } from "./handlers/SidebarHandler";
import { PageContentHandler } from "./handlers/PageContentHandler";
import { ThemeHandler } from "./handlers/ThemeHandler";
import { SettingsHandler } from "./handlers/SettingsHandler";
import { HistoryHandler } from "./handlers/HistoryHandler";
import { E2ETestHandler } from "./handlers/E2ETestHandler";

export class EventManager {
  private readonly handlers: IpcHandler[];

  constructor(mainWindow: Window) {
    this.handlers = [
      new TabHandler(mainWindow),
      new SidebarHandler(mainWindow),
      new PageContentHandler(mainWindow),
      new ThemeHandler(mainWindow),
      new SettingsHandler(mainWindow),
      new HistoryHandler(mainWindow),
      new E2ETestHandler(mainWindow),
    ];

    // Simple ping register (for debug)
    ipcMain.on("ping", () => {
      console.log("pong");
    });

    // Register all domain-specific handlers
    for (const handler of this.handlers) {
      handler.register();
    }
  }

  // Clean up all handlers and event listeners
  public cleanup(): void {
    for (const handler of this.handlers) {
      if (handler.cleanup) {
        try {
          handler.cleanup();
        } catch (error) {
          console.error("Error during handler cleanup:", error);
        }
      }
    }
    ipcMain.removeAllListeners();
  }
}
