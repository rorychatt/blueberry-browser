import type { WebContents } from "electron";
import { ipcMain } from "electron";
import type { Window } from "../components/Window";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

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
            log("system", `  [${stepNum}] Local Ollama Agent evaluation: '${step.prompt}'...\n`);
            const pageText = await webContents.executeJavaScript("document.body.innerText");

            const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
            const model = process.env.OLLAMA_MODEL || "qwen3.6";

            const systemPrompt = `You are Blueberry-Agent, an advanced visual/textual E2E testing agent.
Your job is to analyze the current text content of a webpage and determine if the user's assertion/goal has been met.
You MUST output your response as a valid JSON object with the following schema:
{
  "success": true or false,
  "reason": "A concise explanation based on the evidence found in the webpage content."
}
Only output the JSON object. Do not include markdown code blocks or conversational text outside of the JSON.`;

            const payload = {
              model,
              options: {
                temperature: 0.1,
              },
              prompt: `Goal/Assertion: ${step.prompt}\n\nWebpage Text Content:\n---\n${pageText}\n---\n\nRespond with the JSON object:`,
              stream: false,
              system: systemPrompt,
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
            responseText = responseText
              .replace(/^```json/, "")
              .replace(/```$/, "")
              .trim();

            const parsedRes = JSON.parse(responseText);
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

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners();
  }
}
