import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileCode,
  Image as ImageIcon,
  Loader,
  Maximize2,
  Play,
  Plus,
  Save,
  Terminal,
  X,
  Compass,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Cpu,
  Trash2,
  Eye,
  Activity,
  StopCircle,
} from "lucide-react";
import { cn } from "@common/lib/utils";

interface E2ETest {
  filename: string;
  name: string;
  content: string;
}

interface LogLine {
  id: string;
  type: "stdout" | "stderr" | "system";
  text: string;
}

export const TestRunner: React.FC = () => {
  const [tests, setTests] = useState<E2ETest[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [yamlContent, setYAMLContent] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runMode, setRunMode] = useState<"tab" | "external" | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "screenshots">("logs");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [headful, setHeadful] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRunStatus, setLastRunStatus] = useState<"passed" | "failed" | null>(null);
  const [isKilling, setIsKilling] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tests on mount
  useEffect(() => {
    void loadTests();

    // Setup logs listener
    window.sidebarAPI.onE2ETestLog((data) => {
      const newLine: LogLine = {
        id: Math.random().toString(36).slice(7),
        ...data,
      };
      setLogs((prev) => [...prev, newLine]);

      // Check if a screenshot was taken in the log text
      // E.g., "Take screenshot saved to 'google_search.png'..."
      const screenshotMatch = /saved to ['"](.*?)['"]/.exec(data.text);
      if (screenshotMatch && screenshotMatch[1]) {
        const screenshotFile = screenshotMatch[1];
        // Fetch base64 screenshot after a tiny delay to ensure file is written
        setTimeout(async () => {
          const base64Data = await window.sidebarAPI.getE2EScreenshot(screenshotFile);
          if (base64Data) {
            setScreenshots((prev) => {
              if (!prev.includes(base64Data)) {
                return [...prev, base64Data];
              }
              return prev;
            });
            // Automatically switch to screenshots tab
            setActiveTab("screenshots");
          }
        }, 800);
      }
    });

    // Handle click outside dropdown to close it
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.sidebarAPI.removeE2ETestLogListener();
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === "logs") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  const loadTests = async () => {
    const fetchedTests = await window.sidebarAPI.getE2ETests();
    setTests(fetchedTests);
    if (fetchedTests.length > 0 && !selectedFilename) {
      setSelectedFilename(fetchedTests[0].filename);
      setYAMLContent(fetchedTests[0].content);
      setIsDirty(false);
    }
  };

  const handleSelectTest = (test: E2ETest) => {
    setSelectedFilename(test.filename);
    setYAMLContent(test.content);
    setIsDirty(false);
    setIsDropdownOpen(false);
    // Clear old runs
    setLogs([]);
    setScreenshots([]);
    setLastRunStatus(null);
  };

  const handleContentChange = (val: string) => {
    setYAMLContent(val);
    const originalTest = tests.find((t) => t.filename === selectedFilename);
    setIsDirty(originalTest ? originalTest.content !== val : val.trim().length > 0);
  };

  const handleSave = async () => {
    if (!selectedFilename) {
      return;
    }
    const res = await window.sidebarAPI.saveE2ETest(selectedFilename, yamlContent);
    if (res.success) {
      setIsDirty(false);
      await loadTests();
    } else {
      alert(`Error saving test: ${res.error}`);
    }
  };

  const handleCreateTest = async () => {
    const filename = prompt("Enter E2E test filename (e.g. my_test.yaml):");
    if (!filename) {
      return;
    }
    const validFilename =
      filename.endsWith(".yaml") || filename.endsWith(".yml") ? filename : `${filename}.yaml`;

    const template = `name: "My Custom E2E Test"
steps:
  - navigate: "https://www.google.com"
  - wait: 1000
  - screenshot: "custom_screenshot.png"
  - agent: "Verify that the page loaded successfully"
`;

    const res = await window.sidebarAPI.saveE2ETest(validFilename, template);
    if (res.success) {
      await loadTests();
      setSelectedFilename(validFilename);
      setYAMLContent(template);
      setIsDirty(false);
      setLogs([]);
      setScreenshots([]);
      setLastRunStatus(null);
    } else {
      alert(`Error creating test: ${res.error}`);
    }
  };

  const handleRunTest = async () => {
    if (!selectedFilename || isRunning) {
      return;
    }
    setIsRunning(true);
    setRunMode("external");
    setLastRunStatus(null);
    setLogs([
      {
        id: "start",
        text: `Starting external test execution for '${selectedFilename}'...\n`,
        type: "system",
      },
    ]);
    setScreenshots([]);
    setActiveTab("logs");

    const res = await window.sidebarAPI.runE2ETest(selectedFilename, headful);
    setIsRunning(false);
    setRunMode(null);
    if (res && res.success) {
      setLastRunStatus("passed");
    } else {
      setLastRunStatus("failed");
    }
  };

  const handleRunTestInBrowser = async () => {
    if (!selectedFilename || isRunning) {
      return;
    }
    setIsRunning(true);
    setRunMode("tab");
    setLastRunStatus(null);
    setLogs([
      {
        id: "start",
        text: `Starting In-Tab test execution for '${selectedFilename}'...\n`,
        type: "system",
      },
    ]);
    setScreenshots([]);
    setActiveTab("logs");

    const res = await window.sidebarAPI.runE2ETestInBrowser(selectedFilename);
    setIsRunning(false);
    setRunMode(null);
    if (res && res.success) {
      setLastRunStatus("passed");
    } else {
      setLastRunStatus("failed");
    }
  };

  const handleKillTest = async () => {
    if (!isRunning || isKilling) {
      return;
    }
    setIsKilling(true);
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(7),
        text: `⚠️ Sending stop signal to test process...\n`,
        type: "system",
      },
    ]);

    try {
      const res = await window.sidebarAPI.killE2ETest();
      if (!res || !res.success) {
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(7),
            text: `❌ Error stopping test: ${res?.error || "Unknown error"}\n`,
            type: "stderr",
          },
        ]);
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(7),
          text: `❌ Error stopping test: ${(err as Error).message}\n`,
          type: "stderr",
        },
      ]);
    } finally {
      setIsKilling(false);
    }
  };

  const copyLogsToClipboard = () => {
    if (logs.length === 0) {
      return;
    }
    const fullLogText = logs.map((log) => log.text).join("");
    void navigator.clipboard.writeText(fullLogText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const clearLogs = () => {
    setLogs([]);
    setScreenshots([]);
    setLastRunStatus(null);
  };

  const currentTest = tests.find((t) => t.filename === selectedFilename);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background via-background/95 to-background/90 overflow-hidden animate-fade-in text-foreground">
      {/* Test Selector Dropdown Header */}
      <div className="p-3 border-b border-border/30 bg-card/15 backdrop-blur-md flex items-center justify-between gap-2.5 relative shrink-0">
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
            }}
            className={cn(
              "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border bg-background/55 dark:bg-background/20 hover:bg-muted/40 transition-all duration-300 text-xs font-semibold shadow-sm outline-none cursor-pointer",
              isDropdownOpen
                ? "border-primary/50 ring-2 ring-primary/15"
                : "border-border/40 hover:border-border/80",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <FileCode className="size-4 text-primary animate-pulse" />
              <span className="truncate">
                {currentTest ? currentTest.name : "Select E2E Test..."}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-300 ease-out",
                isDropdownOpen && "rotate-180 text-primary",
              )}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-background/95 dark:bg-background/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
              {tests.map((test) => (
                <button
                  key={test.filename}
                  onClick={() => {
                    handleSelectTest(test);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-muted/65 text-xs flex flex-col gap-0.5 border-b border-border/10 last:border-0 transition-colors cursor-pointer",
                    selectedFilename === test.filename &&
                      "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 text-primary",
                  )}
                >
                  <span className="font-bold text-foreground truncate">{test.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate font-mono">
                    {test.filename}
                  </span>
                </button>
              ))}
              {tests.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">No tests found</div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateTest}
          title="Create New E2E Test"
          className="size-8 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center hover:scale-[1.03] active:scale-95 transition-all shadow-md shadow-primary/15 cursor-pointer shrink-0"
        >
          <Plus className="size-4.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
        {/* YAML Code Editor */}
        <div
          className={cn(
            "flex-[1.1] flex flex-col min-h-[140px] bg-zinc-950 dark:bg-zinc-950/90 border rounded-xl overflow-hidden shadow-lg transition-all duration-300 ease-in-out relative group",
            isFocused
              ? "border-primary/50 shadow-[0_0_15px_rgba(67,97,238,0.15)] ring-2 ring-primary/5"
              : "border-border/30 hover:border-border/60",
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 bg-zinc-900/60 backdrop-blur-sm shrink-0">
            <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider font-sans">
              <Compass className="size-3.5 text-primary animate-spin-slow" />
              YAML Script Editor
            </span>
            {selectedFilename && (
              <div className="flex items-center gap-3">
                {isDirty ? (
                  <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold animate-pulse">
                    Unsaved
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-bold">
                    Saved
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer py-0.5 px-1.5 rounded",
                    isDirty
                      ? "text-primary hover:bg-primary/10 active:scale-95 hover:underline"
                      : "text-zinc-600 cursor-not-allowed",
                  )}
                >
                  <Save className="size-3" />
                  Save
                </button>
              </div>
            )}
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => {
              handleContentChange(e.target.value);
            }}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            placeholder="# Write your E2E test YAML here..."
            className="flex-1 p-3.5 font-mono text-[11px] bg-transparent text-emerald-400/90 outline-none resize-none leading-relaxed overflow-y-auto caret-primary selection:bg-primary/20"
          />
        </div>

        {/* Dedicated Control & Options Panel */}
        {selectedFilename && (
          <div className="p-3 border border-border/30 bg-card/25 backdrop-blur-md rounded-xl flex flex-col gap-3 shadow-md shrink-0">
            {/* Visual Window Option */}
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5 text-foreground">
                  <Eye className="size-3.5 text-primary" />
                  Headful Mode
                </span>
                <span className="text-[9px] text-muted-foreground">
                  Launch visible browser window for external runs
                </span>
              </div>
              <button
                onClick={() => {
                  setHeadful(!headful);
                }}
                disabled={isRunning}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out outline-none focus:ring-2 focus:ring-primary/20",
                  headful ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-800",
                  isRunning && "opacity-50 cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out",
                    headful ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            {/* Run Buttons Panel or Abort Button */}
            {isRunning ? (
              <button
                onClick={handleKillTest}
                disabled={isKilling}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-black bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md shadow-rose-500/20 hover:shadow-rose-500/30 active:scale-98 transition-all duration-300 cursor-pointer border border-rose-500/30 hover:scale-[1.01]"
              >
                {isKilling ? (
                  <>
                    <Loader className="size-3.5 animate-spin" />
                    Stopping execution...
                  </>
                ) : (
                  <>
                    <StopCircle className="size-4 animate-pulse" />
                    Kill Running Test
                  </>
                )}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleRunTestInBrowser}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold shadow-md transition-all duration-300 cursor-pointer border",
                    isRunning
                      ? runMode === "tab"
                        ? "bg-primary/20 text-primary border-primary/40 animate-pulse cursor-not-allowed"
                        : "bg-muted text-muted-foreground border-transparent opacity-40 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-primary/20 hover:scale-[1.02] hover:brightness-105 active:scale-98 hover:shadow-lg hover:shadow-primary/10",
                  )}
                >
                  {isRunning && runMode === "tab" ? (
                    <>
                      <Loader className="size-3.5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="size-3 fill-current" />
                      Run in Tab
                    </>
                  )}
                </button>
                <button
                  onClick={handleRunTest}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold shadow-md transition-all duration-300 cursor-pointer border",
                    isRunning
                      ? runMode === "external"
                        ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 animate-pulse cursor-not-allowed"
                        : "bg-muted text-muted-foreground border-transparent opacity-40 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-500/20 hover:scale-[1.02] hover:brightness-105 active:scale-98 hover:shadow-lg hover:shadow-emerald-500/10",
                  )}
                >
                  {isRunning && runMode === "external" ? (
                    <>
                      <Loader className="size-3.5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Cpu className="size-3.5" />
                      Run External
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Output Console / Terminal */}
        <div
          className={cn(
            "flex-1 flex flex-col border rounded-xl overflow-hidden bg-zinc-950 shadow-lg min-h-[160px] transition-all duration-300 ease-in-out relative",
            isRunning
              ? "border-primary/40 shadow-[0_0_20px_rgba(67,97,238,0.1)]"
              : "border-border/30 hover:border-border/50",
          )}
        >
          {/* Output Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveTab("logs");
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all duration-300 cursor-pointer",
                  activeTab === "logs"
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-inner"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
                )}
              >
                <Terminal className="size-3.5" />
                Logs
              </button>
              <button
                onClick={() => {
                  setActiveTab("screenshots");
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all duration-300 cursor-pointer relative",
                  activeTab === "screenshots"
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-inner"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
                )}
              >
                <ImageIcon className="size-3.5" />
                Screenshots
                {screenshots.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-black text-primary-foreground shadow-sm">
                    {screenshots.length}
                  </span>
                )}
              </button>
            </div>

            {/* Run Status Display on Right */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold animate-pulse">
                  <Activity className="size-2.5 animate-spin" />
                  RUNNING
                </div>
              )}
              {!isRunning && lastRunStatus === "passed" && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black animate-fade-in shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                  <CheckCircle className="size-2.5" />
                  PASSED
                </div>
              )}
              {!isRunning && lastRunStatus === "failed" && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black animate-fade-in shadow-[0_0_10px_rgba(244,63,94,0.05)]">
                  <XCircle className="size-2.5" />
                  FAILED
                </div>
              )}

              {/* Utility Panel */}
              <div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
                {activeTab === "logs" && logs.length > 0 && (
                  <>
                    <button
                      onClick={copyLogsToClipboard}
                      title="Copy all logs"
                      className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                    <button
                      onClick={clearLogs}
                      title="Clear output"
                      className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 hover:text-rose-400 transition-colors" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Console Content Window */}
          <div className="flex-1 p-3.5 font-mono text-[10.5px] overflow-y-auto min-h-0 relative select-text scrollbar-thin bg-zinc-950 text-zinc-300">
            {activeTab === "logs" ? (
              <div className="flex flex-col gap-1.5">
                {logs.map((log) => {
                  let colorClass = "text-zinc-300";
                  let icon: React.ReactNode = null;

                  if (log.type === "stderr") {
                    colorClass = "text-rose-400 font-semibold";
                  } else if (log.type === "system") {
                    colorClass = "text-cyan-400 font-bold border-b border-zinc-900 pb-1 mb-1";
                  } else {
                    if (log.text.includes("✓")) {
                      colorClass = "text-emerald-400 font-semibold flex items-start gap-1.5";
                      icon = <CheckCircle className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />;
                    } else if (log.text.includes("✗") || log.text.includes("failed")) {
                      colorClass = "text-rose-400 font-bold flex items-start gap-1.5";
                      icon = <XCircle className="size-3.5 text-rose-400 mt-0.5 shrink-0" />;
                    } else if (
                      log.text.includes("🚀") ||
                      log.text.includes("🎉") ||
                      log.text.includes("🎯")
                    ) {
                      colorClass = "text-amber-300 font-bold";
                    }
                  }

                  return (
                    <div
                      key={log.id}
                      className={cn("whitespace-pre-wrap break-all leading-normal", colorClass)}
                    >
                      {icon}
                      <span>{log.text}</span>
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div className="text-zinc-500 flex flex-col items-center justify-center h-full min-h-[120px] gap-2.5 my-auto">
                    <Terminal className="size-8 opacity-25" />
                    <p className="text-center text-[11px] font-sans px-4">
                      Select an E2E test and run it to inspect terminal outputs.
                    </p>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="h-full">
                {screenshots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {screenshots.map((src, idx) => (
                      <div
                        key={src.slice(0, 100)}
                        className="group relative border border-zinc-800 rounded-xl overflow-hidden aspect-video bg-zinc-900/40 cursor-pointer shadow-md hover:border-primary/50 transition-all duration-300"
                        onClick={() => {
                          setSelectedScreenshot(src);
                        }}
                      >
                        <img
                          src={src}
                          alt={`Step ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[1px]">
                          <Maximize2 className="size-4.5 text-white animate-fade-in" />
                        </div>
                        <div className="absolute bottom-1.5 left-2 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-white font-sans font-bold border border-zinc-800">
                          Step #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-500 flex flex-col items-center justify-center h-full min-h-[120px] gap-2.5 my-auto">
                    <ImageIcon className="size-8 opacity-25" />
                    <p className="text-center font-sans text-[11px] px-4">
                      No screenshots taken yet. Add a screenshot step in your YAML.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Screenshot Overlay Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex flex-col z-[100] p-5 animate-in fade-in duration-300">
          <div className="flex justify-end p-1 shrink-0">
            <button
              onClick={() => {
                setSelectedScreenshot(null);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            <img
              src={selectedScreenshot}
              alt="E2E Screenshot Fullscreen"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300"
            />
          </div>
        </div>
      )}
    </div>
  );
};
