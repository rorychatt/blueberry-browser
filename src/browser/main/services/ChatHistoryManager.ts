import { app } from "electron";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import type { ModelMessage } from "ai";

export interface ChatSession {
  id: string;
  title: string;
  messages: ModelMessage[];
  updatedAt: number;
}

export class ChatHistoryManager {
  private static instance: ChatHistoryManager | null = null;
  private readonly filePath: string;
  private sessions: ChatSession[] = [];

  private constructor() {
    // Save chat history inside the userData directory of the app
    const userDataPath = app.getPath("userData");
    this.filePath = join(userDataPath, "chat_history.json");
    this.loadHistorySync();
  }

  private loadHistorySync(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, "utf8");
        this.sessions = JSON.parse(data) || [];
      } else {
        this.sessions = [];
      }
    } catch (error) {
      console.error("[ChatHistoryManager] Failed to load chat history:", error);
      this.sessions = [];
    }
  }

  public static getInstance(): ChatHistoryManager {
    if (!ChatHistoryManager.instance) {
      ChatHistoryManager.instance = new ChatHistoryManager();
    }
    return ChatHistoryManager.instance;
  }

  public async getSessions(): Promise<ChatSession[]> {
    return this.sessions.toSorted((a, b) => b.updatedAt - a.updatedAt);
  }

  public async getSession(id: string): Promise<ChatSession | null> {
    const session = this.sessions.find((s) => s.id === id);
    return session || null;
  }

  public async saveSession(session: ChatSession): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      this.sessions[index] = {
        ...session,
        updatedAt: Date.now(), // Update timestamp on modification
      };
    } else {
      this.sessions.push(session);
    }
    await this.saveHistory();
  }

  public async renameSession(id: string, newTitle: string): Promise<boolean> {
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      session.title = newTitle;
      session.updatedAt = Date.now();
      await this.saveHistory();
      return true;
    }
    return false;
  }

  public async deleteSession(id: string): Promise<boolean> {
    const initialLength = this.sessions.length;
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.sessions.length !== initialLength) {
      await this.saveHistory();
      return true;
    }
    return false;
  }

  public async clearAllSessions(): Promise<void> {
    this.sessions = [];
    await this.saveHistory();
  }

  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.sessions, null, 2), "utf8");
    } catch (error) {
      console.error("[ChatHistoryManager] Failed to save chat history:", error);
    }
  }
}
