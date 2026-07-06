import { ipcMain } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { BaseHandler } from "./BaseHandler";
import {
  compilePromptwareSystemAndUser,
  saveReflectionMemory,
  writeLog,
} from "../../utils/promptware";

interface E2EStep {
  type: string;
  url?: string;
  ms?: number;
  selector?: string;
  text?: string;
  path?: string;
  prompt?: string;
}

interface E2EConsoleLog {
  level: string;
  message: string;
  line: number;
  sourceId: string;
  timestamp: string;
}

interface E2ENetworkEvent {
  method: string;
  url: string;
  statusCode: number;
  timestamp: string;
}

export class E2ETestHandler extends BaseHandler {
  private currentE2EProcess: ChildProcess | null = null;
  private isE2ETestAborted = false;

  public register(): void {
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

    ipcMain.handle("run-e2e-test", async (_, filename: string, headful = false) => {
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

        const args = ["run", testPath];
        if (headful) {
          args.push("--headful");
        }

        // Check if debug binary exists, fallback to cargo run
        let childProcess;
        try {
          await fs.access(binaryPath);
          childProcess = spawn(binaryPath, args);
        } catch {
          // Fallback to cargo run
          childProcess = spawn("cargo", [
            "run",
            "--manifest-path",
            "src/code/Cargo.toml",
            "--",
            ...args,
          ]);
        }

        this.currentE2EProcess = childProcess;

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
            this.currentE2EProcess = null;
            this.mainWindow.sidebar.view.webContents.send("e2e-test-log", {
              text: `\nTest finished with exit code ${code}\n`,
              type: "system",
            });
            resolve({ code, success: code === 0 });
          });
        });
      } catch (error) {
        this.currentE2EProcess = null;
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

      if (!this.mainWindow.activeTab) {
        throw new Error("No active tab found in the browser to run tests on.");
      }
      const { webContents } = this.mainWindow.activeTab;

      const consoleLogs: E2EConsoleLog[] = [];
      const networkEvents: E2ENetworkEvent[] = [];

      const handleConsoleMessage = (
        _event: unknown,
        level: number,
        message: string,
        line: number,
        sourceId: string,
      ) => {
        const levels = ["debug", "log", "warning", "error"];
        const levelStr = levels[level] || "log";
        consoleLogs.push({
          level: levelStr,
          message,
          line,
          sourceId,
          timestamp: new Date().toISOString(),
        });
        log(
          "stdout",
          `🖥️ [Console ${levelStr.toUpperCase()}] ${message} (at ${sourceId}:${line})\n`,
        );
      };

      const handleNetworkResponse = (details: unknown) => {
        const d = details as {
          webContentsId?: number;
          method: string;
          url: string;
          statusCode: number;
        };
        if (d.webContentsId === webContents.id) {
          networkEvents.push({
            method: d.method,
            url: d.url,
            statusCode: d.statusCode,
            timestamp: new Date().toISOString(),
          });
          const statusIcon = d.statusCode >= 400 ? "❌" : "📡";
          log(
            "stdout",
            `${statusIcon} [Network Response] ${d.method} ${d.url} -> Status ${d.statusCode}\n`,
          );
        }
      };

      const handleNetworkError = (details: unknown) => {
        const d = details as { webContentsId?: number; method: string; url: string; error: string };
        if (d.webContentsId === webContents.id) {
          networkEvents.push({
            method: d.method,
            url: d.url,
            statusCode: 0,
            timestamp: new Date().toISOString(),
          });
          log("stderr", `❌ [Network Error] ${d.method} ${d.url} -> ${d.error}\n`);
        }
      };

      webContents.on("console-message", handleConsoleMessage);
      webContents.session.webRequest.onCompleted(handleNetworkResponse);
      webContents.session.webRequest.onErrorOccurred(handleNetworkError);

      try {
        this.isE2ETestAborted = false;
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
          await this.runE2ETestAgenticLoop(promptVal, log, consoleLogs, networkEvents);
          log("system", `\nIn-Browser Test finished successfully!\n`);
          return { success: true };
        }

        log("system", `Starting In-Browser Test: ${safeName}\n`);

        for (let index = 0; index < steps.length; index++) {
          if (this.isE2ETestAborted) {
            throw new Error("Test execution aborted by user.");
          }
          const step = steps[index];
          const stepNum = index + 1;

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
            const pageText = await webContents.executeJavaScript(`
              (() => {
                const text = document.body.innerText || '';
                const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
                if (inputs.length === 0) return text;
                const inputLines = inputs.map(el => {
                  const id = el.id ? '#' + el.id : '';
                  const name = el.getAttribute('name') ? '[name="' + el.getAttribute('name') + '"]' : '';
                  const placeholder = el.getAttribute('placeholder') ? ' placeholder="' + el.getAttribute('placeholder') + '"' : '';
                  const type = el.getAttribute('type') || el.tagName.toLowerCase();
                  const value = el.value || '';
                  const label = el.labels && el.labels.length > 0 ? el.labels[0].innerText : '';
                  const labelStr = label ? ' label="' + label + '"' : '';
                  const selector = el.tagName.toLowerCase() + id + name;
                  return \`- \${selector} (type: \${type}, value: "\${value}"\${placeholder}\${labelStr})\`;
                }).join('\\n');
                return text + '\\n\\nForm Fields / Inputs:\\n' + inputLines;
              })()
            `);

            const compiled = await compilePromptwareSystemAndUser("AssertionAgent", {
              Assertion: step.prompt!,
              ConsoleLogs: JSON.stringify(consoleLogs, null, 2),
              NetworkEvents: JSON.stringify(networkEvents, null, 2),
              PageContent: pageText,
            });

            const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
            const model = process.env.OLLAMA_MODEL || "opencode";

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
              signal: AbortSignal.timeout(120000),
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
              const reflectionFilename = await saveReflectionMemory(
                "AssertionAgent",
                reflectionTitle,
                fullRefContent,
                parsedRes.reflection,
              );
              log("stdout", `     💡 Saved learning reflection to memory: ${reflectionFilename}\n`);
            }

            // Log execution details
            const assertionJobId = `job_${new Date()
              .toISOString()
              .replace(/[-:T.]/g, "")
              .slice(0, 15)}`;
            const assertionLogContent = `# AssertionAgent Execution Log\n\n- **Job ID**: ${assertionJobId}\n- **Timestamp**: ${new Date().toISOString()}\n- **Assertion**: ${step.prompt}\n\n## System Prompt\n\n\`\`\`\n${compiled.system}\n\`\`\`\n\n## User Prompt\n\n\`\`\`\n${compiled.user}\n\`\`\`\n\n## Assistant Response (Raw)\n\n\`\`\`json\n${responseText}\n\`\`\`\n`;
            void writeLog("AssertionAgent", assertionJobId, assertionLogContent).catch((err) => {
              console.error("Failed to write AssertionAgent log:", err);
            });

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
      } finally {
        try {
          webContents.off("console-message", handleConsoleMessage);
          webContents.session.webRequest.onCompleted(null);
          webContents.session.webRequest.onErrorOccurred(null);
        } catch (e) {
          console.error("Cleanup of E2E listeners failed:", e);
        }
      }
    });

    ipcMain.handle("kill-e2e-test", async () => {
      try {
        let killed = false;
        this.isE2ETestAborted = true;

        if (this.currentE2EProcess) {
          this.currentE2EProcess.kill("SIGKILL");
          this.currentE2EProcess = null;
          killed = true;
        }

        return { killed, success: true };
      } catch (error) {
        console.error("Failed to kill E2E test:", error);
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

  private async runE2ETestAgenticLoop(
    prompt: string,
    log: (type: "stdout" | "stderr" | "system", text: string) => void,
    consoleLogs: E2EConsoleLog[],
    networkEvents: E2ENetworkEvent[],
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
    const model = process.env.OLLAMA_MODEL || "opencode";

    while (true) {
      if (this.isE2ETestAborted) {
        const errMsg = "Execution stopped: aborted by user.";
        accumulatedLog += `\n### ❌ Execution Stopped\n\nError: ${errMsg}\n`;
        await writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(errMsg);
      }
      if (stepNum > 20) {
        const errMsg =
          "Execution stopped: exceeded maximum steps limit of 20 to prevent infinite loop.";
        accumulatedLog += `\n### ❌ Execution Stopped\n\nError: ${errMsg}\n`;
        await writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(errMsg);
      }

      const stepStart = Date.now();
      log("system", `  [Step ${stepNum}] Reading page context...\n`);

      if (!this.mainWindow.activeTab) {
        throw new Error("No active tab found in the browser to run tests on.");
      }

      const { webContents } = this.mainWindow.activeTab;

      const currentUrl: string = await webContents.executeJavaScript("window.location.href");
      const pageText: string = await webContents.executeJavaScript(`
        (() => {
          const text = document.body.innerText || '';
          const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
          if (inputs.length === 0) return text;
          const inputLines = inputs.map(el => {
            const id = el.id ? '#' + el.id : '';
            const name = el.getAttribute('name') ? '[name="' + el.getAttribute('name') + '"]' : '';
            const placeholder = el.getAttribute('placeholder') ? ' placeholder="' + el.getAttribute('placeholder') + '"' : '';
            const type = el.getAttribute('type') || el.tagName.toLowerCase();
            const value = el.value || '';
            const label = el.labels && el.labels.length > 0 ? el.labels[0].innerText : '';
            const labelStr = label ? ' label="' + label + '"' : '';
            const selector = el.tagName.toLowerCase() + id + name;
            return \`- \${selector} (type: \${type}, value: "\${value}"\${placeholder}\${labelStr})\`;
          }).join('\\n');
          return text + '\\n\\nForm Fields / Inputs:\\n' + inputLines;
        })()
      `);

      // Truncate page text context to 5000 characters to keep it extremely fast and lightweight
      const pageTextTruncated =
        pageText.length > 5000
          ? `${pageText.substring(0, 5000)}... (truncated, total length: ${pageText.length} characters)`
          : pageText;

      const compiled = await compilePromptwareSystemAndUser("E2ETest", {
        ConsoleLogs: JSON.stringify(consoleLogs, null, 2),
        CurrentUrl: currentUrl,
        NetworkEvents: JSON.stringify(networkEvents, null, 2),
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
        signal: AbortSignal.timeout(120000),
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
        submit?: boolean;
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
        await writeLog("E2ETest", jobId, accumulatedLog);
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
        const reflectionFilename = await saveReflectionMemory(
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
        const submit = action.submit === true;
        log(
          "system",
          `  [Step ${stepNum}] ⌨️ Typing '${action.text}' into '${action.selector}'${submit ? " and submitting" : ""}...\n`,
        );
        const js = `
          (() => {
            const el = document.querySelector(${JSON.stringify(action.selector)});
            if (!el) throw new Error("Element not found: " + ${JSON.stringify(action.selector)});
            el.focus();
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                "value"
              )?.set;
              if (nativeInputValueSetter) {
                nativeInputValueSetter.call(el, ${JSON.stringify(action.text)});
              } else {
                el.value = ${JSON.stringify(action.text)};
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              if (${submit}) {
                const keyEvents = ["keydown", "keypress", "keyup"];
                for (const type of keyEvents) {
                  el.dispatchEvent(new KeyboardEvent(type, {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                  }));
                }
                const form = el.form || el.closest("form");
                if (form) {
                  try {
                    form.requestSubmit();
                  } catch (e) {
                    try {
                      form.submit();
                    } catch (err) {}
                  }
                }
              }
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
        await writeLog("E2ETest", jobId, accumulatedLog);
        return;
      } else if (actionName === "fail") {
        log("system", `--------------------------------------------------\n`);
        log("stderr", `❌ Promptware E2ETest Goal FAILED: ${reason}\n`);
        accumulatedLog += `\n## ❌ Goal Failed\n\nReason: ${reason}\n`;
        await writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(`Goal declared as failed by agent. Reason: ${reason}`);
      } else {
        const unknownMsg = `Unknown action: '${actionName}'`;
        accumulatedLog += `- **Error**: ${unknownMsg}\n\n`;
        await writeLog("E2ETest", jobId, accumulatedLog);
        throw new Error(unknownMsg);
      }

      stepNum++;
    }
  }

  public cleanup(): void {
    this.isE2ETestAborted = true;
    if (this.currentE2EProcess) {
      try {
        this.currentE2EProcess.kill("SIGKILL");
      } catch (err) {
        console.error("Failed to kill E2E process on cleanup:", err);
      }
      this.currentE2EProcess = null;
    }
  }
}
