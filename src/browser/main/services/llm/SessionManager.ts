import type { WebContents } from "electron";
import type { ModelMessage } from "ai";
import { ChatHistoryManager } from "../ChatHistoryManager";

export class SessionManager {
  private readonly webContents: WebContents;
  private messages: ModelMessage[] = [];
  private currentSessionId: string | null = null;
  private sessionTitle: string | null = null;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  public getMessagesList(): ModelMessage[] {
    return this.messages;
  }

  public setMessagesList(messages: ModelMessage[]): void {
    this.messages = messages;
    this.sendMessagesToRenderer();
  }

  public addMessage(message: ModelMessage): void {
    this.messages.push(message);
    this.sendMessagesToRenderer();
  }

  public updateMessage(index: number, message: ModelMessage): void {
    this.messages[index] = message;
    this.sendMessagesToRenderer();
  }

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public getSessionTitle(): string | null {
    return this.sessionTitle;
  }

  public setSessionTitle(title: string): void {
    this.sessionTitle = title;
  }

  public async initializeSession(): Promise<void> {
    try {
      const history = ChatHistoryManager.getInstance();
      const sessions = await history.getSessions();
      if (sessions.length > 0) {
        const latest = sessions[0];
        const fullSession = await history.getSession(latest.id);
        if (fullSession) {
          this.currentSessionId = fullSession.id;
          this.sessionTitle = fullSession.title;
          this.messages = fullSession.messages;
          this.sendMessagesToRenderer();
          return;
        }
      }
    } catch (error) {
      console.error("[SessionManager] Failed to load latest session:", error);
    }
    this.startNewSession();
  }

  public startNewSession(): void {
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.sessionTitle = null;
    this.messages = [];
    this.sendMessagesToRenderer();
    this.webContents.send("chat-sessions-updated");
  }

  public async loadSession(id: string): Promise<ModelMessage[]> {
    const history = ChatHistoryManager.getInstance();
    const session = await history.getSession(id);
    if (session) {
      this.currentSessionId = session.id;
      this.sessionTitle = session.title;
      this.messages = session.messages;
      this.sendMessagesToRenderer();
      return this.messages;
    }
    throw new Error(`Session ${id} not found`);
  }

  public async saveCurrentSession(): Promise<void> {
    if (!this.currentSessionId || this.messages.length === 0) {
      return;
    }

    if (!this.sessionTitle) {
      const firstUserMsg = this.messages.find((m) => m.role === "user");
      let rawTitle = "New Chat";
      if (firstUserMsg && typeof firstUserMsg.content === "string") {
        rawTitle = firstUserMsg.content;
      } else if (firstUserMsg && Array.isArray(firstUserMsg.content)) {
        const textPart = firstUserMsg.content.find(
          (p) => typeof p === "object" && p && "type" in p && p.type === "text",
        );
        if (textPart) {
          rawTitle = textPart.text;
        }
      }
      this.sessionTitle = rawTitle.trim().substring(0, 40) || "New Chat";
    }

    try {
      const history = ChatHistoryManager.getInstance();
      await history.saveSession({
        id: this.currentSessionId,
        title: this.sessionTitle,
        messages: this.messages,
        updatedAt: Date.now(),
      });
      this.webContents.send("chat-sessions-updated");
    } catch (error) {
      console.error("[SessionManager] Failed to save current session:", error);
    }
  }

  public sendMessagesToRenderer(): void {
    this.webContents.send("chat-messages-updated", this.messages);
    void this.saveCurrentSession();
  }
}
