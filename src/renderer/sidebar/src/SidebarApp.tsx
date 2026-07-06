import React, { useEffect, useState } from "react";
import { ChatProvider } from "./contexts/ChatContext";
import { Chat } from "./components/Chat";
import { TestRunner } from "./components/TestRunner";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { Sparkles, Terminal } from "lucide-react";
import { cn } from "@common/lib/utils";

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState<"chat" | "tests">("chat");

  // Apply dark mode class to the document
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="h-screen flex flex-col bg-background border-l border-border overflow-hidden">
      {/* Tab Navigation Bar */}
      <div className="flex p-2 gap-1 border-b border-border bg-muted/20 dark:bg-muted/5 backdrop-blur-md">
        <button
          onClick={() => {
            setActiveTab("chat");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200",
            activeTab === "chat"
              ? "bg-background text-primary shadow-sm border border-border/50"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
        >
          <Sparkles className="size-3.5" />
          AI Copilot
        </button>
        <button
          onClick={() => {
            setActiveTab("tests");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200",
            activeTab === "tests"
              ? "bg-background text-primary shadow-sm border border-border/50"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
        >
          <Terminal className="size-3.5" />
          E2E Tests
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === "chat" ? <Chat /> : <TestRunner />}
      </div>
    </div>
  );
};

export const SidebarApp: React.FC = () => (
  <ChatProvider>
    <SidebarContent />
  </ChatProvider>
);
