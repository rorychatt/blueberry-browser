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
  X,
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

const getMatchScore = (text: string, query: string): number => {
  const target = text.toLowerCase();
  const search = query.toLowerCase();

  if (target === search) {
    return 100;
  }
  if (target.startsWith(search)) {
    return 80;
  }
  if (target.includes(search)) {
    return 60;
  }

  // Subsequence / Fuzzy match
  let searchIdx = 0;
  let matches = 0;
  for (let i = 0; i < target.length; i++) {
    if (target[i] === search[searchIdx]) {
      searchIdx++;
      matches++;
      if (searchIdx === search.length) {
        break;
      }
    }
  }

  if (matches === search.length) {
    return 40 - Math.min(20, target.length - search.length);
  }

  return 0;
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
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
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
    } else {
      setSelectedIndex(-1);
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

    // Score and filter history list based on query
    const scored = historyList
      .map((entry) => {
        const titleScore = entry.title ? getMatchScore(entry.title, lowerQuery) : 0;
        const urlScore = entry.url ? getMatchScore(entry.url, lowerQuery) : 0;
        return { entry, score: Math.max(titleScore, urlScore) };
      })
      .filter((item) => item.score > 0)
      .toSorted((a, b) => b.score - a.score);

    // De-duplicate matching URLs while preserving the sorted order
    const seenUrls = new Set<string>();
    const unique: HistoryEntry[] = [];
    for (const item of scored) {
      const entry = item.entry;
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

  // Dynamic topbar height management based on dropdown open states
  const isAutocompleteOpen = isFocused && (autocompleteSuggestions.length > 0 || !!url.trim());
  const isDropdownOpen = isHistoryDropdownOpen || isAutocompleteOpen;

  useEffect(() => {
    if (window.topBarAPI && window.topBarAPI.setHeight) {
      void window.topBarAPI.setHeight(isDropdownOpen ? 600 : 88);
    }
    return () => {
      if (window.topBarAPI && window.topBarAPI.setHeight) {
        void window.topBarAPI.setHeight(88);
      }
    };
  }, [isDropdownOpen]);

  const handleDeleteHistoryEntry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.historyAPI && window.historyAPI.deleteHistoryEntry) {
      try {
        const success = await window.historyAPI.deleteHistoryEntry(id);
        if (success) {
          setHistoryList((prev) => prev.filter((entry) => entry.id !== id));
        }
      } catch (error) {
        console.error("Error deleting history entry from autocomplete:", error);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();

    if (selectedIndex >= 0) {
      if (selectedIndex < autocompleteSuggestions.length) {
        const suggestion = autocompleteSuggestions[selectedIndex];
        void navigateToUrl(suggestion.url);
        setIsEditing(false);
        setIsFocused(false);
        setSelectedIndex(-1);
        (document.activeElement as HTMLElement)?.blur();
        return;
      } else if (url.trim() && selectedIndex === autocompleteSuggestions.length) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(url.trim())}`;
        void navigateToUrl(searchUrl);
        setIsEditing(false);
        setIsFocused(false);
        setSelectedIndex(-1);
        (document.activeElement as HTMLElement)?.blur();
        return;
      }
    }

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
    setSelectedIndex(-1);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setIsFocused(false);
      setSelectedIndex(-1);
      if (activeTab) {
        setUrl(activeTab.url || "");
      }
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const totalItems = autocompleteSuggestions.length + (url.trim() ? 1 : 0);
      if (totalItems > 0) {
        setSelectedIndex((prev) => {
          if (prev === totalItems - 1) {
            return -1;
          }
          return prev + 1;
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const totalItems = autocompleteSuggestions.length + (url.trim() ? 1 : 0);
      if (totalItems > 0) {
        setSelectedIndex((prev) => {
          if (prev === -1) {
            return totalItems - 1;
          }
          return prev - 1;
        });
      }
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
                setSelectedIndex(-1);
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
              {autocompleteSuggestions.map((suggestion, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={suggestion.id}
                    onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                    onClick={() => {
                      void navigateToUrl(suggestion.url);
                      setIsEditing(false);
                      setIsFocused(false);
                      setSelectedIndex(-1);
                    }}
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150",
                      "border border-transparent min-w-0",
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/20 border-primary/25 dark:border-primary/45 shadow-sm"
                        : "hover:bg-muted/60 dark:hover:bg-muted/30 hover:border-border/15",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="size-4 flex-shrink-0 flex items-center justify-center">
                        <Favicon src={getFaviconUrl(suggestion.url)} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={cn(
                            "text-xs font-semibold truncate text-foreground transition-colors",
                            isSelected ? "text-primary" : "group-hover:text-primary",
                          )}
                        >
                          {suggestion.title || "Untitled Page"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 truncate">
                          {suggestion.url}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center ml-2 flex-shrink-0 relative w-12 h-5 justify-end">
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded bg-muted dark:bg-muted/50 text-muted-foreground font-semibold tracking-wide transition-opacity duration-150",
                          isSelected ? "opacity-100" : "group-hover:opacity-0",
                        )}
                      >
                        History
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => handleDeleteHistoryEntry(e, suggestion.id)}
                        className={cn(
                          "absolute right-0 p-0.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10",
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          "transition-all duration-150 cursor-pointer",
                        )}
                        title="Remove from history"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Search Query Option */}
              {url.trim() && (
                <div
                  onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                  onClick={() => {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(url.trim())}`;
                    void navigateToUrl(searchUrl);
                    setIsEditing(false);
                    setIsFocused(false);
                    setSelectedIndex(-1);
                  }}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150",
                    "border border-transparent min-w-0 mt-0.5 border-t border-border/10 pt-2",
                    selectedIndex === autocompleteSuggestions.length
                      ? "bg-primary/10 dark:bg-primary/20 border-primary/25 dark:border-primary/45 shadow-sm"
                      : "hover:bg-muted/60 dark:hover:bg-muted/30 hover:border-border/15",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="size-4 flex-shrink-0 flex items-center justify-center text-primary">
                      <Search className="size-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-xs font-semibold truncate text-foreground transition-colors",
                          selectedIndex === autocompleteSuggestions.length
                            ? "text-primary"
                            : "group-hover:text-primary",
                        )}
                      >
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
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setIsEditing(false);
              setIsFocused(false);
              if (activeTab) {
                setUrl(activeTab.url || "");
              }
            }}
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
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsEditing(false);
            setIsFocused(false);
            if (activeTab) {
              setUrl(activeTab.url || "");
            }
          }}
          onClick={() => createTab("blueberry://settings")}
          className="hover:rotate-45 transition-transform duration-300"
        />
      </div>
    </div>
  );
};
