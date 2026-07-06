import { ipcMain } from "electron";
import { BaseHandler } from "./BaseHandler";
import { ChatHistoryManager } from "../../services/ChatHistoryManager";

export class SidebarHandler extends BaseHandler {
  public register(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });

    // Get current session ID
    ipcMain.handle("sidebar-get-current-session-id", () => {
      return this.mainWindow.sidebar.client.getCurrentSessionId();
    });

    // Get chat sessions list
    ipcMain.handle("sidebar-get-chat-sessions", async () => {
      return ChatHistoryManager.getInstance().getSessions();
    });

    // Load a chat session
    ipcMain.handle("sidebar-load-chat-session", async (_, id) => {
      return this.mainWindow.sidebar.client.loadSession(id);
    });

    // Delete a chat session
    ipcMain.handle("sidebar-delete-chat-session", async (_, id) => {
      const deleted = await ChatHistoryManager.getInstance().deleteSession(id);
      // If the deleted session was the currently active one, start a fresh chat session
      if (deleted && this.mainWindow.sidebar.client.getCurrentSessionId() === id) {
        this.mainWindow.sidebar.client.clearMessages();
      }
      return deleted;
    });

    // Rename a chat session
    ipcMain.handle("sidebar-rename-chat-session", async (_, { id, title }) => {
      const success = await ChatHistoryManager.getInstance().renameSession(id, title);
      if (success && this.mainWindow.sidebar.client.getCurrentSessionId() === id) {
        this.mainWindow.sidebar.client.setSessionTitle(title);
      }
      return success;
    });
  }
}
