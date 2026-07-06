import React, { useEffect, useState } from "react";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { usePrimaryColor } from "@common/hooks/usePrimaryColor";
import {
  Keyboard,
  Undo2,
  Save,
  Info,
  Settings,
  KeyboardIcon,
  Check,
  Globe,
  Sun,
  Moon,
  Palette,
  Sliders,
  History,
  Search,
  Trash2,
  ExternalLink,
  Clock,
} from "lucide-react";

interface ShortcutConfig {
  newTab: string;
  closeTab: string;
  reload: string;
  forceReload: string;
  toggleSidebar: string;
  goBack: string;
  goForward: string;
}

interface AppSettings {
  shortcuts: ShortcutConfig;
  landingPage: string;
  theme: "light" | "dark" | "system";
  primaryColor?: string;
}

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

const SHORTCUT_LABELS: Record<keyof ShortcutConfig, { label: string; desc: string }> = {
  newTab: { label: "New Tab", desc: "Open a fresh web page tab" },
  closeTab: { label: "Close Tab", desc: "Close the currently active tab" },
  reload: { label: "Reload Page", desc: "Refresh the current webpage" },
  forceReload: { label: "Force Reload", desc: "Reload, bypassing the browser cache" },
  toggleSidebar: { label: "Toggle Sidebar", desc: "Show or hide the AI assistant panel" },
  goBack: { label: "Go Back", desc: "Navigate to the previous page in history" },
  goForward: { label: "Go Forward", desc: "Navigate to the next page in history" },
};

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  newTab: "CmdOrCtrl+T",
  closeTab: "CmdOrCtrl+W",
  reload: "CmdOrCtrl+R",
  forceReload: "CmdOrCtrl+Shift+R",
  toggleSidebar: "CmdOrCtrl+E",
  goBack: "CmdOrCtrl+Left",
  goForward: "CmdOrCtrl+Right",
};

const PREDEFINED_LANDING_PAGES: Record<string, { label: string; url: string; desc: string }> = {
  google: { label: "Google", url: "https://www.google.com", desc: "Standard search and navigate" },
  duckduckgo: {
    label: "DuckDuckGo",
    url: "https://duckduckgo.com",
    desc: "Privacy-first search engine",
  },
  github: { label: "GitHub", url: "https://github.com", desc: "Developer platform & repositories" },
  wikipedia: {
    label: "Wikipedia",
    url: "https://en.wikipedia.org",
    desc: "Free online encyclopedia",
  },
  youtube: { label: "YouTube", url: "https://www.youtube.com", desc: "Videos, streams & music" },
  hackernews: {
    label: "Hacker News",
    url: "https://news.ycombinator.com",
    desc: "Tech community social feed",
  },
};

export const SettingsApp: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { primaryColor, setPrimaryColor } = usePrimaryColor();
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null);
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "theming" | "shortcuts" | "about" | "history" | "shortcuts_legacy"
  >("general");

  // History state
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadHistory = async () => {
    if (window.historyAPI && window.historyAPI.getHistory) {
      try {
        const list = await window.historyAPI.getHistory();
        setHistoryList(list || []);
      } catch (err) {
        console.error("Failed to load history list:", err);
      }
    }
  };

  // Safe checks for platform and version info to prevent renderer crashes
  const platform = window.settingsAPI?.getPlatform ? window.settingsAPI.getPlatform() : "darwin";
  const versions = window.settingsAPI?.getVersions
    ? window.settingsAPI.getVersions()
    : { electron: "", chrome: "", node: "" };

  // General settings state
  const [landingPage, setLandingPage] = useState<string>("https://www.google.com");
  const [selectedLandingOption, setSelectedLandingOption] = useState<string>("google");
  const [customLandingUrl, setCustomLandingUrl] = useState<string>("");

  // URL hash navigation on mount
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#history") {
        setActiveTab("history");
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Fetch history when history tab is activated
  useEffect(() => {
    if (activeTab === "history") {
      void loadHistory();
    }
  }, [activeTab]);

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (window.settingsAPI && window.settingsAPI.getSettings) {
        try {
          const data = (await window.settingsAPI.getSettings()) as AppSettings;
          if (data) {
            if (data.shortcuts) {
              setShortcuts(data.shortcuts);
            } else {
              setShortcuts({ ...DEFAULT_SHORTCUTS });
            }
            const savedLanding = data.landingPage || "https://www.google.com";
            setLandingPage(savedLanding);

            // Determine matching predefined key
            const matchedKey = Object.keys(PREDEFINED_LANDING_PAGES).find(
              (key) => PREDEFINED_LANDING_PAGES[key].url === savedLanding,
            );
            if (matchedKey) {
              setSelectedLandingOption(matchedKey);
            } else {
              setSelectedLandingOption("custom");
              setCustomLandingUrl(savedLanding);
            }

            // Sync theme
            if (data.theme) {
              const isDark = data.theme === "dark";
              if (isDark !== isDarkMode) {
                toggleDarkMode();
              }
            }

            // Sync theme color
            if (data.primaryColor) {
              setPrimaryColor(data.primaryColor);
            }
          }
        } catch (err) {
          console.error("Failed to load full settings:", err);
          // Fallback to shortcuts-only
          void loadShortcutsFallback();
        }
      } else {
        void loadShortcutsFallback();
      }
    };

    const loadShortcutsFallback = async () => {
      if (window.settingsAPI) {
        const data = await window.settingsAPI.getShortcuts();
        setShortcuts(data as ShortcutConfig);
      } else {
        setShortcuts({ ...DEFAULT_SHORTCUTS });
      }
    };

    void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to keydown event when recording is active
  useEffect(() => {
    if (!recordingKey) return;

    const mapKey = (key: string): string => {
      if (key === " ") return "Space";
      if (key === "+") return "Plus";
      if (key.startsWith("Arrow")) return key.slice(5); // ArrowLeft -> Left
      if (key.length === 1) return key.toUpperCase();
      return key;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingKey(null);
        return;
      }

      // Check if it's only a modifier key
      const modifiers = ["Control", "Shift", "Alt", "Meta"];
      if (modifiers.includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) {
        parts.push("CmdOrCtrl");
      }
      if (e.shiftKey) {
        parts.push("Shift");
      }
      if (e.altKey) {
        parts.push("Alt");
      }

      const finalKey = mapKey(e.key);
      if (finalKey) {
        parts.push(finalKey);
        const newShortcutStr = parts.join("+");

        if (shortcuts) {
          setShortcuts({
            ...shortcuts,
            [recordingKey]: newShortcutStr,
          });
        }
        setRecordingKey(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [recordingKey, shortcuts]);

  const handleSave = async () => {
    if (!shortcuts) return;

    let finalLandingPage = landingPage;
    if (selectedLandingOption === "custom") {
      finalLandingPage = customLandingUrl.trim();
      if (finalLandingPage && !/^https?:\/\//i.test(finalLandingPage)) {
        finalLandingPage = "https://" + finalLandingPage;
      }
      if (!finalLandingPage) {
        finalLandingPage = "https://www.google.com";
      }
    } else {
      finalLandingPage = PREDEFINED_LANDING_PAGES[selectedLandingOption].url;
    }

    setLandingPage(finalLandingPage);

    const updatedSettings = {
      shortcuts,
      landingPage: finalLandingPage,
      theme: isDarkMode ? ("dark" as const) : ("light" as const),
      primaryColor: primaryColor,
    };

    if (window.settingsAPI && window.settingsAPI.saveSettings) {
      await window.settingsAPI.saveSettings(updatedSettings);
    } else if (window.settingsAPI) {
      await window.settingsAPI.saveShortcuts(shortcuts);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleRestoreDefaults = () => {
    if (activeTab === "shortcuts") {
      setShortcuts({ ...DEFAULT_SHORTCUTS });
    } else if (activeTab === "general") {
      setSelectedLandingOption("google");
      setCustomLandingUrl("");
    } else if (activeTab === "theming") {
      if (isDarkMode) {
        toggleDarkMode();
      }
      setPrimaryColor("#4361ee");
    }
  };

  if (!shortcuts) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm font-medium animate-pulse text-muted-foreground">
          Loading system preferences...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full select-none bg-background p-6 md:p-12 overflow-hidden transition-colors duration-300">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 dark:bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-primary/5 dark:bg-primary/5 blur-[130px] pointer-events-none" />

      {/* Main Glassmorphic Dashboard Window */}
      <div className="relative flex h-full w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border border-border/50 bg-card/70 backdrop-blur-xl shadow-2xl">
        {/* Left Navigation Panel */}
        <aside className="w-64 border-r border-border/30 bg-secondary/30 p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Settings className="size-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Blueberry</h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                System Preferences
              </p>
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "general"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Sliders className="size-4" />
              General Settings
            </button>

            <button
              onClick={() => setActiveTab("theming")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "theming"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Palette className="size-4" />
              Theming Settings
            </button>

            <button
              onClick={() => setActiveTab("shortcuts")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "shortcuts"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Keyboard className="size-4" />
              Keyboard Shortcuts
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "history"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <History className="size-4" />
              Browsing History
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "about"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Info className="size-4" />
              About Browser
            </button>
          </nav>

          {/* Quick Info Box in Sidebar */}
          <div className="mt-auto p-4 rounded-2xl border border-border/30 bg-card/30 text-[11px] text-muted-foreground">
            <span className="font-bold block text-foreground mb-1">Quick Tip:</span>
            Pressing standard shortcuts like{" "}
            <kbd className="px-1 border border-border rounded bg-secondary text-[9px] text-foreground">
              ⌘E
            </kbd>{" "}
            toggles the copilot sidebar immediately.
          </div>
        </aside>

        {/* Right Content Panel */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="px-8 py-6 border-b border-border/30 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {activeTab === "general"
                  ? "General Settings"
                  : activeTab === "theming"
                    ? "Theming Settings"
                    : activeTab === "shortcuts"
                      ? "Keyboard Shortcuts"
                      : activeTab === "history"
                        ? "Browsing History"
                        : "About Blueberry"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeTab === "general"
                  ? "Configure your home page preferences and general browser behaviors."
                  : activeTab === "theming"
                    ? "Configure your interface aesthetics, light/dark mode preference, and primary colors."
                    : activeTab === "shortcuts"
                      ? "Re-bind browser shortcuts to fully customize your browsing experience."
                      : activeTab === "history"
                        ? "Manage, search, or clear your local browsing logs and activity history."
                        : "Blueberry Browser build version and specifications."}
              </p>
            </div>

            {/* Notification / Toast Banner inside Header */}
            {isSaved && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400 animate-fade-in">
                <Check className="size-4" />
                <span className="text-xs font-semibold">Changes applied instantly!</span>
              </div>
            )}
          </header>

          {/* Scrollable View Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {activeTab === "general" && (
              <div className="flex flex-col gap-8">
                {/* Default Landing Page */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Default Landing Page
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose which webpage opens when you launch the browser, create a fresh tab, or
                    click the new tab plus button.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {/* Predefined choices */}
                    {Object.entries(PREDEFINED_LANDING_PAGES).map(([key, item]) => {
                      const isSelected = selectedLandingOption === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setSelectedLandingOption(key)}
                          className={`flex flex-col p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                            isSelected
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {key.slice(0, 3)}
                            </span>
                            <span className="font-bold text-sm truncate">{item.label}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground mt-1 leading-normal">
                            {item.desc}
                          </span>
                        </div>
                      );
                    })}

                    {/* Custom URL Option Card */}
                    <div
                      onClick={() => setSelectedLandingOption("custom")}
                      className={`flex flex-col p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                        selectedLandingOption === "custom"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 shrink-0" />
                        <span className="font-bold text-sm">Custom URL</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 leading-normal">
                        Type any website URL you want to set.
                      </span>
                    </div>
                  </div>

                  {/* Animated Expandable Custom URL Input Field */}
                  {selectedLandingOption === "custom" && (
                    <div className="mt-3 p-4 rounded-2xl border border-primary/20 bg-primary/5 text-primary animate-fade-in flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Custom Website Address
                      </label>
                      <div className="relative flex items-center">
                        <Globe className="absolute left-4 size-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={customLandingUrl}
                          onChange={(e) => setCustomLandingUrl(e.target.value)}
                          placeholder="e.g. google.com, wikipedia.org, github.com"
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 shadow-inner"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                        Note: If `http://` or `https://` is omitted, `https://` will be prepended
                        automatically upon saving.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions Bar inside content */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border/30">
                  <button
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/50 active:brightness-95 transition-all duration-200"
                  >
                    <Undo2 className="size-4" />
                    Restore Defaults
                  </button>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/85 text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/10 active:brightness-95 transition-all duration-200"
                  >
                    <Save className="size-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "theming" && (
              <div className="flex flex-col gap-8">
                {/* 1. Theme Selector */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Interface Color Theme
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose between our light and dark color themes. The theme will apply immediately
                    across all open windows.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {/* Light Theme Card */}
                    <div
                      onClick={() => {
                        if (isDarkMode) toggleDarkMode();
                      }}
                      className={`relative flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group ${
                        !isDarkMode
                          ? "border-primary bg-card shadow-lg shadow-primary/5 text-foreground"
                          : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-2.5 rounded-xl ${!isDarkMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                        >
                          <Sun className="size-5" />
                        </div>
                        {!isDarkMode && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Light Mode</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fresh, high-contrast, clean monochromatic surfaces.
                        </p>
                      </div>
                    </div>

                    {/* Dark Theme Card */}
                    <div
                      onClick={() => {
                        if (!isDarkMode) toggleDarkMode();
                      }}
                      className={`relative flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group ${
                        isDarkMode
                          ? "border-primary bg-card shadow-lg shadow-primary/5 text-foreground"
                          : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-2.5 rounded-xl ${isDarkMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                        >
                          <Moon className="size-5" />
                        </div>
                        {isDarkMode && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Dark Mode</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Premium deep-slate shades designed for low-light comfort.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/30 w-full" />

                {/* 2. Primary Accent Color */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Primary Accent Color
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Personalize your browser’s accent color. This color is used for focus
                    highlights, active buttons, tabs, and interface details.
                  </p>

                  {/* Curated Color Presets Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {[
                      { name: "Blueberry Cobalt", hex: "#4361ee", desc: "Signature brand blue" },
                      { name: "Sunset Rose", hex: "#f72585", desc: "Vibrant energetic pink" },
                      { name: "Violet Aurora", hex: "#7209b7", desc: "Deep mystical purple" },
                      { name: "Emerald Shore", hex: "#06d6a0", desc: "Fresh tropical green" },
                      { name: "Amber Sunset", hex: "#f77f00", desc: "Warm glowing orange" },
                      { name: "Slate Breeze", hex: "#64748b", desc: "Sleek balanced gray" },
                    ].map((preset) => {
                      const isSelected = primaryColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <div
                          key={preset.hex}
                          onClick={() => setPrimaryColor(preset.hex)}
                          className={`relative flex flex-col p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group hover:scale-[1.01] ${
                            isSelected
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-4 rounded-full border border-black/10 dark:border-white/10 shrink-0 shadow-sm"
                                style={{ backgroundColor: preset.hex }}
                              />
                              <span className="font-bold text-sm truncate">{preset.name}</span>
                            </div>
                            {isSelected && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                                <Check className="size-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground mt-1 leading-normal">
                            {preset.desc}
                          </span>
                        </div>
                      );
                    })}

                    {/* Custom Color Picker Card */}
                    {(() => {
                      const isPreset = [
                        "#4361ee",
                        "#f72585",
                        "#7209b7",
                        "#06d6a0",
                        "#f77f00",
                        "#64748b",
                      ].includes(primaryColor.toLowerCase());

                      return (
                        <div
                          onClick={() => {
                            document.getElementById("custom-color-input")?.click();
                          }}
                          className={`relative flex flex-col p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group hover:scale-[1.01] ${
                            !isPreset
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-border/40 bg-secondary/30 hover:bg-secondary/50 text-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-4 rounded-full border border-black/10 dark:border-white/10 shrink-0 shadow-sm flex items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500"
                                style={
                                  !isPreset
                                    ? { backgroundColor: primaryColor, backgroundImage: "none" }
                                    : undefined
                                }
                              />
                              <span className="font-bold text-sm truncate">
                                {!isPreset ? "Custom Shade" : "Custom Color"}
                              </span>
                            </div>
                            {!isPreset && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                                <Check className="size-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground mt-1 leading-normal">
                            {!isPreset
                              ? `Hex code: ${primaryColor.toUpperCase()}`
                              : "Select any custom color tone"}
                          </span>
                          <input
                            id="custom-color-input"
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-0 h-0"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Actions Bar inside content */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border/30">
                  <button
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/50 active:brightness-95 transition-all duration-200"
                  >
                    <Undo2 className="size-4" />
                    Restore Defaults
                  </button>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/85 text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/10 active:brightness-95 transition-all duration-200"
                  >
                    <Save className="size-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "shortcuts" && (
              <div className="flex flex-col gap-6">
                {/* Visual recording alert banner */}
                {recordingKey && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/25 text-primary animate-pulse">
                    <KeyboardIcon className="size-5 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold">Listening for keystrokes...</h4>
                      <p className="text-xs text-primary/80 mt-1">
                        Press the exact combination of keys you want to assign to{" "}
                        <strong className="font-semibold text-primary">
                          {SHORTCUT_LABELS[recordingKey].label}
                        </strong>
                        . Press{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-[10px]">
                          Esc
                        </kbd>{" "}
                        to cancel.
                      </p>
                    </div>
                  </div>
                )}

                {/* Shortcuts Grid/Table */}
                <div className="border border-border/30 rounded-2xl overflow-hidden bg-secondary/20">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="col-span-7">Action & Description</span>
                    <span className="col-span-5 text-right pr-4">Shortcut Assignment</span>
                  </div>

                  <div className="divide-y divide-border/30">
                    {(Object.keys(SHORTCUT_LABELS) as Array<keyof ShortcutConfig>).map((key) => {
                      const isRecordingThis = recordingKey === key;
                      const shortcutVal = shortcuts[key];

                      return (
                        <div
                          key={key}
                          onClick={() => !recordingKey && setRecordingKey(key)}
                          className={`grid grid-cols-12 gap-4 items-center px-4 py-4 transition-all duration-150 group cursor-pointer ${
                            isRecordingThis ? "bg-primary/5" : "hover:bg-secondary/40"
                          }`}
                        >
                          <div className="col-span-7 pr-2">
                            <span className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                              {SHORTCUT_LABELS[key].label}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {SHORTCUT_LABELS[key].desc}
                            </p>
                          </div>

                          <div className="col-span-5 flex justify-end items-center gap-2">
                            {isRecordingThis ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold tracking-tight text-primary animate-pulse">
                                <span className="size-1.5 rounded-full bg-primary animate-ping" />
                                Recording...
                              </div>
                            ) : (
                              <div className="flex flex-wrap justify-end gap-1 max-w-full">
                                {shortcutVal.split("+").map((part) => (
                                  <kbd
                                    key={part}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-card text-foreground shadow-sm"
                                  >
                                    {part === "CmdOrCtrl"
                                      ? platform === "darwin"
                                        ? "⌘ Cmd"
                                        : "Ctrl"
                                      : part}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shortcuts Actions Bar */}
                <div className="flex items-center justify-between gap-4 mt-2">
                  <button
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/50 active:brightness-95 transition-all duration-200"
                  >
                    <Undo2 className="size-4" />
                    Restore Defaults
                  </button>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/85 text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/10 active:brightness-95 transition-all duration-200"
                  >
                    <Save className="size-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="flex flex-col gap-6 max-w-xl">
                <div className="p-6 rounded-2xl border border-border/30 bg-secondary/20 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-lg shadow-primary/10">
                      B
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-foreground">Blueberry Browser</h3>
                      <p className="text-xs text-muted-foreground">
                        Version 1.0.0 (Official Build)
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-4">
                    Blueberry is a state-of-the-art AI-native, client-side automated browser. It
                    integrates next-generation LLM orchestration, E2E testing pipelines, and
                    standard web exploration into a single cohesive, high-performance interface.
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground block">
                        Runtime Environment
                      </span>
                      <span className="font-bold text-foreground">
                        Electron {versions.electron || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block">
                        Chrome Engine
                      </span>
                      <span className="font-bold text-foreground">
                        Chromium {versions.chrome || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block">
                        Node Module Engine
                      </span>
                      <span className="font-bold text-foreground">
                        {versions.node ? `v${versions.node}` : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block">
                        Operating System
                      </span>
                      <span className="font-bold text-foreground">
                        {platform === "darwin" ? "macOS" : platform || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="flex flex-col gap-6 h-full pb-8">
                {/* Search and Clear Actions Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search history by title or URL..."
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border bg-secondary/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-transform"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {historyList.length > 0 && (
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            "Are you sure you want to clear your entire browsing history? This action cannot be undone.",
                          )
                        ) {
                          if (window.historyAPI && window.historyAPI.clearHistory) {
                            await window.historyAPI.clearHistory();
                            void loadHistory();
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all duration-200"
                    >
                      <Trash2 className="size-4" />
                      Clear History
                    </button>
                  )}
                </div>

                {/* Date-grouped History List */}
                <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6">
                  {(() => {
                    const filtered = historyList.filter((entry) => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (entry.title || "").toLowerCase().includes(q) ||
                        (entry.url || "").toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-border bg-secondary/10 text-center animate-fade-in">
                          <div className="p-4 rounded-full bg-secondary/50 text-muted-foreground mb-4">
                            <Clock className="size-8" />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">No History Found</h4>
                          <p className="text-xs text-muted-foreground max-w-xs mt-1">
                            {searchQuery
                              ? `No browsing history matches "${searchQuery}". Try searching for something else.`
                              : "Pages you visit will show up here, letting you search and find them easily."}
                          </p>
                        </div>
                      );
                    }

                    const grouped = {
                      Today: [] as HistoryEntry[],
                      Yesterday: [] as HistoryEntry[],
                      "Last 7 Days": [] as HistoryEntry[],
                      Older: [] as HistoryEntry[],
                    };

                    const now = new Date();
                    const todayStart = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate(),
                    ).getTime();
                    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
                    const sevenDaysAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000;

                    filtered.forEach((entry) => {
                      const t = entry.timestamp;
                      if (t >= todayStart) {
                        grouped.Today.push(entry);
                      } else if (t >= yesterdayStart) {
                        grouped.Yesterday.push(entry);
                      } else if (t >= sevenDaysAgoStart) {
                        grouped["Last 7 Days"].push(entry);
                      } else {
                        grouped.Older.push(entry);
                      }
                    });

                    return (Object.keys(grouped) as Array<keyof typeof grouped>).map(
                      (groupName) => {
                        const entries = grouped[groupName];
                        if (entries.length === 0) return null;

                        return (
                          <div key={groupName} className="flex flex-col gap-2 animate-fade-in">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary px-1">
                              {groupName}
                            </h3>
                            <div className="border border-border/30 rounded-2xl overflow-hidden bg-secondary/10 divide-y divide-border/30 shadow-sm">
                              {entries.map((entry) => {
                                const dateStr = new Date(entry.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });

                                return (
                                  <div
                                    key={entry.id}
                                    className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/30 transition-colors duration-150 group"
                                  >
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                      <span className="text-xs font-mono font-semibold text-muted-foreground select-none shrink-0 w-11">
                                        {dateStr}
                                      </span>
                                      <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors duration-150">
                                          {entry.title || "New Tab"}
                                        </h4>
                                        <p className="text-xs text-muted-foreground truncate font-mono mt-0.5 max-w-md">
                                          {entry.url}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                                      <button
                                        onClick={() => {
                                          if (window.electron && window.electron.ipcRenderer) {
                                            void window.electron.ipcRenderer.invoke(
                                              "create-tab",
                                              entry.url,
                                            );
                                          } else {
                                            window.open(entry.url, "_blank");
                                          }
                                        }}
                                        title="Open in New Tab"
                                        className="p-1.5 rounded-lg border border-border/40 hover:border-primary/30 bg-card hover:bg-primary/5 text-muted-foreground hover:text-primary hover:scale-105 active:scale-95 transition-all duration-150"
                                      >
                                        <ExternalLink className="size-3.5" />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (
                                            window.historyAPI &&
                                            window.historyAPI.deleteHistoryEntry
                                          ) {
                                            const success =
                                              await window.historyAPI.deleteHistoryEntry(entry.id);
                                            if (success) {
                                              setHistoryList((prev) =>
                                                prev.filter((item) => item.id !== entry.id),
                                              );
                                            }
                                          }
                                        }}
                                        title="Delete from History"
                                        className="p-1.5 rounded-lg border border-border/40 hover:border-rose-500/30 bg-card hover:bg-rose-500/5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:scale-105 active:scale-95 transition-all duration-150"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      },
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
