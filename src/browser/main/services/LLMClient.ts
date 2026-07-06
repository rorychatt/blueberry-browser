import type { WebContents } from "electron";
import { type LanguageModel, type ModelMessage, streamText } from "ai";
import type { Window } from "../components/Window";
import { AccessibilityExtractor } from "./AccessibilityExtractor";
import { BrowserSkills } from "./BrowserSkills";
import { writeLog, saveReflectionMemory } from "../utils/promptware";

import { ModelManager, type LLMProvider } from "./llm/ModelManager";
import { compilePromptware } from "./llm/PromptwareCompiler";
import { SessionManager } from "./llm/SessionManager";

export type { LLMProvider };

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

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;

const formatMessageContent = (content: ModelMessage["content"]): string => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part.type === "text") return part.text;
        return JSON.stringify(part);
      })
      .join("\n");
  }
  return JSON.stringify(content);
};

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private readonly modelManager: ModelManager;
  private readonly sessionManager: SessionManager;
  private currentAbortController: AbortController | null = null;
  private isCancelled = false;
  private activeActionReject: ((reason: Error) => void) | null = null;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.modelManager = new ModelManager();
    this.sessionManager = new SessionManager(webContents);

    void this.initializeSession();
  }

  // Set the window reference after construction to avoid circular dependencies
  setWindow(window: Window): void {
    this.window = window;
  }

  public stopExecution(): void {
    this.isCancelled = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    if (this.activeActionReject) {
      this.activeActionReject(new Error("ExecutionCancelled"));
      this.activeActionReject = null;
    }
    if (this.window) {
      void BrowserSkills.hideAgentVisuals(this.window);
    }
    console.log("[LLMClient] stopExecution() called - execution cancelled.");
  }

  private checkCancellation(): void {
    if (this.isCancelled) {
      throw new Error("ExecutionCancelled");
    }
  }

  // Internal property getters/setters mapped to managers for backward-compatibility
  private get provider(): LLMProvider {
    return this.modelManager.provider;
  }

  private get modelName(): string {
    return this.modelManager.modelName;
  }

  private get model(): LanguageModel | null {
    return this.modelManager.model;
  }

  private get messages(): ModelMessage[] {
    return this.sessionManager.getMessagesList();
  }

  private set messages(msgs: ModelMessage[]) {
    this.sessionManager.setMessagesList(msgs);
  }

  // Session management delegation
  public async initializeSession(): Promise<void> {
    return this.sessionManager.initializeSession();
  }

  public startNewSession(): void {
    this.sessionManager.startNewSession();
  }

  public async loadSession(id: string): Promise<ModelMessage[]> {
    return this.sessionManager.loadSession(id);
  }

  clearMessages(): void {
    this.startNewSession();
  }

  getMessages(): ModelMessage[] {
    return this.sessionManager.getMessagesList();
  }

  getCurrentSessionId(): string | null {
    return this.sessionManager.getCurrentSessionId();
  }

  setSessionTitle(title: string): void {
    this.sessionManager.setSessionTitle(title);
  }

  private sendMessagesToRenderer(): void {
    this.sessionManager.sendMessagesToRenderer();
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    try {
      this.isCancelled = false;

      // Show agent visual feedback at the beginning of the request
      if (this.window) {
        void BrowserSkills.showAgentVisuals(this.window);
      }

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

      this.checkCancellation();

      console.log(`[LLMClient] Preparing message context for prompt: "${request.message}"`);
      const contextStartTime = Date.now();
      const { system, messages } = await this.prepareMessagesWithContext(request);
      const prepDuration = Date.now() - contextStartTime;
      console.log(
        `[LLMClient] Context prepared in ${prepDuration}ms. ` +
          `System prompt size: ${system.length} characters. ` +
          `Message history count: ${messages.length}`,
      );

      this.checkCancellation();

      await this.streamResponse(messages, system, request.messageId, request.message);
    } catch (error) {
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    }
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

    const system = await compilePromptware("OpenCode", headers);

    return { system, messages: this.messages };
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength)}...`;
  }

  /**
   * Cleans and formats the messages array for the LLM API.
   * Ensures roles strictly alternate (user <-> assistant), handles consecutive roles,
   * removes empty content, and strips verbose internal thoughts (<think>...</think>) from
   * historical turns to prevent context bloat and repetition loops.
   */
  private sanitizeMessagesForLLM(messages: ModelMessage[]): ModelMessage[] {
    // 1. Map messages, strip `<think>` blocks from previous turns, and convert assistant status updates to user role
    const mapped = messages.map((msg) => {
      let contentStr = typeof msg.content === "string" ? msg.content : "";

      if (Array.isArray(msg.content)) {
        // Keep vision/array content as is
        return msg;
      }

      // Strip verbose thinking blocks from all historical assistant messages to avoid context bloat and repetition loops
      if (msg.role === "assistant" && contentStr) {
        contentStr = contentStr.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }

      // Convert assistant status updates/feedback messages starting with '🔄' to user role
      if (msg.role === "assistant" && contentStr.startsWith("🔄")) {
        return {
          role: "user" as const,
          content: `${contentStr}\n\n[System Note: Please inspect the updated page context in AccessibilityContext and PageContent to verify if you landed on a valid page or if there's a 404 / Error Page (e.g., 'Page not found'). If the page is invalid or incorrect, adjust your strategy—do not try to click non-existent elements on an error page. Instead, navigate to a corrected URL or use a search box if available.]`,
        };
      }

      return {
        role: msg.role,
        content: contentStr || msg.content,
      };
    });

    // 2. Filter out empty or whitespace-only messages
    const nonEmpty = mapped.filter((msg) => {
      if (!msg.content) return false;
      if (typeof msg.content === "string" && msg.content.trim() === "") return false;
      if (Array.isArray(msg.content) && msg.content.length === 0) return false;
      return true;
    });

    // 3. Merge consecutive messages of the same role to strictly alternate
    const merged: ModelMessage[] = [];
    for (const msg of nonEmpty) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role) {
        let lastContent = "";
        if (typeof last.content === "string") {
          lastContent = last.content;
        } else if (Array.isArray(last.content)) {
          lastContent = last.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("\n");
        }

        let msgContent = "";
        if (typeof msg.content === "string") {
          msgContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          msgContent = msg.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("\n");
        }

        last.content = `${lastContent}\n\n${msgContent}`;
      } else {
        merged.push({
          role: msg.role,
          content:
            typeof msg.content === "string" ? msg.content : JSON.parse(JSON.stringify(msg.content)),
        });
      }
    }

    return merged;
  }

  private async streamResponse(
    messages: ModelMessage[],
    system: string,
    messageId: string,
    prompt: string,
    repromptCount = 0,
  ): Promise<void> {
    if (!this.model) {
      throw new Error("Model not initialized");
    }

    this.checkCancellation();

    console.log(
      `[LLMClient] Initiating text stream with provider: ${this.provider}, model: ${this.modelName}...`,
    );

    const controller = new AbortController();
    this.currentAbortController = controller;

    try {
      const sanitizedMessages = this.sanitizeMessagesForLLM(messages);

      const result = streamText({
        abortSignal: controller.signal,
        maxRetries: 3,
        system,
        messages: sanitizedMessages,
        model: this.model,
        temperature: DEFAULT_TEMPERATURE,
      });

      await this.processStream(
        result.textStream,
        messageId,
        controller,
        system,
        prompt,
        repromptCount,
      );
    } catch (error) {
      console.error("[LLMClient] Error during text streaming:", error);
      throw error;
    } finally {
      if (this.currentAbortController === controller) {
        this.currentAbortController = null;
      }
    }
  }

  private async processStream(
    textStream: AsyncIterable<string>,
    messageId: string,
    controller: AbortController,
    system: string,
    prompt: string,
    repromptCount = 0,
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
        this.checkCancellation();
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

      // Log execution details
      const jobId = `job_${new Date()
        .toISOString()
        .replace(/[-:T.]/g, "")
        .slice(0, 15)}_${messageId}`;
      const messagesStr = this.messages
        .map((m) => `### ${m.role}\n\n${formatMessageContent(m.content)}`)
        .join("\n\n");
      const logContent = `# OpenCode Agent Execution Log\n\n- **Job ID**: ${jobId}\n- **Timestamp**: ${new Date().toISOString()}\n- **Provider**: ${this.provider}\n- **Model**: ${this.modelName}\n- **Duration**: ${duration}ms\n\n## System Prompt\n\n\`\`\`\n${system}\n\`\`\`\n\n## Messages / Conversation\n\n${messagesStr}\n\n## Assistant Response (Raw)\n\n\`\`\`\n${accumulatedText}\n\`\`\`\n`;
      void writeLog("OpenCode", jobId, logContent).catch((err) => {
        console.error("Failed to write OpenCode log:", err);
      });
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

    this.checkCancellation();

    // Detect and parse single JSON browser control skill action blocks from OpenCode's streamed response
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    const matches = [...accumulatedText.matchAll(jsonBlockRegex)];
    let actionExecuted = false;

    for (const match of matches) {
      this.checkCancellation();
      const jsonContent = match[1].trim();
      try {
        const action = JSON.parse(jsonContent);

        // Check for reflection/learning inside the JSON action block or any valid JSON block
        if (action && typeof action === "object" && action.reflection && action.reflection.trim()) {
          const reflectionTitle = action.reflection_title || prompt || "opencode_reflection";
          const fullRefContent = `# OpenCode Reflection\n\n- **Prompt**: ${prompt}\n- **Action**: ${action.action || "chat"}\n- **Reflection/Learning**:\n${action.reflection}\n`;
          try {
            const reflectionFilename = await saveReflectionMemory(
              "OpenCode",
              reflectionTitle,
              fullRefContent,
              action.reflection,
            );
            console.log(`[LLMClient] Saved learning reflection to memory: ${reflectionFilename}`);

            // Append the notification directly to the streamed message to avoid grouping issues in Chat.tsx
            assistantMessage.content = `${accumulatedText.trim()}\n\n💡 **Saved learning reflection to memory:** \`${reflectionFilename}\``;
            this.sendMessagesToRenderer();
          } catch (saveErr) {
            console.error("[LLMClient] Failed to save reflection memory:", saveErr);
          }
        }

        // A valid browser action block must be an object with an "action" string field
        if (action && typeof action === "object" && typeof action.action === "string") {
          actionExecuted = true;

          // Log beginning of execution
          const execMessageIndex = this.messages.length;
          this.messages.push({
            role: "assistant",
            content: `⚙️ **Executing Browser Action:** \`${action.action}\`...\n`,
          });
          this.sendMessagesToRenderer();

          this.checkCancellation();

          if (this.window) {
            // Re-show agent visuals in case of navigation or state changes
            void BrowserSkills.showAgentVisuals(this.window);

            let result;
            try {
              result = await Promise.race([
                BrowserSkills.executeAction(this.window, action),
                new Promise<{ success: boolean; message: string; stateChanged: boolean }>(
                  (_, reject) => {
                    this.activeActionReject = reject;
                    // Enforce a timeout of 15 seconds as a safety fallback
                    setTimeout(
                      () => reject(new Error("Browser action timed out after 15 seconds.")),
                      15000,
                    );
                  },
                ),
              ]);
            } catch (err) {
              result = {
                success: false,
                message: (err as Error).message,
                stateChanged: false,
              };
            } finally {
              this.activeActionReject = null;
            }

            this.checkCancellation();

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

            // If the action was successful, rerun the agent loop with updated context!
            if (result.success) {
              // Give page a short moment to settle down
              await new Promise((resolve) => setTimeout(resolve, 1500));

              this.checkCancellation();

              this.messages.push({
                role: "assistant",
                content: `🔄 *Page state updated. ${result.message || "Retrieving new accessibility context and continuing..."}*`,
              });
              this.sendMessagesToRenderer();

              this.checkCancellation();

              // Make sure visuals are shown before starting the stream rerun
              void BrowserSkills.showAgentVisuals(this.window);

              // Prepare messages with fresh context and trigger stream
              const { system: rerunSystem, messages: rerunMessages } =
                await this.prepareMessagesWithContext({
                  message: "Continue executing your plan based on the updated page context.",
                  messageId: `${messageId}-rerun`,
                });

              this.checkCancellation();

              await this.streamResponse(
                rerunMessages,
                rerunSystem,
                `${messageId}-rerun`,
                prompt,
                0,
              ); // Reset repromptCount on success
            } else {
              // Action failed! Check if we can reprompt the agent
              const MAX_REPROMPTS = 3;
              if (repromptCount < MAX_REPROMPTS) {
                const nextReprompt = repromptCount + 1;
                console.log(
                  `[LLMClient] Action failed. Reprompting agent (attempt ${nextReprompt}/${MAX_REPROMPTS})...`,
                );

                this.messages.push({
                  role: "user",
                  content: `❌ **Failed to execute browser action:** ${result.message}\n\nPlease analyze the error, inspect the current page content/HTML, and try again with a corrected selector or action.`,
                });
                this.sendMessagesToRenderer();

                // Give the page a brief moment to stabilize
                await new Promise((resolve) => setTimeout(resolve, 1000));

                this.checkCancellation();

                // Make sure visuals are shown before starting the stream rerun
                void BrowserSkills.showAgentVisuals(this.window);

                // Prepare messages with fresh context and trigger stream
                const { system: rerunSystem, messages: rerunMessages } =
                  await this.prepareMessagesWithContext({
                    message: "Action failed. Retrying with updated context...",
                    messageId: `${messageId}-reprompt-${nextReprompt}`,
                  });

                this.checkCancellation();

                await this.streamResponse(
                  rerunMessages,
                  rerunSystem,
                  `${messageId}-reprompt-${nextReprompt}`,
                  prompt,
                  nextReprompt,
                );
              } else {
                console.warn(
                  `[LLMClient] Action failed and reached max reprompt limit of ${MAX_REPROMPTS}. Stopping.`,
                );
                void BrowserSkills.hideAgentVisuals(this.window);
              }
            }
          }
          // Only execute the first valid action block we successfully find
          break;
        }
      } catch (err) {
        console.error("Failed to parse JSON block in stream response:", err);
        // Only report a parsing error if this block was highly likely meant to be an action
        // (i.e. contains the key "action") or if it's the only code block in the message.
        if (jsonContent.includes('"action"') || matches.length === 1) {
          this.messages.push({
            role: "assistant",
            content: `❌ **Failed to parse/execute action block:** ${(err as Error).message}`,
          });
          this.sendMessagesToRenderer();

          if (this.window) {
            void BrowserSkills.hideAgentVisuals(this.window);
          }
          break;
        }
      }
    }

    if (!actionExecuted) {
      // No action block found, meaning the agent only generated a message -> hide visuals
      if (this.window) {
        void BrowserSkills.hideAgentVisuals(this.window);
      }

      // Save final result/findings to memory
      if (accumulatedText && accumulatedText.trim()) {
        const reflectionTitle = `${prompt.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 35)}_result`;
        const fullRefContent = `# OpenCode Reflection\n\n- **Prompt**: ${prompt}\n- **Action**: chat\n- **Reflection/Learning**:\nWhen asked about "${prompt}", the final result was:\n${accumulatedText.trim()}\n`;
        try {
          const reflectionFilename = await saveReflectionMemory(
            "OpenCode",
            reflectionTitle,
            fullRefContent,
            accumulatedText.trim(),
          );
          console.log(`[LLMClient] Saved final result to memory: ${reflectionFilename}`);

          // Append the notification directly to the streamed message to avoid grouping issues in Chat.tsx
          assistantMessage.content = `${accumulatedText.trim()}\n\n💡 **Saved final result to memory:** \`${reflectionFilename}\``;
          this.sendMessagesToRenderer();
        } catch (saveErr) {
          console.error("[LLMClient] Failed to save final result memory:", saveErr);
        }
      }
    }
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);

    if (error instanceof Error && error.message === "ExecutionCancelled") {
      const cancellationMessage = "⏹️ *Execution stopped by user.*";
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const existingContent = typeof lastMessage.content === "string" ? lastMessage.content : "";
        lastMessage.content = `${existingContent ? existingContent + "\n\n" : ""}${cancellationMessage}`;
      } else {
        this.messages.push({
          content: cancellationMessage,
          role: "assistant",
        });
      }
      this.sendMessagesToRenderer();

      this.sendStreamChunk(messageId, {
        content: cancellationMessage,
        isComplete: true,
      });

      if (this.window) {
        void BrowserSkills.hideAgentVisuals(this.window);
      }
      return;
    }

    const errorMessage = this.getErrorMessage(error);
    this.sendErrorMessage(messageId, errorMessage);

    if (this.window) {
      void BrowserSkills.hideAgentVisuals(this.window);
    }
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
