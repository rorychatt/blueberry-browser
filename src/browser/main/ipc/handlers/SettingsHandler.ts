import { ipcMain } from "electron";
import { BaseHandler } from "./BaseHandler";
import { SettingsManager } from "../../services/SettingsManager";
export class SettingsHandler extends BaseHandler {
  public register(): void {
    // Get custom shortcuts
    ipcMain.handle("get-shortcuts", async () => {
      const shortcuts = await SettingsManager.getInstance().getShortcuts();
      return shortcuts;
    });

    // Save custom shortcuts
    ipcMain.handle("save-shortcuts", async (_, shortcuts) => {
      await SettingsManager.getInstance().saveShortcuts(shortcuts);
      // Reload shortcuts dynamically on the main window!
      await this.mainWindow.loadShortcuts();
      return true;
    });

    // Get all settings
    ipcMain.handle("get-settings", async () => {
      const settings = await SettingsManager.getInstance().getSettings();
      return settings;
    });

    // Save all settings
    ipcMain.handle("save-settings", async (_, settings) => {
      await SettingsManager.getInstance().saveSettings(settings);
      // Reload settings dynamically on the main window!
      await this.mainWindow.loadSettings();
      return true;
    });
  }
}
