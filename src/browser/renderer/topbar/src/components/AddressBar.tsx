import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Settings,
  History,
} from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { ToolBarButton } from "../components/ToolBarButton";
import { Favicon } from "../components/Favicon";
import { HistoryDropdown } from "./HistoryDropdown";
import { cn } from "@common/lib/utils";

export const AddressBar: React.FC = () => {
  const { activeTab, navigateToUrl, goBack, goForward, reload, isLoading, createTab } =
    useBrowser();
  const [url, setUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);

  // Update URL when active tab changes
  useEffect(() => {
    if (activeTab && !isEditing) {
      setUrl(activeTab.url || "");
    }
  }, [activeTab, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      return;
    }

    let finalUrl = url.trim();

    // Add protocol if missing
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      if (finalUrl.startsWith("blueberry://")) {
        // Allow internal protocol
      } else if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
        finalUrl = `https://${finalUrl}`;
      } else {
        // Treat as search query
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      }
    }

    void navigateToUrl(finalUrl);
    setIsEditing(false);
    setIsFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setIsFocused(false);
    // Reset to current tab URL if editing was cancelled
    if (activeTab) {
      setUrl(activeTab.url || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setIsFocused(false);
      if (activeTab) {
        setUrl(activeTab.url || "");
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const canGoBack = activeTab ? !!activeTab.canGoBack : false;
  const canGoForward = activeTab ? !!activeTab.canGoForward : false;

  // Extract domain and title for display
  const getDomain = () => {
    if (!activeTab?.url) {
      return "";
    }
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return activeTab.url;
    }
  };

  const getPath = () => {
    if (!activeTab?.url) {
      return "";
    }
    try {
      const urlObj = new URL(activeTab.url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return "";
    }
  };

  const getFavicon = () => {
    if (!activeTab?.url) {
      return null;
    }
    try {
      const domain = new URL(activeTab.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    // Send IPC event to toggle sidebar
    if (window.topBarAPI) {
      void window.topBarAPI.toggleSidebar();
    }
  };

  return (
    <>
      {/* Navigation Controls */}
      <div className="flex gap-2 app-region-no-drag">
        <ToolBarButton Icon={ArrowLeft} onClick={goBack} active={canGoBack && !isLoading} />
        <ToolBarButton Icon={ArrowRight} onClick={goForward} active={canGoForward && !isLoading} />
        <ToolBarButton onClick={reload} active={activeTab !== null && !isLoading}>
          {isLoading ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
        </ToolBarButton>
      </div>

      {/* Address Bar */}
      {isFocused ? (
        // Expanded State
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-full app-region-no-drag">
          <div className="bg-background rounded-lg border border-primary/25 dark:border-primary/45 shadow-expanded ring-2 ring-primary/5 dark:ring-primary/15 h-8 px-2 flex items-center dark:bg-secondary">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full px-1 py-0 text-xs outline-none bg-transparent text-foreground truncate"
              placeholder={activeTab ? "Enter URL or search term" : "No active tab"}
              disabled={!activeTab}
              spellCheck={false}
              autoFocus
            />
          </div>
        </form>
      ) : (
        // Collapsed State
        <div
          onClick={handleFocus}
          className={cn(
            "flex-1 px-3 h-8 rounded-lg cursor-text group/address-bar",
            "bg-muted/35 dark:bg-muted/20 hover:bg-muted/65 dark:hover:bg-muted/40",
            "border border-border/30 dark:border-border/10",
            "app-region-no-drag transition-all duration-200",
            "flex items-center",
          )}
        >
          <div className="flex items-center w-full">
            {/* Favicon */}
            <div className="size-4 mr-2 flex-shrink-0 flex items-center justify-center">
              <Favicon src={getFavicon()} />
            </div>

            {/* URL Display */}
            <div className="text-xs leading-normal truncate flex-1 flex items-center">
              {activeTab ? (
                <>
                  <span className="text-foreground dark:text-foreground font-medium">
                    {getDomain()}
                  </span>
                  <span className="group-hover/address-bar:hidden text-muted-foreground/60 ml-1">
                    {activeTab.title && ` / ${activeTab.title}`}
                  </span>
                  <span className="group-hover/address-bar:inline hidden text-muted-foreground/60 ml-1">
                    {getPath()}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No active tab</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions Menu */}
      <div className="flex items-center gap-2 app-region-no-drag">
        <ToolBarButton
          Icon={isSidebarOpen ? PanelLeftClose : PanelLeft}
          onClick={toggleSidebar}
          toggled={isSidebarOpen}
        />
        <div className="relative">
          <ToolBarButton
            Icon={History}
            onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
            toggled={isHistoryDropdownOpen}
            className="hover:scale-105 transition-all duration-200"
          />
          {isHistoryDropdownOpen && (
            <HistoryDropdown onClose={() => setIsHistoryDropdownOpen(false)} />
          )}
        </div>
        <ToolBarButton
          Icon={Settings}
          onClick={() => createTab("blueberry://settings")}
          className="hover:rotate-45 transition-transform duration-300"
        />
      </div>
    </>
  );
};
