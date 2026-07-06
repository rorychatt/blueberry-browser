import type { WebContents } from "electron";
import { type LanguageModel, type ModelMessage, streamText } from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
import { join } from "node:path";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import type { Window } from "../components/Window";
import { AccessibilityExtractor } from "./AccessibilityExtractor";
import { BrowserSkills } from "./BrowserSkills";

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, "../../src/.env") });

interface ChatRequest {
  message: string;
  messageId: string;
}

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mediaType: string };

type LLMProvider = "openai" | "anthropic" | "ollama";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-3-5-sonnet-20241022",
  ollama: "opencode",
  openai: "gpt-4o-mini",
};

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private readonly provider: LLMProvider;
  private readonly modelName: string;
  private readonly model: LanguageModel | null;
  private messages: ModelMessage[] = [];

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();

    this.logInitializationStatus();
  }

  // Set the window reference after construction to avoid circular dependencies
  setWindow(window: Window): void {
    this.window = window;
  }

  private getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (provider === "anthropic") {
      return "anthropic";
    }
    if (provider === "ollama") {
      return "ollama";
    }
    return "openai"; // Default to OpenAI
  }

  private getModelName(): string {
    return process.env.LLM_MODEL || DEFAULT_MODELS[this.provider];
  }

  private initializeModel(): LanguageModel | null {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return null;
    }

    switch (this.provider) {
      case "anthropic": {
        return anthropic(this.modelName);
      }
      case "openai": {
        return openai(this.modelName);
      }
      case "ollama": {
        const customOpenAI = createOpenAI({
          apiKey: "ollama",
          baseURL: "http://localhost:11434/v1",
          fetch: (input, init) => this.ollamaFetch(input, init),
        });
        return customOpenAI.chat(this.modelName);
      }
      default: {
        return null;
      }
    }
  }

  private async ollamaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const originalResponse = await globalThis.fetch(input, init);

    if (!originalResponse.body) {
      return originalResponse;
    }

    const modifiedStream = new ReadableStream({
      async start(controller) {
        const reader = originalResponse.body!.getReader();
        const decoder = new TextDecoder("utf-8");
        const encoder = new TextEncoder();
        let inReasoning = false;
        let buffer = "";

        const processLine = (line: string) => {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              controller.enqueue(encoder.encode(line + "\n"));
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                const reasoning = delta.reasoning;
                const content = delta.content;

                if (reasoning && (!content || content === "")) {
                  if (!inReasoning) {
                    inReasoning = true;
                    delta.content = "<think>\n" + reasoning;
                  } else {
                    delta.content = reasoning;
                  }
                  delete delta.reasoning;
                } else if (content && content !== "") {
                  if (inReasoning) {
                    inReasoning = false;
                    delta.content = "\n</think>\n\n" + content;
                  }
                }
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n`));
            } catch {
              controller.enqueue(encoder.encode(line + "\n"));
            }
          } else {
            controller.enqueue(encoder.encode(line + "\n"));
          }
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                processLine(buffer);
              }
              if (inReasoning) {
                const lastLine =
                  'data: {"id":"chatcmpl-custom","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"\\n</think>\\n\\n"}}]}\n';
                controller.enqueue(encoder.encode(lastLine));
              }
              break;
            }

            const chunkText = decoder.decode(value, { stream: true });
            buffer += chunkText;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              processLine(line);
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(modifiedStream, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: originalResponse.headers,
    });
  }

  private getApiKey(): string | undefined {
    switch (this.provider) {
      case "anthropic": {
        return process.env.ANTHROPIC_API_KEY;
      }
      case "openai": {
        return process.env.OPENAI_API_KEY;
      }
      case "ollama": {
        return "ollama";
      }
      default: {
        return undefined;
      }
    }
  }

  private logInitializationStatus(): void {
    if (this.model) {
      console.log(
        `✅ LLM Client initialized with ${this.provider} provider using model: ${this.modelName}`,
      );
    } else {
      const keyName = this.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      console.error(
        `❌ LLM Client initialization failed: ${keyName} not found in environment variables.\n` +
          `Please add your API key to the .env file in the project root.`,
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    try {
      // Get screenshot from active tab if available
      let screenshot: string | null = null;
      if (this.window) {
        const { activeTab } = this.window;
        if (activeTab) {
          try {
            const image = await activeTab.screenshot();
            screenshot = image.toDataURL();
          } catch (error) {
            console.error("Failed to capture screenshot:", error);
          }
        }
      }

      // Build user message content with screenshot first, then text
      const userContent: MessageContentPart[] = [];

      // Only include screenshot for providers that are known to support vision models
      // (like OpenAI, Anthropic) or if Ollama model name explicitly contains 'vision'.
      const supportsVision =
        this.provider !== "ollama" || this.modelName.toLowerCase().includes("vision");

      if (screenshot && supportsVision) {
        const base64Data = screenshot.includes("base64,")
          ? screenshot.split("base64,")[1]
          : screenshot;

        userContent.push({
          image: base64Data,
          type: "image",
        });
      }

      // Add text content
      userContent.push({
        text: request.message,
        type: "text",
      });

      // Create user message in ModelMessage format
      const userMessage: ModelMessage = {
        content: userContent.length === 1 ? request.message : userContent,
        role: "user",
      };

      this.messages.push(userMessage);

      // Send updated messages to renderer
      this.sendMessagesToRenderer();

      if (!this.model) {
        this.sendErrorMessage(
          request.messageId,
          "LLM service is not configured. Please add your API key to the .env file.",
        );
        return;
      }

      console.log(`[LLMClient] Preparing message context for prompt: "${request.message}"`);
      const contextStartTime = Date.now();
      const { system, messages } = await this.prepareMessagesWithContext(request);
      const prepDuration = Date.now() - contextStartTime;
      console.log(
        `[LLMClient] Context prepared in ${prepDuration}ms. ` +
          `System prompt size: ${system.length} characters. ` +
          `Message history count: ${messages.length}`,
      );

      await this.streamResponse(messages, system, request.messageId);
    } catch (error) {
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    }
  }

  clearMessages(): void {
    this.messages = [];
    this.sendMessagesToRenderer();
  }

  getMessages(): ModelMessage[] {
    return this.messages;
  }

  private sendMessagesToRenderer(): void {
    this.webContents.send("chat-messages-updated", this.messages);
  }

  private getPromptwaresDir(): string {
    const workspaceDir = process.cwd();
    const possiblePaths = [
      join(workspaceDir, "src", "promptwares"),
      join(workspaceDir, "promptwares"),
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

  private async compilePromptware(name: string, headers: Record<string, string>): Promise<string> {
    const promptwaresDir = this.getPromptwaresDir();
    const programFolder = join(promptwaresDir, name);

    let programMd = "";
    let loadedPath = "";

    const primaryPath = join(programFolder, "system_prompt.md");
    const fallbackPath = join(programFolder, "Program.md");

    if (existsSync(primaryPath)) {
      try {
        programMd = await fs.readFile(primaryPath, "utf8");
        loadedPath = primaryPath;
      } catch (error) {
        console.error(`Failed to read system_prompt.md for promptware ${name}:`, error);
      }
    }

    if (!programMd && existsSync(fallbackPath)) {
      try {
        programMd = await fs.readFile(fallbackPath, "utf8");
        loadedPath = fallbackPath;
      } catch (error) {
        console.error(`Failed to read Program.md fallback for promptware ${name}:`, error);
      }
    }

    if (!programMd) {
      programMd = `# ${name} Program\nNo instructions found.`;
      loadedPath = primaryPath;
    }

    // Sort keys and format frontmatter header
    const headerStr = Object.keys(headers)
      .toSorted()
      .map((key) => `${key}: ${headers[key]}`)
      .join("\n");

    // Read memories from promptwares/<name>/memory/
    const memoryDir = join(programFolder, "memory");
    const memoryFiles: string[] = [];
    let memoryContents = "";
    try {
      await fs.mkdir(memoryDir, { recursive: true });
      const files = await fs.readdir(memoryDir);
      const mdFiles = files.filter((f) => f.endsWith(".md") && f !== ".gitkeep");

      for (const file of mdFiles) {
        memoryFiles.push(file);
        try {
          const content = await fs.readFile(join(memoryDir, file), "utf8");
          memoryContents += `### File: ${file}\n\n${content}\n\n---\n\n`;
        } catch {
          // Ignore files that cannot be read
        }
      }
    } catch (err) {
      console.error(`Failed to read memories for ${name}:`, err);
    }

    const memoryFilesListing =
      memoryFiles.length === 0 ? "(no memory files yet)" : memoryFiles.join(", ");
    const memoryContentsSection =
      memoryContents === "" ? "(no accumulated memories yet)" : memoryContents;

    const compiled = `---
${headerStr}
---
You are an agentic application that evolves over time.

This prompt is your Firmware and is never allowed to change.

The header above contains your named parameters for this execution.

Your program folder is: ${programFolder}

## Goal

Your goal is to complete the instructions in the **Program** section below (inlined from ${loadedPath.endsWith("system_prompt.md") ? "system_prompt.md" : "Program.md"}) with the following priority:

1. Completeness
2. Speed
3. Token efficiency
4. Improvement over time

**Memory Files:**
${memoryFilesListing}

**Accumulated Memories / Reflections:**
${memoryContentsSection}

Complete your task and return the appropriate output.

## Program

${programMd}
`;

    return compiled.replace("{{BrowserSkills}}", BrowserSkills.getSkillsInstructions());
  }

  private async prepareMessagesWithContext(
    _request: ChatRequest,
  ): Promise<{ system: string; messages: ModelMessage[] }> {
    // Get page context from active tab
    let pageUrl: string | null = null;
    let pageText: string | null = null;
    let accessibilityContext = "No active page structure available.";

    if (this.window) {
      const { activeTab } = this.window;
      if (activeTab) {
        pageUrl = activeTab.url;
        try {
          pageText = await activeTab.getTabText();
        } catch (error) {
          console.error("Failed to get page text:", error);
        }
        try {
          accessibilityContext = await AccessibilityExtractor.extract(activeTab);
        } catch (error) {
          console.error("Failed to extract accessibility context:", error);
        }
      }
    }

    const pageContentTruncated = this.truncateText(pageText || "", MAX_CONTEXT_LENGTH);
    const headers: Record<string, string> = {
      CurrentTime: new Date().toISOString(),
      CurrentUrl: pageUrl || "about:blank",
      AccessibilityContext: accessibilityContext,
      PageContent: pageContentTruncated,
    };

    const system = await this.compilePromptware("OpenCode", headers);

    return { system, messages: this.messages };
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength)}...`;
  }

  private async streamResponse(
    messages: ModelMessage[],
    system: string,
    messageId: string,
  ): Promise<void> {
    if (!this.model) {
      throw new Error("Model not initialized");
    }

    console.log(
      `[LLMClient] Initiating text stream with provider: ${this.provider}, model: ${this.modelName}...`,
    );

    const controller = new AbortController();

    try {
      const result = streamText({
        abortSignal: controller.signal,
        maxRetries: 3,
        system,
        messages,
        model: this.model,
        temperature: DEFAULT_TEMPERATURE,
      });

      await this.processStream(result.textStream, messageId, controller);
    } catch (error) {
      console.error("[LLMClient] Error during text streaming:", error);
      throw error;
    }
  }

  private async processStream(
    textStream: AsyncIterable<string>,
    messageId: string,
    controller: AbortController,
  ): Promise<void> {
    let accumulatedText = "";

    // Create a placeholder assistant message
    const assistantMessage: ModelMessage = {
      content: "",
      role: "assistant",
    };

    // Keep track of the index for updates
    const messageIndex = this.messages.length;
    this.messages.push(assistantMessage);

    // Track stream metrics
    const startTime = Date.now();
    let chunkCount = 0;
    let firstChunkReceived = false;

    // Timeout management:
    // - 30 seconds to receive the very first chunk
    // - 15 seconds max inactivity gap between subsequent chunks
    let timeoutId = setTimeout(() => {
      console.warn(`[LLMClient] Stream inactivity timeout (30s) reached. Aborting connection...`);
      controller.abort();
    }, 30000);

    const refreshTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn(
          `[LLMClient] Chunk streaming timed out (15s inactivity). Aborting connection...`,
        );
        controller.abort();
      }, 15000);
    };

    try {
      for await (const chunk of textStream) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          const ttft = Date.now() - startTime;
          console.log(`[LLMClient] First chunk received in ${ttft}ms`);
        }
        chunkCount++;
        refreshTimeout();

        accumulatedText += chunk;

        // Update assistant message content
        this.messages[messageIndex] = {
          content: accumulatedText,
          role: "assistant",
        };
        this.sendMessagesToRenderer();

        this.sendStreamChunk(messageId, {
          content: chunk,
          isComplete: false,
        });
      }

      const duration = Date.now() - startTime;
      console.log(
        `[LLMClient] Stream completed successfully in ${duration}ms ` +
          `(${chunkCount} chunks, length: ${accumulatedText.length} characters)`,
      );
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(
          "LLM request timed out. The local Ollama server took too long to respond.",
          { cause: err },
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // Detect and parse single JSON browser control skill action blocks from OpenCode's streamed response
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    const matches = [...accumulatedText.matchAll(jsonBlockRegex)];

    if (matches.length > 0) {
      const jsonContent = matches[0][1].trim();
      try {
        const action = JSON.parse(jsonContent);

        // Log beginning of execution
        const execMessageIndex = this.messages.length;
        this.messages.push({
          role: "assistant",
          content: `⚙️ **Executing Browser Action:** \`${action.action}\`...\n`,
        });
        this.sendMessagesToRenderer();

        if (this.window) {
          const result = await BrowserSkills.executeAction(this.window, action);

          // Update log with execution result
          if (result.success) {
            this.messages[execMessageIndex] = {
              role: "assistant",
              content: `⚙️ **Executing Browser Action:** \`${action.action}\`...\n✅ *Success:* ${result.message}`,
            };
          } else {
            this.messages[execMessageIndex] = {
              role: "assistant",
              content: `⚙️ **Executing Browser Action:** \`${action.action}\`...\n❌ *Error:* ${result.message}`,
            };
          }
          this.sendMessagesToRenderer();

          // If the action successfully changed the page state, rerun the agent loop with new context!
          if (result.success && result.stateChanged) {
            // Give page a short moment to settle down
            await new Promise((resolve) => setTimeout(resolve, 1500));

            this.messages.push({
              role: "assistant",
              content: `🔄 *Page state updated. Retrieving new accessibility context and continuing...*`,
            });
            this.sendMessagesToRenderer();

            // Prepare messages with fresh context and trigger stream
            const { system, messages } = await this.prepareMessagesWithContext({
              message: "Continue executing your plan based on the updated page context.",
              messageId: `${messageId}-rerun`,
            });
            await this.streamResponse(messages, system, `${messageId}-rerun`);
          }
        }
      } catch (err) {
        console.error("Failed to parse or execute JSON action block:", err);
        this.messages.push({
          role: "assistant",
          content: `❌ **Failed to parse/execute action block:** ${(err as Error).message}`,
        });
        this.sendMessagesToRenderer();
      }
    }
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);

    const errorMessage = this.getErrorMessage(error);
    this.sendErrorMessage(messageId, errorMessage);
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "An unexpected error occurred. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication error: Please check your API key in the .env file.";
    }

    if (message.includes("429") || message.includes("rate limit")) {
      return "Rate limit exceeded. Please try again in a few moments.";
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused")
    ) {
      return "Network error: Please check your internet connection.";
    }

    if (message.includes("timeout")) {
      return "Request timeout: The service took too long to respond. Please try again.";
    }

    return "Sorry, I encountered an error while processing your request. Please try again.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      const existingContent = typeof lastMessage.content === "string" ? lastMessage.content : "";
      lastMessage.content = `${existingContent ? existingContent + "\n\n" : ""}❌ Error: ${errorMessage}`;
    } else {
      this.messages.push({
        content: `❌ Error: ${errorMessage}`,
        role: "assistant",
      });
    }
    this.sendMessagesToRenderer();

    this.sendStreamChunk(messageId, {
      content: errorMessage,
      isComplete: true,
    });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send("chat-response", {
      content: chunk.content,
      isComplete: chunk.isComplete,
      messageId,
    });
  }
}
