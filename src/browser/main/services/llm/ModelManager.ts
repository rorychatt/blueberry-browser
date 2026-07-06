import { type LanguageModel } from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { ollamaFetch } from "./OllamaStreamFilter";
import * as dotenv from "dotenv";
import { join } from "node:path";
import { existsSync } from "node:fs";

export type LLMProvider = "openai" | "anthropic" | "ollama";

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-3-5-sonnet-20241022", // literally 4.8 is out (and 5.0)
  ollama: "opencode",
  openai: "gpt-4o-mini", // lol knowldegde from like 2024
};

// Robustly load environment variables from .env file
const workspaceDir = process.cwd();
const possibleEnvPaths = [
  join(__dirname, "../../src/.env"),
  join(__dirname, "../../../src/.env"),
  join(workspaceDir, "src", ".env"),
  join(workspaceDir, ".env"),
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export class ModelManager {
  public readonly provider: LLMProvider;
  public readonly modelName: string;
  public readonly model: LanguageModel | null;

  constructor() {
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();
    this.logInitializationStatus();
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
          fetch: (input, init) => ollamaFetch(input, init),
        });
        return customOpenAI.chat(this.modelName);
      }
      default: {
        return null;
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
}
