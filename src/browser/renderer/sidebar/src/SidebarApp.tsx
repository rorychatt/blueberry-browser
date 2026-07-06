import React, { useEffect, useState } from "react";
import { ChatProvider } from "./contexts/ChatContext";
import { Chat } from "./components/Chat";
import { TestRunner } from "./components/TestRunner";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { usePrimaryColor } from "@common/hooks/usePrimaryColor";
import { Sparkles, Terminal } from "lucide-react";
import { cn } from "@common/lib/utils";

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  usePrimaryColor();
  const [activeTab, setActiveTab] = useState<"chat" | "tests">("chat");

  // Apply dark mode class to the document
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="h-screen flex flex-col bg-background border-l border-border overflow-hidden">
      {/* Tab Navigation Bar */}
      <div className="m-3 mb-2 p-1 flex gap-1 rounded-lg border border-border/40 bg-muted/60 dark:bg-muted/30 backdrop-blur-md">
        <button
          onClick={() => {
            setActiveTab("chat");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold cursor-pointer transition-all duration-300 ease-out",
            activeTab === "chat"
              ? "bg-background text-primary shadow-md border border-border/40 font-bold scale-[1.02]"
              : "text-muted-foreground hover:bg-background/40 hover:text-foreground hover:scale-[1.01]",
          )}
        >
          <Sparkles className="size-3.5 transition-transform duration-300 group-hover:rotate-12" />
          AI Copilot
        </button>
        <button
          onClick={() => {
            setActiveTab("tests");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold cursor-pointer transition-all duration-300 ease-out",
            activeTab === "tests"
              ? "bg-background text-primary shadow-md border border-border/40 font-bold scale-[1.02]"
              : "text-muted-foreground hover:bg-background/40 hover:text-foreground hover:scale-[1.01]",
          )}
        >
          <Terminal className="size-3.5" />
          E2E Tests
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-hidden min-h-0 px-3 pb-3">
        <div className="h-full rounded-xl border border-border/40 bg-background dark:bg-card/25 shadow-sm overflow-hidden">
          {activeTab === "chat" ? <Chat /> : <TestRunner />}
        </div>
      </div>
    </div>
  );
};

export const SidebarApp: React.FC = () => (
  <ChatProvider>
    <SidebarContent />
  </ChatProvider>
);
