import { ipcMain } from "electron";
import { BaseHandler } from "./BaseHandler";
import { HistoryManager, type HistoryEntry } from "../../services/HistoryManager";
import { compilePromptwareSystemAndUser, saveReflectionMemory } from "../../utils/promptware";

export class HistoryHandler extends BaseHandler {
  public register(): void {
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

          const compiled = await compilePromptwareSystemAndUser("HistoryAgent", {
            CurrentUrl: currentUrl,
            CurrentTitle: currentTitle,
            HistoryList: formattedHistory,
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
            await saveReflectionMemory(
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
}
