import React, { useEffect, useRef, useState } from "react";
import { Clock, Search, Sparkles, X, ArrowRight, Loader2, ExternalLink, Globe } from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { Favicon } from "./Favicon";
import { cn } from "@common/lib/utils";
import type { HistoryEntry, HistorySuggestion } from "../../../common/types/preload";

interface HistoryDropdownProps {
  onClose: () => void;
}

// Move utility functions outside component to satisfy unicorn consistent-function-scoping rules
const getFaviconUrl = (urlStr: string) => {
  try {
    const hostname = new URL(urlStr).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
};

const formatUrlDomain = (urlStr: string) => {
  try {
    return new URL(urlStr).hostname.replace("www.", "");
  } catch {
    return urlStr;
  }
};

export const HistoryDropdown: React.FC<HistoryDropdownProps> = ({ onClose }) => {
  const { activeTab, navigateToUrl, createTab } = useBrowser();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const activeUrl = activeTab?.url;
  const activeTitle = activeTab?.title;

  // Load history from API on mount
  useEffect(() => {
    const loadSuggestionsData = async (historyList: HistoryEntry[]) => {
      if (window.historyAPI && window.historyAPI.getHistorySuggestions) {
        setLoadingSuggestions(true);
        try {
          const currentContext = activeUrl ? { url: activeUrl, title: activeTitle || "" } : null;
          const res = await window.historyAPI.getHistorySuggestions(historyList, currentContext);
          setSuggestions(res.suggestions || []);
        } catch (error) {
          console.error("Error fetching history suggestions:", error);
        } finally {
          setLoadingSuggestions(false);
        }
      } else {
        setLoadingSuggestions(false);
      }
    };

    const loadHistoryData = async () => {
      if (window.historyAPI && window.historyAPI.getHistory) {
        try {
          const list = await window.historyAPI.getHistory();
          const sorted = (list || []).toSorted((a, b) => b.timestamp - a.timestamp);
          setHistory(sorted);
          setFilteredHistory(sorted);

          // Get Suggestions based on loaded history list
          await loadSuggestionsData(sorted);
        } catch (error) {
          console.error("Error fetching history:", error);
          setLoadingSuggestions(false);
        }
      } else {
        setLoadingSuggestions(false);
      }
    };

    void loadHistoryData();
  }, [activeUrl, activeTitle]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Handle local searching
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredHistory(history);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = history.filter(
      (entry) =>
        (entry.title && entry.title.toLowerCase().includes(lowerQuery)) ||
        (entry.url && entry.url.toLowerCase().includes(lowerQuery)),
    );
    setFilteredHistory(filtered);
  };

  // Delete individual entry
  const handleDeleteEntry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent navigation click
    if (window.historyAPI && window.historyAPI.deleteHistoryEntry) {
      try {
        const success = await window.historyAPI.deleteHistoryEntry(id);
        if (success) {
          const updated = history.filter((entry) => entry.id !== id);
          setHistory(updated);
          setFilteredHistory(
            searchQuery
              ? updated.filter(
                  (entry) =>
                    (entry.title &&
                      entry.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (entry.url && entry.url.toLowerCase().includes(searchQuery.toLowerCase())),
                )
              : updated,
          );
        }
      } catch (error) {
        console.error("Error deleting history entry:", error);
      }
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    if (
      window.confirm("Are you sure you want to clear your entire browsing history?") &&
      window.historyAPI &&
      window.historyAPI.clearHistory
    ) {
      try {
        const success = await window.historyAPI.clearHistory();
        if (success) {
          setHistory([]);
          setFilteredHistory([]);
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error clearing history:", error);
      }
    }
  };

  const handleEntryClick = (urlStr: string) => {
    void navigateToUrl(urlStr);
    onClose();
  };

  const handleSuggestionClick = (urlStr: string) => {
    void navigateToUrl(urlStr);
    onClose();
  };

  const openFullHistory = () => {
    void createTab("blueberry://settings#history");
    onClose();
  };

  // Show top 5 history entries in dropdown
  const recentEntries = filteredHistory.slice(0, 5);

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute right-0 top-10 z-50 p-4 w-96 rounded-2xl flex flex-col gap-3.5",
        "border border-border/40 backdrop-blur-xl bg-card/95 dark:bg-card/90 shadow-2xl text-foreground text-left",
        "animate-in fade-in slide-in-from-top-2 duration-200 ease-out",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4.5 text-primary" />
          <h3 className="text-sm font-bold tracking-tight">Browsing History</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search recent history..."
          value={searchQuery}
          onChange={handleSearchChange}
          className={cn(
            "w-full pl-9 pr-8 py-1.5 text-xs rounded-lg outline-none bg-muted/40",
            "border border-border/20 focus:border-primary/40 focus:ring-1 focus:ring-primary/10",
            "transition-all duration-200",
          )}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setFilteredHistory(history);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* History Items Section */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider pl-1">
          Recent Visits
        </span>
        {recentEntries.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground/50 border border-dashed border-border/20 rounded-lg">
            {searchQuery ? "No matching history found" : "No recent history"}
          </div>
        ) : (
          recentEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleEntryClick(entry.url)}
              className={cn(
                "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200",
                "hover:bg-muted/60 dark:hover:bg-muted/30 border border-transparent hover:border-border/20",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="size-4 flex-shrink-0 flex items-center justify-center">
                  <Favicon src={getFaviconUrl(entry.url)} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                    {entry.title || "Untitled Page"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 truncate">
                    {formatUrlDomain(entry.url)}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteEntry(e, entry.id)}
                className={cn(
                  "p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10",
                  "opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer",
                )}
                title="Delete entry"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Divider */}
      <hr className="border-border/30" />

      {/* Agentic Suggestions Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
              Smart AI Suggestions
            </span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wide">
            HistoryAgent
          </span>
        </div>

        {loadingSuggestions ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 border border-border/20 rounded-xl bg-muted/20">
            <Loader2 className="size-5 text-primary animate-spin" />
            <span className="text-[11px] font-medium text-muted-foreground/80 animate-pulse">
              Pattern analysis in progress...
            </span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground/50 border border-dashed border-border/20 rounded-lg">
            Keep browsing to construct local suggestions context.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.slice(0, 3).map((suggestion) => (
              <div
                key={`${suggestion.url}-${suggestion.title}`}
                onClick={() => handleSuggestionClick(suggestion.url)}
                className={cn(
                  "group relative p-2.5 rounded-xl cursor-pointer transition-all duration-300",
                  "bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10",
                  "border border-primary/10 hover:border-primary/25 hover:shadow-md",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="size-5 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">
                    {suggestion.type === "search" ? (
                      <Search className="size-3" />
                    ) : (
                      <Globe className="size-3" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      {suggestion.title}
                      <ArrowRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 leading-relaxed mt-0.5">
                      {suggestion.reason}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
        {history.length > 0 ? (
          <button
            onClick={handleClearAll}
            className="text-[11px] text-muted-foreground/60 hover:text-destructive transition-colors font-medium cursor-pointer"
          >
            Clear History
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={openFullHistory}
          className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
        >
          View Full History
          <ExternalLink className="size-3" />
        </button>
      </div>
    </div>
  );
};
