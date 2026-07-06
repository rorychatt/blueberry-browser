import { app } from "electron";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

export class HistoryManager {
  private static instance: HistoryManager | null = null;
  private readonly filePath: string;
  private history: HistoryEntry[] = [];

  private constructor() {
    // Save history inside the userData directory of the app
    const userDataPath = app.getPath("userData");
    this.filePath = join(userDataPath, "history.json");
    this.loadHistorySync();
  }

  private loadHistorySync(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, "utf8");
        this.history = JSON.parse(data) || [];
      } else {
        this.history = [];
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      this.history = [];
    }
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  public async getHistory(): Promise<HistoryEntry[]> {
    return this.history;
  }

  public getHistorySync(): HistoryEntry[] {
    return this.history;
  }

  public async addHistoryEntry(url: string, title: string): Promise<HistoryEntry | null> {
    // Basic validation
    if (
      !url ||
      url === "about:blank" ||
      url === "blueberry://settings" ||
      url.startsWith("chrome://") ||
      url.startsWith("devtools://")
    ) {
      return null;
    }

    const trimmedUrl = url.trim();
    const trimmedTitle = title ? title.trim() : "";

    // 1. Avoid consecutive duplicate entries for the same URL in a very short window (e.g., 30s)
    // Or if the URL is identical, we can just update its title if the title changed or is more specific!
    const recentEntry = this.history[0]; // history is sorted from newest (index 0) to oldest
    const now = Date.now();

    if (recentEntry && recentEntry.url === trimmedUrl) {
      // If it's within 30 seconds or if we're updating a placeholder title (like "New Tab" or "")
      const isPlaceholder =
        recentEntry.title === "New Tab" ||
        recentEntry.title === "" ||
        recentEntry.title === trimmedUrl;
      const isRecent = now - recentEntry.timestamp < 30000;

      if (isRecent || (isPlaceholder && trimmedTitle && trimmedTitle !== "New Tab")) {
        recentEntry.title = trimmedTitle || recentEntry.title;
        recentEntry.timestamp = now; // Update timestamp to keep it at the top
        await this.saveHistory();
        return recentEntry;
      }
    }

    // 2. Add as a new entry
    const entry: HistoryEntry = {
      id: `hist-${now}-${Math.random().toString(36).substring(2, 7)}`,
      url: trimmedUrl,
      title: trimmedTitle || "New Tab",
      timestamp: now,
    };

    // Insert at the beginning of the array (newest first)
    this.history.unshift(entry);

    // Limit history entries to 1000 items
    if (this.history.length > 1000) {
      this.history = this.history.slice(0, 1000);
    }

    await this.saveHistory();
    return entry;
  }

  public async deleteHistoryEntry(id: string): Promise<boolean> {
    const initialLength = this.history.length;
    this.history = this.history.filter((entry) => entry.id !== id);
    if (this.history.length !== initialLength) {
      await this.saveHistory();
      return true;
    }
    return false;
  }

  public async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveHistory();
  }

  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.history, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }
}
