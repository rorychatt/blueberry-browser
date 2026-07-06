import type { WebContents } from "electron";
import { ipcMain } from "electron";
import type { Window } from "../components/Window";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

export class EventManager {
  private readonly mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();

    // E2E Test events
    this.handleE2ETestEvents();
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        isActive: activeTabId === tab.id,
        title: tab.title,
        url: tab.url,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        void this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const { activeTab } = this.mainWindow;
      if (activeTab) {
        return {
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
          id: activeTab.id,
          title: activeTab.title,
          url: activeTab.url,
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => this.mainWindow.sidebar.client.getMessages());
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => {
      console.log("pong");
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  private handleE2ETestEvents(): void {
    const testsDir = path.join(process.cwd(), "tests");

    ipcMain.handle("get-e2e-tests", async () => {
      try {
        await fs.mkdir(testsDir, { recursive: true });
        const files = await fs.readdir(testsDir);
        const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

        const tests: { filename: string; name: string; content: string }[] = [];
        for (const file of yamlFiles) {
          const content = await fs.readFile(path.join(testsDir, file), "utf8");
          // Extract name from yaml content if possible (simple parser)
          let name = file;
          const nameMatch = /^name:\s*(.+)$/m.exec(content);
          if (nameMatch) {
            name = nameMatch[1].trim().replaceAll(/['"]/g, "");
          }
          tests.push({ content, filename: file, name });
        }
        return tests;
      } catch (error) {
        console.error("Failed to read E2E tests:", error);
        return [];
      }
    });

    ipcMain.handle("save-e2e-test", async (_, filename: string, content: string) => {
      try {
        await fs.mkdir(testsDir, { recursive: true });
        // Sanitize filename to prevent directory traversal
        const safeName = path.basename(filename);
        if (!safeName.endsWith(".yaml") && !safeName.endsWith(".yml")) {
          return { error: "Filename must end with .yaml or .yml", success: false };
        }
        await fs.writeFile(path.join(testsDir, safeName), content, "utf8");
        return { success: true };
      } catch (error) {
        console.error("Failed to save E2E test:", error);
        return { error: (error as Error).message, success: false };
      }
    });

    ipcMain.handle("get-e2e-screenshot", async (_, filename: string) => {
      try {
        const safeName = path.basename(filename);
        const pathsToTry = [
          path.join(process.cwd(), safeName),
          path.join(testsDir, safeName),
          filename,
        ];

        for (const p of pathsToTry) {
          try {
            await fs.access(p);
            const data = await fs.readFile(p);
            return `data:image/png;base64,${data.toString("base64")}`;
          } catch {
            // ignore
          }
        }
        return null;
      } catch (error) {
        console.error("Failed to read screenshot:", error);
        return null;
      }
    });

    ipcMain.handle("run-e2e-test", async (_, filename: string) => {
      try {
        const safeName = path.basename(filename);
        const testPath = path.join(testsDir, safeName);

        // Notify sidebar that test started
        this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
          text: `Starting test: ${safeName}\n`,
          type: "system",
        });

        // Run blueberry-core binary to execute the yaml test case
        const binaryPath = path.join(
          process.cwd(),
          "blueberry-core",
          "target",
          "debug",
          "blueberry-core",
        );

        // Check if debug binary exists, fallback to cargo run
        let childProcess;
        try {
          await fs.access(binaryPath);
          childProcess = spawn(binaryPath, [testPath]);
        } catch {
          // Fallback to cargo run
          childProcess = spawn("cargo", [
            "run",
            "--manifest-path",
            "blueberry-core/Cargo.toml",
            "--",
            testPath,
          ]);
        }

        childProcess.stdout.on("data", (data) => {
          this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
            text: data.toString(),
            type: "stdout",
          });
        });

        childProcess.stderr.on("data", (data) => {
          this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
            text: data.toString(),
            type: "stderr",
          });
        });

        return new Promise((resolve) => {
          childProcess.on("close", (code) => {
            this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
              text: `\nTest finished with exit code ${code}\n`,
              type: "system",
            });
            resolve({ code, success: code === 0 });
          });
        });
      } catch (error) {
        console.error("Failed to run E2E test:", error);
        return { error: (error as Error).message, success: false };
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners();
  }
}
