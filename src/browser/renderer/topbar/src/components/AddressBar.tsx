import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Settings,
  History,
  Search,
} from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { ToolBarButton } from "../components/ToolBarButton";
import { Favicon } from "../components/Favicon";
import { HistoryDropdown } from "./HistoryDropdown";
import { cn } from "@common/lib/utils";
import type { HistoryEntry } from "../../../common/types/preload";

const getFaviconUrl = (urlStr: string) => {
  try {
    const hostname = new URL(urlStr).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
};

export const AddressBar: React.FC = () => {
  const { activeTab, navigateToUrl, goBack, goForward, reload, isLoading, createTab } =
    useBrowser();
  const [url, setUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const addressBarRef = useRef<HTMLDivElement>(null);

  // Update URL when active tab changes
  useEffect(() => {
    if (activeTab && !isEditing) {
      setUrl(activeTab.url || "");
    }
  }, [activeTab, isEditing]);

  // Load history for autocomplete list when focused
  useEffect(() => {
    if (isFocused) {
      const fetchHistory = async () => {
        if (window.historyAPI && window.historyAPI.getHistory) {
          try {
            const list = await window.historyAPI.getHistory();
            setHistoryList(list || []);
          } catch (error) {
            console.error("Error loading autocomplete history:", error);
          }
        }
      };
      void fetchHistory();
    }
  }, [isFocused]);

  // Handle click outside entire address bar container safely to cancel editing state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressBarRef.current && !addressBarRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setIsFocused(false);
        if (activeTab) {
          setUrl(activeTab.url || "");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeTab]);

  // Compute matched autocomplete items
  const autocompleteSuggestions = useMemo(() => {
    if (!url.trim()) {
      return [];
    }
    const lowerQuery = url.toLowerCase();

    // Filter history matching title or URL
    const filtered = historyList.filter(
      (entry) =>
        (entry.title && entry.title.toLowerCase().includes(lowerQuery)) ||
        (entry.url && entry.url.toLowerCase().includes(lowerQuery)),
    );

    // De-duplicate matching URLs
    const seenUrls = new Set<string>();
    const unique: HistoryEntry[] = [];
    for (const entry of filtered) {
      try {
        const cleanUrl = new URL(entry.url).href;
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          unique.push(entry);
        }
      } catch {
        if (!seenUrls.has(entry.url)) {
          seenUrls.add(entry.url);
          unique.push(entry);
        }
      }
    }

    return unique.slice(0, 5); // Show top 5 matches
  }, [url, historyList]);

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
    <div
      ref={addressBarRef}
      className="flex-1 flex items-center justify-between gap-4 h-full relative"
    >
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
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-w-0 max-w-full app-region-no-drag relative"
        >
          <div className="bg-background rounded-lg border border-primary/25 dark:border-primary/45 shadow-expanded ring-2 ring-primary/5 dark:ring-primary/15 h-8 px-2 flex items-center dark:bg-secondary">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              className="w-full px-1 py-0 text-xs outline-none bg-transparent text-foreground truncate"
              placeholder={activeTab ? "Enter URL or search term" : "No active tab"}
              disabled={!activeTab}
              spellCheck={false}
              autoFocus
            />
          </div>

          {/* Autocomplete Dropdown under Input */}
          {isFocused && (autocompleteSuggestions.length > 0 || url.trim()) && (
            <div
              className={cn(
                "absolute left-0 right-0 top-full mt-1.5 z-50 p-1.5 rounded-xl flex flex-col gap-0.5",
                "border border-border/40 backdrop-blur-xl bg-card/95 dark:bg-card/90 shadow-2xl text-foreground text-left",
                "animate-in fade-in slide-in-from-top-1 duration-150 ease-out max-h-64 overflow-y-auto",
              )}
            >
              {autocompleteSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                  onClick={() => {
                    void navigateToUrl(suggestion.url);
                    setIsEditing(false);
                    setIsFocused(false);
                  }}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150",
                    "hover:bg-muted/60 dark:hover:bg-muted/30 border border-transparent hover:border-border/15 min-w-0",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="size-4 flex-shrink-0 flex items-center justify-center">
                      <Favicon src={getFaviconUrl(suggestion.url)} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                        {suggestion.title || "Untitled Page"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 truncate">
                        {suggestion.url}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted dark:bg-muted/50 text-muted-foreground font-semibold tracking-wide ml-2 flex-shrink-0">
                    History
                  </span>
                </div>
              ))}

              {/* Search Query Option */}
              {url.trim() && (
                <div
                  onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                  onClick={() => {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(url.trim())}`;
                    void navigateToUrl(searchUrl);
                    setIsEditing(false);
                    setIsFocused(false);
                  }}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150",
                    "hover:bg-muted/60 dark:hover:bg-muted/30 border border-transparent hover:border-border/15 min-w-0 mt-0.5 border-t border-border/10 pt-2",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="size-4 flex-shrink-0 flex items-center justify-center text-primary">
                      <Search className="size-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                        Search Google for &quot;{url}&quot;
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wide ml-2 flex-shrink-0">
                    Search
                  </span>
                </div>
              )}
            </div>
          )}
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
    </div>
  );
};
