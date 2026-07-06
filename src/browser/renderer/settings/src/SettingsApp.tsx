import React, { useEffect, useState } from "react";
import { useDarkMode } from "@common/hooks/useDarkMode";
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
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null);
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "shortcuts" | "about" | "shortcuts_legacy"
  >("general");

  // General settings state
  const [landingPage, setLandingPage] = useState<string>("https://www.google.com");
  const [selectedLandingOption, setSelectedLandingOption] = useState<string>("google");
  const [customLandingUrl, setCustomLandingUrl] = useState<string>("");

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
      if (isDarkMode) {
        toggleDarkMode();
      }
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
    <div className="flex h-screen w-full select-none bg-radial from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-950 p-6 md:p-12 overflow-hidden transition-colors duration-300">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-500/20 dark:bg-indigo-700/10 blur-[130px] pointer-events-none" />

      {/* Main Glassmorphic Dashboard Window */}
      <div className="relative flex w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border border-white/20 dark:border-neutral-800/60 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-2xl">
        {/* Left Navigation Panel */}
        <aside className="w-64 border-r border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <Settings className="size-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                Blueberry
              </h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500">
                System Preferences
              </p>
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "general"
                  ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-500/5 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Palette className="size-4" />
              General Settings
            </button>

            <button
              onClick={() => setActiveTab("shortcuts")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "shortcuts"
                  ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-500/5 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Keyboard className="size-4" />
              Keyboard Shortcuts
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "about"
                  ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-500/5 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Info className="size-4" />
              About Browser
            </button>
          </nav>

          {/* Quick Info Box in Sidebar */}
          <div className="mt-auto p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white/20 dark:bg-white/5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
              Quick Tip:
            </span>
            Pressing standard shortcuts like{" "}
            <kbd className="px-1 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-[9px]">
              ⌘E
            </kbd>{" "}
            toggles the copilot sidebar immediately.
          </div>
        </aside>

        {/* Right Content Panel */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="px-8 py-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                {activeTab === "general"
                  ? "General Settings"
                  : activeTab === "shortcuts"
                    ? "Keyboard Shortcuts"
                    : "About Blueberry"}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeTab === "general"
                  ? "Configure your home page preferences, general behaviors, and interface aesthetics."
                  : activeTab === "shortcuts"
                    ? "Re-bind browser shortcuts to fully customize your browsing experience."
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
                {/* 1. Theme Selector */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Interface Color Theme
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Choose between our light and dark blueberry palettes. The theme will apply
                    immediately across all open tabs.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {/* Light Theme Card */}
                    <div
                      onClick={() => {
                        if (isDarkMode) toggleDarkMode();
                      }}
                      className={`relative flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group ${
                        !isDarkMode
                          ? "border-blue-500 bg-white shadow-lg shadow-blue-500/10 text-neutral-900"
                          : "border-black/5 dark:border-white/5 bg-neutral-800/40 hover:bg-neutral-800/60 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-2.5 rounded-xl ${!isDarkMode ? "bg-amber-100 text-amber-600" : "bg-neutral-800 text-neutral-500"}`}
                        >
                          <Sun className="size-5" />
                        </div>
                        {!isDarkMode && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-blue-500 text-white">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Light Mode</h4>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                          Fresh, high-contrast, clean blueberry-tinted surfaces.
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
                          ? "border-blue-500 bg-neutral-900 shadow-lg shadow-blue-500/10 text-neutral-100"
                          : "border-black/5 dark:border-white/5 bg-neutral-100/40 hover:bg-neutral-100/60 text-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-2.5 rounded-xl ${isDarkMode ? "bg-indigo-950 text-indigo-400" : "bg-neutral-200 text-neutral-400"}`}
                        >
                          <Moon className="size-5" />
                        </div>
                        {isDarkMode && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-blue-500 text-white">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Dark Mode</h4>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                          Premium deep-blueberry shades designed for low-light comfort.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-black/5 dark:bg-white/5 w-full" />

                {/* 2. Default Landing Page */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Default Landing Page
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
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
                              ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "border-black/5 dark:border-white/5 bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                  : "bg-black/5 dark:bg-white/5 text-neutral-500"
                              }`}
                            >
                              {key.slice(0, 3)}
                            </span>
                            <span className="font-bold text-sm truncate">{item.label}</span>
                          </div>
                          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">
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
                          ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "border-black/5 dark:border-white/5 bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 shrink-0" />
                        <span className="font-bold text-sm">Custom URL</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">
                        Type any website URL you want to set.
                      </span>
                    </div>
                  </div>

                  {/* Animated Expandable Custom URL Input Field */}
                  {selectedLandingOption === "custom" && (
                    <div className="mt-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 animate-fade-in flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Custom Website Address
                      </label>
                      <div className="relative flex items-center">
                        <Globe className="absolute left-4 size-4 text-neutral-400 pointer-events-none" />
                        <input
                          type="text"
                          value={customLandingUrl}
                          onChange={(e) => setCustomLandingUrl(e.target.value)}
                          placeholder="e.g. google.com, wikipedia.org, github.com"
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-black/10 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 shadow-inner"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">
                        Note: If `http://` or `https://` is omitted, `https://` will be prepended
                        automatically upon saving.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions Bar inside content */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-black/10 dark:border-neutral-700/60 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-500/5 active:brightness-95 transition-all duration-200"
                  >
                    <Undo2 className="size-4" />
                    Restore Defaults
                  </button>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 active:brightness-95 transition-all duration-200"
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
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse">
                    <KeyboardIcon className="size-5 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold">Listening for keystrokes...</h4>
                      <p className="text-xs text-blue-500 dark:text-blue-300/80 mt-1">
                        Press the exact combination of keys you want to assign to{" "}
                        <strong className="font-semibold text-blue-700 dark:text-blue-300">
                          {SHORTCUT_LABELS[recordingKey].label}
                        </strong>
                        . Press{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/5 text-[10px]">
                          Esc
                        </kbd>{" "}
                        to cancel.
                      </p>
                    </div>
                  </div>
                )}

                {/* Shortcuts Grid/Table */}
                <div className="border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/10">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-black/5 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    <span className="col-span-7">Action & Description</span>
                    <span className="col-span-5 text-right pr-4">Shortcut Assignment</span>
                  </div>

                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {(Object.keys(SHORTCUT_LABELS) as Array<keyof ShortcutConfig>).map((key) => {
                      const isRecordingThis = recordingKey === key;
                      const shortcutVal = shortcuts[key];

                      return (
                        <div
                          key={key}
                          onClick={() => !recordingKey && setRecordingKey(key)}
                          className={`grid grid-cols-12 gap-4 items-center px-4 py-4 transition-all duration-150 group cursor-pointer ${
                            isRecordingThis
                              ? "bg-blue-500/10 dark:bg-blue-500/20"
                              : "hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="col-span-7 pr-2">
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {SHORTCUT_LABELS[key].label}
                            </span>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                              {SHORTCUT_LABELS[key].desc}
                            </p>
                          </div>

                          <div className="col-span-5 flex justify-end items-center gap-2">
                            {isRecordingThis ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 text-xs font-bold tracking-tight text-blue-600 dark:text-blue-400 animate-pulse">
                                <span className="size-1.5 rounded-full bg-blue-500 animate-ping" />
                                Recording...
                              </div>
                            ) : (
                              <div className="flex flex-wrap justify-end gap-1 max-w-full">
                                {shortcutVal.split("+").map((part) => (
                                  <kbd
                                    key={part}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-black/10 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm"
                                  >
                                    {part === "CmdOrCtrl"
                                      ? process.platform === "darwin"
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
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-black/10 dark:border-neutral-700/60 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-500/5 active:brightness-95 transition-all duration-200"
                  >
                    <Undo2 className="size-4" />
                    Restore Defaults
                  </button>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 active:brightness-95 transition-all duration-200"
                  >
                    <Save className="size-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="flex flex-col gap-6 max-w-xl">
                <div className="p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/10 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/30">
                      B
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-neutral-800 dark:text-neutral-100">
                        Blueberry Browser
                      </h3>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        Version 1.0.0 (Official Build)
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed border-t border-black/5 dark:border-white/5 pt-4">
                    Blueberry is an state-of-the-art AI-native, client-side automated browser. It
                    integrates next-generation LLM orchestration, E2E testing pipelines, and
                    standard web exploration into a single cohesive, high-performance interface.
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-t border-black/5 dark:border-white/5 pt-4 text-xs">
                    <div>
                      <span className="font-semibold text-neutral-400 dark:text-neutral-500 block">
                        Runtime Environment
                      </span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        Electron {process.versions.electron}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-400 dark:text-neutral-500 block">
                        Chrome Engine
                      </span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        Chromium {process.versions.chrome}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-400 dark:text-neutral-500 block">
                        Node Module Engine
                      </span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        v{process.versions.node}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-400 dark:text-neutral-500 block">
                        Operating System
                      </span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        {process.platform === "darwin" ? "macOS" : process.platform}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
