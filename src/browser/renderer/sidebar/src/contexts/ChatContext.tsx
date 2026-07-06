import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type {
  MessageContentPart,
  PreloadChatMessage,
  PreloadChatSession,
} from "../../../common/types/preload";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;

  // Chat actions
  sendMessage: (content: string) => Promise<void>;
  stopExecution: () => Promise<void>;
  clearChat: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Chat History
  sessions: PreloadChatSession[];
  currentSessionId: string | null;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<PreloadChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load initial messages and session ID from main process
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const activeId = await window.sidebarAPI.getCurrentSessionId();
        setCurrentSessionId(activeId);

        const storedMessages = await window.sidebarAPI.getMessages();
        if (storedMessages && storedMessages.length > 0) {
          const convertedMessages = storedMessages.map(
            (msg: PreloadChatMessage, index: number) => ({
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : msg.content.find((p: MessageContentPart) => p.type === "text")?.text || "",
              id: `msg-${index}`,
              isStreaming: false,
              role: msg.role,
              timestamp: Date.now(),
            }),
          );
          setMessages(convertedMessages);
        }
      } catch (error) {
        console.error("Failed to load initial chat state:", error);
      }
    };
    void loadInitialState();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);

    try {
      const messageId = Date.now().toString();

      // Send message to main process (which will handle context)
      await window.sidebarAPI.sendChatMessage({
        message: content,
        messageId,
      });

      // Messages will be updated via the chat-messages-updated event
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopExecution = useCallback(async () => {
    try {
      await window.sidebarAPI.stopAgentExecution();
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to stop execution:", error);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const chatSessions = await window.sidebarAPI.getChatSessions();
      setSessions(chatSessions || []);
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await window.sidebarAPI.stopAgentExecution();
      setCurrentSessionId(id);
      const storedMessages = await window.sidebarAPI.loadChatSession(id);
      const convertedMessages = storedMessages.map((msg: PreloadChatMessage, index: number) => ({
        content:
          typeof msg.content === "string"
            ? msg.content
            : msg.content.find((p: MessageContentPart) => p.type === "text")?.text || "",
        id: `msg-${index}`,
        isStreaming: false,
        role: msg.role,
        timestamp: Date.now(),
      }));
      setMessages(convertedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await window.sidebarAPI.deleteChatSession(id);
        void loadSessions();
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [loadSessions],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await window.sidebarAPI.renameChatSession(id, title);
        void loadSessions();
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    },
    [loadSessions],
  );

  const clearChat = useCallback(async () => {
    try {
      await window.sidebarAPI.stopAgentExecution();
      await window.sidebarAPI.clearChat();
      setMessages([]);
      setCurrentSessionId(null);
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  }, []);

  const getPageContent = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageContent();
    } catch (error) {
      console.error("Failed to get page content:", error);
      return null;
    }
  }, []);

  const getPageText = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageText();
    } catch (error) {
      console.error("Failed to get page text:", error);
      return null;
    }
  }, []);

  const getCurrentUrl = useCallback(async () => {
    try {
      return await window.sidebarAPI.getCurrentUrl();
    } catch (error) {
      console.error("Failed to get current URL:", error);
      return null;
    }
  }, []);

  // Set up message listeners
  useEffect(() => {
    // Listen for streaming response updates
    const handleChatResponse = (data: {
      messageId: string;
      content: string;
      isComplete: boolean;
    }) => {
      if (data.isComplete) {
        setIsLoading(false);
      }
    };

    // Listen for message updates from main process
    const handleMessagesUpdated = async (updatedMessages: PreloadChatMessage[]) => {
      // Convert CoreMessage format to our frontend Message format
      const convertedMessages = updatedMessages.map((msg: PreloadChatMessage, index: number) => ({
        content:
          typeof msg.content === "string"
            ? msg.content
            : msg.content.find((p: MessageContentPart) => p.type === "text")?.text || "",
        id: `msg-${index}`,
        isStreaming: false,
        role: msg.role,
        timestamp: Date.now(),
      }));
      setMessages(convertedMessages);

      try {
        const activeId = await window.sidebarAPI.getCurrentSessionId();
        setCurrentSessionId(activeId);
      } catch (error) {
        console.error("Failed to sync current session ID:", error);
      }
    };

    window.sidebarAPI.onChatResponse(handleChatResponse);
    window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated);
    window.sidebarAPI.onChatSessionsUpdated(loadSessions);

    // Initial load of sessions
    void loadSessions();

    return () => {
      window.sidebarAPI.removeChatResponseListener();
      window.sidebarAPI.removeMessagesUpdatedListener();
      window.sidebarAPI.removeChatSessionsUpdatedListener();
    };
  }, [loadSessions]);

  const value: ChatContextType = {
    clearChat,
    getCurrentUrl,
    getPageContent,
    getPageText,
    isLoading,
    messages,
    sendMessage,
    stopExecution,
    sessions,
    currentSessionId,
    loadSession,
    deleteSession,
    renameSession,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
