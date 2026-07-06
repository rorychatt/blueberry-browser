import React, { useEffect } from "react";
import { ChatProvider } from "./contexts/ChatContext";
import { Chat } from "./components/Chat";
import { useDarkMode } from "@common/hooks/useDarkMode";

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();

  // Apply dark mode class to the document
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="h-screen flex flex-col bg-background border-l border-border">
      <Chat />
    </div>
  );
};

export const SidebarApp: React.FC = () => (
  <ChatProvider>
    <SidebarContent />
  </ChatProvider>
);
