import type { WebContents } from "electron";
import { ipcMain } from "electron";
import type { Window } from "../components/Window";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { SettingsManager } from "../services/SettingsManager";
import { HistoryManager, type HistoryEntry } from "../services/HistoryManager";

interface E2EStep {
  type: string;
  url?: string;
  ms?: number;
  selector?: string;
  text?: string;
  path?: string;
  prompt?: string;
}

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

    // Primary color events
    this.handlePrimaryColorEvents();

    // Debug events
    this.handleDebugEvents();

    // E2E Test events
    this.handleE2ETestEvents();

    // Settings events
    this.handleSettingsEvents();

    // History events
    this.handleHistoryEvents();

    // TopBar dynamic events
    this.handleTopBarEvents();
  }

  private handleTopBarEvents(): void {
    // Handle topbar dynamic height adjustments
    ipcMain.handle("set-topbar-height", (_, height: number) => {
      if (this.mainWindow.topBar) {
        this.mainWindow.topBar.setHeight(height);
        // Bring views to front when expanded so they stack above the active tab
        if (height > 88) {
          this.mainWindow.bringViewsToFront();
        }
      }
    });
  }

  private handleSettingsEvents(): void {
    // Get custom shortcuts
    ipcMain.handle("get-shortcuts", async () => {
      const shortcuts = await SettingsManager.getInstance().getShortcuts();
      return shortcuts;
    });

    // Save custom shortcuts
    ipcMain.handle("save-shortcuts", async (_, shortcuts) => {
      await SettingsManager.getInstance().saveShortcuts(shortcuts);
      // Reload shortcuts dynamically on the main window!
      await this.mainWindow.loadShortcuts();
      return true;
    });

    // Get all settings
    ipcMain.handle("get-settings", async () => {
      const settings = await SettingsManager.getInstance().getSettings();
      return settings;
    });

    // Save all settings
    ipcMain.handle("save-settings", async (_, settings) => {
      await SettingsManager.getInstance().saveSettings(settings);
      // Reload settings dynamically on the main window!
      await this.mainWindow.loadSettings();
      return true;
    });
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
        canGoBack: tab.webContents.navigationHistory.canGoBack(),
        canGoForward: tab.webContents.navigationHistory.canGoForward(),
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
          canGoBack: activeTab.webContents.navigationHistory.canGoBack(),
          canGoForward: activeTab.webContents.navigationHistory.canGoForward(),
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

  private handlePrimaryColorEvents(): void {
    // Primary color broadcasting
    ipcMain.on("primary-color-changed", (event, primaryColor) => {
      this.broadcastPrimaryColor(event.sender, primaryColor);
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

  private broadcastPrimaryColor(sender: WebContents, primaryColor: string): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send("primary-color-updated", primaryColor);
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send("primary-color-updated", primaryColor);
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("primary-color-updated", primaryColor);
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
          return {
            error: "Filename must end with .yaml or .yml",
            success: false,
          };
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
            // Ignore
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
          "src",
          "code",
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
            "src/code/Cargo.toml",
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

    ipcMain.handle("run-e2e-test-in-browser", async (_, filename: string) => {
      const log = (type: "stdout" | "stderr" | "system", text: string) => {
        this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
          text,
          type,
        });
      };

      try {
        const safeName = path.basename(filename);
        const testPath = path.join(testsDir, safeName);
        const content = await fs.readFile(testPath, "utf8");
        const steps = this.parseYamlSteps(content);

        // Detect if prompt-only YAML test
        let promptVal: string | null = null;
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("prompt:")) {
            let val = trimmed.substring("prompt:".length).trim();
            val = val.replaceAll(/^['"]|['"]$/g, "");
            promptVal = val;
            break;
          }
        }

        if (promptVal && steps.length === 0) {
          log("system", `Starting Agentic Prompt-Only Test: ${safeName}\n`);
          await this.runE2ETestAgenticLoop(promptVal, log);
          log("system", `\nIn-Browser Test finished successfully!\n`);
          return { success: true };
        }

        log("system", `Starting In-Browser Test: ${safeName}\n`);

        for (let index = 0; index < steps.length; index++) {
          const step = steps[index];
          const stepNum = index + 1;

          if (!this.mainWindow.activeTab) {
            throw new Error("No active tab found in the browser to run tests on.");
          }

          const { webContents } = this.mainWindow.activeTab;

          if (step.type === "navigate") {
            log("system", `  [${stepNum}] Navigate to '${step.url}'...\n`);
            await webContents.loadURL(step.url!);
            await new Promise<void>((resolve) => {
              if (!webContents.isLoading()) {
                resolve();
                return;
              }
              webContents.once("did-stop-loading", () => {
                resolve();
              });
            });
            log("stdout", `✓ Navigated to ${step.url}\n`);
          } else if (step.type === "wait") {
            log("system", `  [${stepNum}] Wait ${step.ms}ms...\n`);
            await new Promise((resolve) => setTimeout(resolve, step.ms));
            log("stdout", `✓ Wait complete\n`);
          } else if (step.type === "click") {
            log("system", `  [${stepNum}] Click element '${step.selector}'...\n`);
            const js = `
              (() => {
                const el = document.querySelector(${JSON.stringify(step.selector)});
                if (!el) throw new Error("Element not found: " + ${JSON.stringify(step.selector)});
                el.click();
                return true;
              })()
            `;
            await webContents.executeJavaScript(js);
            log("stdout", `✓ Clicked ${step.selector}\n`);
          } else if (step.type === "type") {
            log("system", `  [${stepNum}] Type '${step.text}' into '${step.selector}'...\n`);
            const js = `
              (() => {
                const el = document.querySelector(${JSON.stringify(step.selector)});
                if (!el) throw new Error("Element not found: " + ${JSON.stringify(step.selector)});
                el.focus();
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                  el.value = ${JSON.stringify(step.text)};
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  el.textContent = ${JSON.stringify(step.text)};
                }
                return true;
              })()
            `;
            await webContents.executeJavaScript(js);
            log("stdout", `✓ Typed text into ${step.selector}\n`);
          } else if (step.type === "wait_for") {
            log("system", `  [${stepNum}] Wait for element '${step.selector}'...\n`);
            const checkJs = `!!document.querySelector(${JSON.stringify(step.selector)})`;
            let found = false;
            for (let attempt = 0; attempt < 20; attempt++) {
              try {
                found = await webContents.executeJavaScript(checkJs);
                if (found) {
                  break;
                }
              } catch {
                // Ignore error, retry on next attempt
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            if (found) {
              log("stdout", `✓ Element ${step.selector} is visible\n`);
            } else {
              throw new Error(`Timeout waiting for element: ${step.selector}`);
            }
          } else if (step.type === "screenshot") {
            log("system", `  [${stepNum}] Take screenshot saved to '${step.path}'...\n`);
            const image = await webContents.capturePage();
            const buffer = image.toPNG();
            const screenshotPath = path.join(process.cwd(), "tests", step.path!);
            await fs.writeFile(screenshotPath, buffer);
            log("stdout", `✓ Saved screenshot to '${step.path}'\n`);
          } else if (step.type === "agent") {
            log(
              "system",
              `  [${stepNum}] Local Ollama Agent evaluation (AssertionAgent): '${step.prompt}'...\n`,
            );
            const pageText = await webContents.executeJavaScript("document.body.innerText");

            const compiled = await this.compilePromptwareSystemAndUser("AssertionAgent", {
              Assertion: step.prompt!,
              PageContent: pageText,
            });

            const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
            const model = process.env.OLLAMA_MODEL || "qwen3.6";

            const payload = {
              model,
              options: {
                temperature: 0.1,
              },
              prompt: compiled.user,
              stream: false,
              system: compiled.system,
            };

            const response = await fetch(`${endpoint}/api/generate`, {
              body: JSON.stringify(payload),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });

            if (!response.ok) {
              throw new Error(`Ollama returned status ${response.status}`);
            }

            const json = (await response.json()) as { response?: string };
            let responseText = json.response || "";
            responseText = responseText.trim();
            if (responseText.startsWith("```json")) {
              responseText = responseText.substring(7);
              if (responseText.endsWith("```")) {
                responseText = responseText.substring(0, responseText.length - 3);
              }
            } else if (responseText.startsWith("```")) {
              responseText = responseText.substring(3);
              if (responseText.endsWith("```")) {
                responseText = responseText.substring(0, responseText.length - 3);
              }
            }
            responseText = responseText.trim();

            const parsedRes = JSON.parse(responseText) as {
              success: boolean;
              reason: string;
              reflection?: string;
              reflection_title?: string;
            };

            // Save learning/reflection if present!
            if (parsedRes.reflection && parsedRes.reflection.trim()) {
              const reflectionTitle =
                parsedRes.reflection_title || step.prompt || "assertion_evaluation";
              const fullRefContent = `# Reflection - Assertion evaluation\n\n- **Assertion**: ${step.prompt}\n- **Success**: ${parsedRes.success}\n- **Reason**: ${parsedRes.reason}\n- **Reflection/Learning**:\n${parsedRes.reflection}\n`;
              const reflectionFilename = await this.saveReflectionMemory(
                "AssertionAgent",
                reflectionTitle,
                fullRefContent,
                parsedRes.reflection,
              );
              log("stdout", `     💡 Saved learning reflection to memory: ${reflectionFilename}\n`);
            }

            if (parsedRes.success) {
              log("stdout", `✓ Agent Assertion Passed!\n     AI Reason: ${parsedRes.reason}\n`);
            } else {
              log("stderr", `✗ Agent Assertion Failed!\n     AI Reason: ${parsedRes.reason}\n`);
              throw new Error(`Agent Assertion Failed: ${parsedRes.reason}`);
            }
          }
        }

        log("system", `\nIn-Browser Test finished successfully!\n`);
        return { success: true };
      } catch (error) {
        log("stderr", `✗ Test execution failed: ${(error as Error).message}\n`);
        return { error: (error as Error).message, success: false };
      }
    });
  }

  private parseYamlSteps(yamlStr: string): E2EStep[] {
    const steps: E2EStep[] = [];
    const lines = yamlStr.split("\n");
    let currentStep: E2EStep | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      if (line.startsWith("steps:")) {
        continue;
      }
      if (line.startsWith("name:")) {
        continue;
      }

      if (line.startsWith("-")) {
        const stepContent = line.slice(1).trim();
        const firstColon = stepContent.indexOf(":");
        if (firstColon !== -1) {
          const key = stepContent.substring(0, firstColon).trim();
          let val = stepContent.substring(firstColon + 1).trim();
          val = val.replaceAll(/^['"]|['"]$/g, "");

          if (key === "navigate") {
            steps.push({ type: "navigate", url: val });
          } else if (key === "wait") {
            steps.push({ ms: Number.parseInt(val, 10), type: "wait" });
          } else if (key === "click") {
            steps.push({ selector: val, type: "click" });
          } else if (key === "wait_for") {
            steps.push({ selector: val, type: "wait_for" });
          } else if (key === "screenshot") {
            steps.push({ path: val, type: "screenshot" });
          } else if (key === "agent") {
            steps.push({ prompt: val, type: "agent" });
          } else if (key === "type") {
            currentStep = { selector: "", text: "", type: "type" };
            steps.push(currentStep);
          }
        }
      } else if (currentStep && currentStep.type === "type") {
        const colon = line.indexOf(":");
        if (colon !== -1) {
          const key = line.substring(0, colon).trim();
          let val = line.substring(colon + 1).trim();
          val = val.replaceAll(/^['"]|['"]$/g, "");
          if (key === "selector") {
            currentStep.selector = val;
          } else if (key === "text") {
            currentStep.text = val;
          }
        }
      }
    }
    return steps;
  }

  private getPromptwaresDir(): string {
    const workspaceDir = process.cwd();
    const possiblePaths = [
      path.join(workspaceDir, "src", "promptwares"),
      path.join(workspaceDir, "promptwares"),
    ];
    for (const p of possiblePaths) {
      try {
        if (existsSync(p)) {
          return p;
        }
      } catch {
        // Path does not exist or is not readable
      }
    }
    return "/Users/rorychatt/git/rorychatt/blueberry-browser/src/promptwares";
  }

  private async compilePromptwareSystemAndUser(
    name: string,
    values: Record<string, string>,
  ): Promise<{ system: string; user: string }> {
    const promptwaresDir = this.getPromptwaresDir();
    const folder = path.join(promptwaresDir, name);

    let systemInstructions = "";

    const primaryPath = path.join(folder, "system_prompt.md");
    const fallbackPath = path.join(folder, "Program.md");

    if (existsSync(primaryPath)) {
      try {
        systemInstructions = await fs.readFile(primaryPath, "utf8");
      } catch (error) {
        console.error(`Failed to read system_prompt.md for promptware ${name}:`, error);
      }
    }

    if (!systemInstructions && existsSync(fallbackPath)) {
      try {
        systemInstructions = await fs.readFile(fallbackPath, "utf8");
      } catch (error) {
        console.error(`Failed to read Program.md fallback for promptware ${name}:`, error);
      }
    }

    if (!systemInstructions) {
      systemInstructions = `# ${name} Program\nNo instructions found.`;
    }

    // Load Memory files
    const memoryDir = path.join(folder, "memory");
    const memoryFiles: string[] = [];
    let memoryContents = "";
    try {
      if (existsSync(memoryDir)) {
        const files = await fs.readdir(memoryDir);
        const mdFiles = files.filter((f) => f.endsWith(".md") && f !== ".gitkeep");

        for (const file of mdFiles) {
          memoryFiles.push(file);
          try {
            const content = await fs.readFile(path.join(memoryDir, file), "utf8");
            memoryContents += `### File: ${file}\n\n${content}\n\n---\n\n`;
          } catch {
            // Ignore files that cannot be read
          }
        }
      }
    } catch (err) {
      console.error(`Failed to read memories for ${name}:`, err);
    }

    const memoryFilesListing =
      memoryFiles.length === 0 ? "(no memory files yet)" : memoryFiles.join(", ");
    const memoryContentsSection =
      memoryContents === "" ? "(no accumulated memories yet)" : memoryContents;

    const systemPrompt = `You are an agentic application that evolves over time.

This prompt is your Firmware and is never allowed to change.

Your program folder is: ${folder}

## Goal

Your goal is to complete the instructions in the **System Instructions** section below with the following priority:

1. Completeness
2. Speed
3. Token efficiency
4. Improvement over time

**Memory Files:**
${memoryFilesListing}

**Accumulated Memories / Reflections:**
${memoryContentsSection}

To read a memory file offline:
Use the CLI command: \`blueberry-core promptware-read-memory ${name} <filename>.md\`

Complete your task and return the appropriate output.

## Reflection

Every execution needs to end with a reflection step. This is your opportunity to improve over time. What did we learn during this session?
When you return your final JSON response, provide a \`reflection\` field containing your key takeaways, lessons, or rules learned. This will be automatically written to a memory file for you.

## System Instructions

${systemInstructions}
`;

    // Load user prompt
    const userMdPath = path.join(folder, "user_prompt.md");
    let userPrompt = "";
    if (existsSync(userMdPath)) {
      try {
        const userTemplate = await fs.readFile(userMdPath, "utf8");
        let compiledUser = userTemplate;
        for (const [key, val] of Object.entries(values)) {
          compiledUser = compiledUser.replaceAll(`{{${key}}}`, val);
        }
        userPrompt = compiledUser;
      } catch (err) {
        console.error(`Failed to read user_prompt.md for ${name}:`, err);
      }
    }

    if (!userPrompt) {
      // Fallback to default user prompt format
      const headerStr = Object.keys(values)
        .toSorted()
        .map((key) => `${key}: ${values[key]}`)
        .join("\n");
      userPrompt = `---\n${headerStr}\n---`;
    }

    return { system: systemPrompt, user: userPrompt };
  }

  private async saveReflectionMemory(
    promptwareName: string,
    titleOrPrompt: string,
    fullRefContent: string,
    coreReflection: string,
  ): Promise<string> {
    const slug =
      titleOrPrompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50) || "reflection";
    const filename = `${slug}.md`;

    const promptwaresDir = this.getPromptwaresDir();
    const memoryDir = path.join(promptwaresDir, promptwareName, "memory");
    await fs.mkdir(memoryDir, { recursive: true });
    const filePath = path.join(memoryDir, filename);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(filePath, "utf8");
    } catch {
      // File does not exist
    }

    if (existingContent) {
      if (existingContent.includes(coreReflection.trim())) {
        return filename;
      }
      const updatedContent = `${existingContent.trim()}\n\n---\n\n${fullRefContent.trim()}\n`;
      await fs.writeFile(filePath, updatedContent, "utf8");
    } else {
      await fs.writeFile(filePath, `${fullRefContent.trim()}\n`, "utf8");
    }

    return filename;
  }

  private async writeLog(promptwareName: string, jobId: string, content: string): Promise<void> {
    const promptwaresDir = this.getPromptwaresDir();
    const logsDir = path.join(promptwaresDir, promptwareName, "logs");
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(path.join(logsDir, `${jobId}.md`), content, "utf8");
  }

  private async runE2ETestAgenticLoop(
    prompt: string,
    log: (type: "stdout" | "stderr" | "system", text: string) => void,
  ): Promise<void> {
    const startTime = Date.now();
    const jobId = `job_${new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 15)}`;
    log("system", `🤖 Promptware Agent running E2ETest (Job ID: ${jobId})\n`);
    log("system", `🎯 Target Goal: '${prompt}'\n`);
    log("system", `--------------------------------------------------\n`);

    let stepNum = 1;
    let accumulatedLog = `# E2ETest Promptware Job Log (${jobId})\n\n- **Target Goal**: ${prompt}\n- **Started At**: ${new Date().toISOString()}\n\n## Steps\n\n`;

    const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "qwen3.6";

    while (true) {
      if (stepNum > 20) {
        const errMsg =
          "Execution stopped: exceeded maximum steps limit of 20 to prevent infinite loop.";
        accumulatedLog += `\n### ❌ Execution Stopped\n\nError: ${errMsg}\n`;
        await this.writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(errMsg);
      }

      const stepStart = Date.now();
      log("system", `  [Step ${stepNum}] Reading page context...\n`);

      if (!this.mainWindow.activeTab) {
        throw new Error("No active tab found in the browser to run tests on.");
      }

      const { webContents } = this.mainWindow.activeTab;

      const currentUrl: string = await webContents.executeJavaScript("window.location.href");
      const pageText: string = await webContents.executeJavaScript("document.body.innerText");

      // Truncate page text context to 5000 characters to keep it extremely fast and lightweight
      const pageTextTruncated =
        pageText.length > 5000
          ? `${pageText.substring(0, 5000)}... (truncated, total length: ${pageText.length} characters)`
          : pageText;

      const compiled = await this.compilePromptwareSystemAndUser("E2ETest", {
        CurrentUrl: currentUrl,
        PageContent: pageTextTruncated,
        Prompt: prompt,
      });

      log("system", `  [Step ${stepNum}] Evaluating next action using local Ollama model...\n`);

      const payload = {
        model,
        options: {
          temperature: 0.1,
        },
        prompt: compiled.user,
        stream: false,
        system: compiled.system,
      };

      const response = await fetch(`${endpoint}/api/generate`, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const json = (await response.json()) as { response?: string };
      let responseText = json.response || "";

      // Clean JSON block if wrapped in markdown code blocks
      responseText = responseText.trim();
      if (responseText.startsWith("```json")) {
        responseText = responseText.substring(7);
        if (responseText.endsWith("```")) {
          responseText = responseText.substring(0, responseText.length - 3);
        }
      } else if (responseText.startsWith("```")) {
        responseText = responseText.substring(3);
        if (responseText.endsWith("```")) {
          responseText = responseText.substring(0, responseText.length - 3);
        }
      }
      responseText = responseText.trim();

      interface Action {
        action: string;
        url?: string;
        selector?: string;
        text?: string;
        ms?: number;
        reason?: string;
        reflection?: string;
        reflection_title?: string;
      }

      let action: Action;
      try {
        action = JSON.parse(responseText) as Action;
      } catch (err) {
        log("stderr", `  [Step ${stepNum}] ❌ Failed to parse JSON response from LLM!\n`);
        log("stderr", `     Raw Output:\n---\n${json.response || ""}\n---\n`);
        accumulatedLog += `### Step ${stepNum}\n- **Current URL**: ${currentUrl}\n- **Error**: Failed to parse JSON response: ${(err as Error).message}\n- **Raw Model Response**:\n\`\`\`\n${json.response || ""}\n\`\`\`\n\n`;
        await this.writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(
          `Failed to parse action JSON: ${(err as Error).message}. Model output: '${responseText}'`,
          { cause: err },
        );
      }

      const actionName = (action.action || "").toLowerCase();
      const reason = action.reason || "No reason provided.";
      log("stdout", `  [Step ${stepNum}] Action decided: '${actionName}' (reason: '${reason}')\n`);

      const elapsedMs = Date.now() - stepStart;
      accumulatedLog += `### Step ${stepNum}\n- **Current URL**: ${currentUrl}\n- **Action**: \`${actionName}\`\n- **Reason**: ${reason}\n- **Elapsed**: ${elapsedMs}ms\n\n`;

      // If reflection/learning is generated, let's write it to memory!
      if (action.reflection && action.reflection.trim()) {
        const reflectionTitle = action.reflection_title || prompt || "e2e_test";
        const fullRefContent = `# Reflection - Step ${stepNum}\n\n- **Prompt**: ${prompt}\n- **Action**: ${actionName}\n- **Reason**: ${reason}\n- **Reflection/Learning**:\n${action.reflection}\n`;
        const reflectionFilename = await this.saveReflectionMemory(
          "E2ETest",
          reflectionTitle,
          fullRefContent,
          action.reflection,
        );
        log(
          "stdout",
          `  [Step ${stepNum}] 💡 Saved learning reflection to memory: ${reflectionFilename}\n`,
        );
        accumulatedLog += `- **💡 Learning Saved**: ${reflectionFilename}\n\n`;
      }

      if (actionName === "navigate") {
        if (!action.url) {
          throw new Error("Action 'navigate' requires a 'url' field");
        }
        log("system", `  [Step ${stepNum}] 🌐 Navigating to '${action.url}'...\n`);
        await webContents.loadURL(action.url);
        await new Promise<void>((resolve) => {
          if (!webContents.isLoading()) {
            resolve();
            return;
          }
          webContents.once("did-stop-loading", () => {
            resolve();
          });
        });
      } else if (actionName === "click") {
        if (!action.selector) {
          throw new Error("Action 'click' requires a 'selector' field");
        }
        log("system", `  [Step ${stepNum}] 🖱️ Clicking element '${action.selector}'...\n`);
        const js = `
          (() => {
            const el = document.querySelector(${JSON.stringify(action.selector)});
            if (!el) throw new Error("Element not found: " + ${JSON.stringify(action.selector)});
            el.click();
            return true;
          })()
        `;
        await webContents.executeJavaScript(js);
      } else if (actionName === "type") {
        if (!action.selector) {
          throw new Error("Action 'type' requires a 'selector' field");
        }
        if (action.text === undefined) {
          throw new Error("Action 'type' requires a 'text' field");
        }
        log(
          "system",
          `  [Step ${stepNum}] ⌨️ Typing '${action.text}' into '${action.selector}'...\n`,
        );
        const js = `
          (() => {
            const el = document.querySelector(${JSON.stringify(action.selector)});
            if (!el) throw new Error("Element not found: " + ${JSON.stringify(action.selector)});
            el.focus();
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              el.value = ${JSON.stringify(action.text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              el.textContent = ${JSON.stringify(action.text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return true;
          })()
        `;
        await webContents.executeJavaScript(js);
      } else if (actionName === "wait") {
        const ms = action.ms || 1000;
        log("system", `  [Step ${stepNum}] ⏱️ Waiting ${ms}ms...\n`);
        await new Promise((resolve) => setTimeout(resolve, ms));
      } else if (actionName === "wait_for") {
        if (!action.selector) {
          throw new Error("Action 'wait_for' requires a 'selector' field");
        }
        log("system", `  [Step ${stepNum}] 🔍 Waiting for element '${action.selector}'...\n`);
        const checkJs = `!!document.querySelector(${JSON.stringify(action.selector)})`;
        let found = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          try {
            found = await webContents.executeJavaScript(checkJs);
            if (found) {
              break;
            }
          } catch {
            // Ignore error
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!found) {
          throw new Error(`Timeout waiting for element: ${action.selector}`);
        }
      } else if (actionName === "screenshot") {
        const pathSuffix = action.selector || action.text || "tests/screenshot.png";
        log("system", `  [Step ${stepNum}] 📸 Taking screenshot saved to '${pathSuffix}'...\n`);
        const image = await webContents.capturePage();
        const buffer = image.toPNG();
        const screenshotPath = path.join(
          process.cwd(),
          pathSuffix.startsWith("tests/") ? pathSuffix : path.join("tests", pathSuffix),
        );
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await fs.writeFile(screenshotPath, buffer);
      } else if (actionName === "complete") {
        log("system", `--------------------------------------------------\n`);
        log(
          "stdout",
          `🎉 Promptware E2ETest Goal ACHIEVED in ${Math.round((Date.now() - startTime) / 1000)}s\n`,
        );
        accumulatedLog += `\n## 🎉 Goal Achieved Successfully\n\nPassed in ${Date.now() - startTime}ms\n`;
        await this.writeLog("E2ETest", jobId, accumulatedLog);
        return;
      } else if (actionName === "fail") {
        log("system", `--------------------------------------------------\n`);
        log("stderr", `❌ Promptware E2ETest Goal FAILED: ${reason}\n`);
        accumulatedLog += `\n## ❌ Goal Failed\n\nReason: ${reason}\n`;
        await this.writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(`Goal declared as failed by agent. Reason: ${reason}`);
      } else {
        const unknownMsg = `Unknown action: '${actionName}'`;
        accumulatedLog += `- **Error**: ${unknownMsg}\n\n`;
        await this.writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(unknownMsg);
      }

      stepNum++;
    }
  }

  private handleHistoryEvents(): void {
    // Get complete browsing history
    ipcMain.handle("get-history", async () => {
      try {
        return await HistoryManager.getInstance().getHistory();
      } catch (error) {
        console.error("Error getting history:", error);
        return [];
      }
    });

    // Delete a specific history entry by ID
    ipcMain.handle("delete-history-entry", async (_, id: string) => {
      try {
        return await HistoryManager.getInstance().deleteHistoryEntry(id);
      } catch (error) {
        console.error("Error deleting history entry:", error);
        return false;
      }
    });

    // Clear the entire browsing history
    ipcMain.handle("clear-history", async () => {
      try {
        await HistoryManager.getInstance().clearHistory();
        return true;
      } catch (error) {
        console.error("Error clearing history:", error);
        return false;
      }
    });

    // Get agentic suggestions based on browsing context and history
    ipcMain.handle(
      "get-history-suggestions",
      async (
        _,
        historyList: HistoryEntry[],
        currentPage: { url: string; title: string } | null,
      ) => {
        try {
          const formattedHistory =
            historyList && historyList.length > 0
              ? historyList
                  .slice(0, 15)
                  .map(
                    (entry) =>
                      `- [${new Date(entry.timestamp).toISOString()}] ${entry.title || "New Tab"} (${entry.url})`,
                  )
                  .join("\n")
              : "(No history entries yet)";

          const currentUrl = currentPage?.url || "None";
          const currentTitle = currentPage?.title || "None";

          const compiled = await this.compilePromptwareSystemAndUser("HistoryAgent", {
            CurrentUrl: currentUrl,
            CurrentTitle: currentTitle,
            HistoryList: formattedHistory,
          });

          const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
          const model = process.env.OLLAMA_MODEL || "qwen3.6";

          const payload = {
            model,
            options: {
              temperature: 0.1,
            },
            prompt: compiled.user,
            stream: false,
            system: compiled.system,
          };

          const response = await fetch(`${endpoint}/api/generate`, {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });

          if (!response.ok) {
            throw new Error(`Ollama returned status ${response.status}`);
          }

          const json = (await response.json()) as { response?: string };
          let responseText = json.response || "";
          responseText = responseText.trim();

          // Clean JSON formatting markdown fences
          if (responseText.startsWith("```json")) {
            responseText = responseText.substring(7);
            if (responseText.endsWith("```")) {
              responseText = responseText.substring(0, responseText.length - 3);
            }
          } else if (responseText.startsWith("```")) {
            responseText = responseText.substring(3);
            if (responseText.endsWith("```")) {
              responseText = responseText.substring(0, responseText.length - 3);
            }
          }
          responseText = responseText.trim();

          const parsedRes = JSON.parse(responseText) as {
            suggestions: {
              title: string;
              url: string;
              reason: string;
              type: "search" | "history" | "tool";
            }[];
            reflection?: string;
            reflection_title?: string;
          };

          // Write reflection memory offline for agent self-learning
          if (parsedRes.reflection && parsedRes.reflection.trim()) {
            const reflectionTitle = parsedRes.reflection_title || "history_patterns";
            const fullRefContent = `# HistoryAgent Reflection\n\n- **Date**: ${new Date().toISOString()}\n- **Current Page**: ${currentTitle} (${currentUrl})\n- **Reflection/Pattern Identified**:\n${parsedRes.reflection}\n`;
            await this.saveReflectionMemory(
              "HistoryAgent",
              reflectionTitle,
              fullRefContent,
              parsedRes.reflection,
            );
          }

          return { suggestions: parsedRes.suggestions || [] };
        } catch (error) {
          console.error("Failed to generate history suggestions:", error);
          // Fallback offline suggestion if LLM is offline or fails to parse
          return {
            suggestions: [
              {
                title: "Search the Web",
                url: "https://www.google.com",
                reason: "Local AI suggestions are offline. Click to open search.",
                type: "search",
              },
            ],
          };
        }
      },
    );
  }

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners();
  }
}
