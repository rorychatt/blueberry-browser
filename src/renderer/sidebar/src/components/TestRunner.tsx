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
  const [isEditing, setIsFocused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "screenshots">("logs");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tests on mount
  useEffect(() => {
    loadTests();

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
            // Automatically switch to screenshots tab or notify
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
    }
  };

  const handleSelectTest = (test: E2ETest) => {
    setSelectedFilename(test.filename);
    setYAMLContent(test.content);
    setIsDropdownOpen(false);
    // Clear old runs
    setLogs([]);
    setScreenshots([]);
  };

  const handleSave = async () => {
    if (!selectedFilename) {
      return;
    }
    const res = await window.sidebarAPI.saveE2ETest(selectedFilename, yamlContent);
    if (res.success) {
      // Reload tests to update names/configs
      await loadTests();
      alert("Test configuration saved successfully!");
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
      setLogs([]);
      setScreenshots([]);
    } else {
      alert(`Error creating test: ${res.error}`);
    }
  };

  const handleRunTest = async () => {
    if (!selectedFilename || isRunning) {
      return;
    }
    setIsRunning(true);
    setLogs([
      {
        id: "start",
        text: `Starting test execution for '${selectedFilename}'...\n`,
        type: "system",
      },
    ]);
    setScreenshots([]);
    setActiveTab("logs");

    await window.sidebarAPI.runE2ETest(selectedFilename);
    setIsRunning(false);
  };

  const handleRunTestInBrowser = async () => {
    if (!selectedFilename || isRunning) {
      return;
    }
    setIsRunning(true);
    setLogs([
      {
        id: "start",
        text: `Starting In-Tab test execution for '${selectedFilename}'...\n`,
        type: "system",
      },
    ]);
    setScreenshots([]);
    setActiveTab("logs");

    await window.sidebarAPI.runE2ETestInBrowser(selectedFilename);
    setIsRunning(false);
  };

  const currentTest = tests.find((t) => t.filename === selectedFilename);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden animate-fade-in">
      {/* Test Selector Dropdown header */}
      <div className="p-4 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between gap-2 relative">
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted/50 transition-all text-sm font-medium shadow-sm outline-none"
          >
            <span className="flex items-center gap-2 truncate">
              <FileCode className="size-4 text-primary" />
              <span className="truncate">
                {currentTest ? currentTest.name : "Select E2E Test..."}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                isDropdownOpen && "rotate-180",
              )}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto animate-spring-scale">
              {tests.map((test) => (
                <button
                  key={test.filename}
                  onClick={() => {
                    handleSelectTest(test);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted text-sm flex flex-col gap-0.5 border-b border-border/50 last:border-0 transition-colors",
                    selectedFilename === test.filename && "bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <span className="font-semibold text-foreground truncate">{test.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{test.filename}</span>
                </button>
              ))}
              {tests.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No tests found</div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateTest}
          title="Create New E2E Test"
          className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {/* Editor & Running Panel */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-4 min-h-0">
        {/* Code Editor */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-[180px] max-h-[35%] bg-muted/40 dark:bg-muted/10 border rounded-2xl overflow-hidden shadow-inner transition-all duration-200",
            isEditing
              ? "border-primary/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileCode className="size-3.5" />
              YAML Script Editor
            </span>
            {selectedFilename && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Save className="size-3" />
                Save Changes
              </button>
            )}
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => {
              setYAMLContent(e.target.value);
            }}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            placeholder="# Write your E2E test YAML here..."
            className="flex-1 p-4 font-mono text-xs bg-transparent text-foreground outline-none resize-none leading-relaxed overflow-y-auto"
          />
        </div>

        {/* Console & Screenshot Output */}
        <div className="flex-[2] flex flex-col border border-border rounded-3xl overflow-hidden bg-card/20 shadow-md min-h-[220px]">
          {/* Output tabs */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-card/50">
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setActiveTab("logs");
                }}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                  activeTab === "logs"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Terminal className="size-3.5" />
                Console Logs
              </button>
              <button
                onClick={() => {
                  setActiveTab("screenshots");
                }}
                className={cn(
                  "px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all relative",
                  activeTab === "screenshots"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <ImageIcon className="size-3.5" />
                Screenshots
                {screenshots.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground animate-pulse">
                    {screenshots.length}
                  </span>
                )}
              </button>
            </div>

            {/* Run Test Buttons */}
            {selectedFilename && (
              <div className="flex gap-2">
                <button
                  onClick={handleRunTest}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all",
                    isRunning
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95",
                  )}
                >
                  {isRunning ? (
                    <>
                      <Loader className="size-3.5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      Run External
                    </>
                  )}
                </button>
                <button
                  onClick={handleRunTestInBrowser}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all",
                    isRunning
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary hover:bg-primary/95 text-primary-foreground active:scale-95",
                  )}
                >
                  {isRunning ? (
                    <>
                      <Loader className="size-3.5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      Run in Tab
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Content display */}
          <div className="flex-1 bg-black/40 dark:bg-black/80 p-4 font-mono text-xs overflow-y-auto min-h-0 relative select-text">
            {activeTab === "logs" ? (
              <div className="flex flex-col gap-1 text-gray-200">
                {logs.map((log) => {
                  let colorClass = "text-gray-300";

                  if (log.type === "stderr") {
                    colorClass = "text-rose-400 font-semibold";
                  } else if (log.type === "system") {
                    colorClass = "text-cyan-400 font-bold border-b border-cyan-900/30 pb-1 mb-1";
                  } else {
                    // Check for styled ticks/crosses inside stdout
                    if (log.text.includes("✓")) {
                      colorClass = "text-emerald-400 font-semibold";
                    } else if (log.text.includes("✗")) {
                      colorClass = "text-rose-500 font-bold";
                    } else if (
                      log.text.includes("🚀") ||
                      log.text.includes("🎉") ||
                      log.text.includes("📋")
                    ) {
                      colorClass = "text-amber-300 font-bold";
                    }
                  }

                  return (
                    <div key={log.id} className={cn("whitespace-pre-wrap break-all", colorClass)}>
                      {log.text}
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div className="text-muted-foreground flex flex-col items-center justify-center h-full min-h-[150px] gap-2">
                    <Terminal className="size-8 opacity-20" />
                    <p className="text-center">
                      Select a test and click Run Test to see progress output.
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
                        key={idx}
                        className="group relative border border-border rounded-xl overflow-hidden aspect-video bg-muted cursor-pointer shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
                        onClick={() => {
                          setSelectedScreenshot(src);
                        }}
                      >
                        <img
                          src={src}
                          alt={`Step ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="size-5 text-white" />
                        </div>
                        <div className="absolute bottom-1 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-sans">
                          Screenshot #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center justify-center h-full min-h-[150px] gap-2">
                    <ImageIcon className="size-8 opacity-20" />
                    <p className="text-center font-sans">
                      No screenshots captured yet in this run.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Screenshot Overlay Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-[100] p-4 animate-fade-in">
          <div className="flex justify-end p-2">
            <button
              onClick={() => {
                setSelectedScreenshot(null);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="size-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={selectedScreenshot}
              alt="E2E Screenshot Fullscreen"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};
