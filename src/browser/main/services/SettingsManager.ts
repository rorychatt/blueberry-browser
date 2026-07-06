import { app } from "electron";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";

export interface ShortcutConfig {
  newTab: string;
  closeTab: string;
  reload: string;
  forceReload: string;
  toggleSidebar: string;
  goBack: string;
  goForward: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  newTab: "CmdOrCtrl+T",
  closeTab: "CmdOrCtrl+W",
  reload: "CmdOrCtrl+R",
  forceReload: "CmdOrCtrl+Shift+R",
  toggleSidebar: "CmdOrCtrl+E",
  goBack: "CmdOrCtrl+Left",
  goForward: "CmdOrCtrl+Right",
};

export interface AppSettings {
  shortcuts: ShortcutConfig;
  landingPage: string;
  theme: "light" | "dark" | "system";
  primaryColor?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  landingPage: "https://www.google.com",
  theme: "system",
  primaryColor: "#4361ee",
};

export class SettingsManager {
  private static instance: SettingsManager | null = null;
  private readonly filePath: string;
  private settings: AppSettings | null = null;

  private constructor() {
    // Save settings inside the userData directory of the app
    const userDataPath = app.getPath("userData");
    this.filePath = join(userDataPath, "settings.json");
    this.loadSettingsSync();
  }

  private loadSettingsSync(): void {
    try {
      const data = readFileSync(this.filePath, "utf8");
      const config = JSON.parse(data);
      this.settings = {
        shortcuts: { ...DEFAULT_SHORTCUTS, ...config.shortcuts },
        landingPage: config.landingPage || "https://www.google.com",
        theme: config.theme || "system",
        primaryColor: config.primaryColor || "#4361ee",
      };
    } catch {
      // File doesn't exist or is invalid, use defaults
      this.settings = {
        shortcuts: { ...DEFAULT_SHORTCUTS },
        landingPage: "https://www.google.com",
        theme: "system",
        primaryColor: "#4361ee",
      };
    }
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public async getSettings(): Promise<AppSettings> {
    if (!this.settings) {
      this.loadSettingsSync();
    }
    return this.settings!;
  }

  public getSettingsSync(): AppSettings {
    if (!this.settings) {
      this.loadSettingsSync();
    }
    return this.settings!;
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = settings;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  public async getShortcuts(): Promise<ShortcutConfig> {
    const settings = await this.getSettings();
    return settings.shortcuts;
  }

  public async saveShortcuts(shortcuts: ShortcutConfig): Promise<void> {
    const settings = await this.getSettings();
    settings.shortcuts = shortcuts;
    await this.saveSettings(settings);
  }
}

/**
 * Match a shortcut string (e.g. "CmdOrCtrl+T") against an Electron input event.
 */
export function matchShortcut(
  shortcutStr: string,
  input: {
    key: string;
    code: string;
    control: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  },
): boolean {
  const parts = shortcutStr.toLowerCase().split("+");
  let wantsCtrl = false;
  let wantsCmd = false;
  let wantsShift = false;
  let wantsAlt = false;
  let wantsKey = "";

  for (const part of parts) {
    if (part === "cmdorctrl") {
      if (process.platform === "darwin") {
        wantsCmd = true;
      } else {
        wantsCtrl = true;
      }
    } else if (part === "cmd" || part === "command") {
      wantsCmd = true;
    } else if (part === "ctrl" || part === "control") {
      wantsCtrl = true;
    } else if (part === "shift") {
      wantsShift = true;
    } else if (part === "alt" || part === "option") {
      wantsAlt = true;
    } else {
      wantsKey = part;
    }
  }

  // Check modifiers
  const hasCtrl = input.control;
  const hasCmd = input.meta;
  const hasShift = input.shift;
  const hasAlt = input.alt;

  if (wantsCtrl !== hasCtrl) return false;
  if (wantsCmd !== hasCmd) return false;
  if (wantsShift !== hasShift) return false;
  if (wantsAlt !== hasAlt) return false;

  // Check key (handling arrow keys and case differences)
  const inputKey = input.key.toLowerCase();
  if (wantsKey === "left" || wantsKey === "arrowleft") {
    return inputKey === "arrowleft";
  }
  if (wantsKey === "right" || wantsKey === "arrowright") {
    return inputKey === "arrowright";
  }
  if (wantsKey === "up" || wantsKey === "arrowup") {
    return inputKey === "arrowup";
  }
  if (wantsKey === "down" || wantsKey === "arrowdown") {
    return inputKey === "arrowdown";
  }
  return inputKey === wantsKey;
}
