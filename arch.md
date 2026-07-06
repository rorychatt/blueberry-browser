# Blueberry Browser Architecture

Welcome to the **Blueberry Browser** and **Blueberry Playwright** central architecture review document. This document acts as a high-fidelity blueprint and status report detailing the unified system design, codebase advancements, the self-evolving Promptware framework, and the AI-native end-to-end (E2E) testing runtime.

---

## 🗺️ Architectural Ecosystem Overview

Blueberry Browser is a state-of-the-art, AI-native desktop browser and testing platform. The ecosystem integrates an Electron and React desktop application, an offline-first AI core, and a lightweight, high-performance Rust E2E runtime.

```mermaid
graph TD
    User([User / Developer]) -->|Electron UI| BrowserUI[Blueberry Sidebar UI]
    User -->|YAML Suites / CLI| CoreCLI[blueberry-core CLI]

    subgraph electron_app [Electron Host: Blueberry Browser]
        BrowserUI -->|React Renderer IPC| MainProcess[Electron Main Process]
        MainProcess -->|IPC Router| EventManager[ipc/EventManager]
        MainProcess -->|Orchestrates| TabComponent[components/Tab]
        MainProcess -->|Compiles OpenCode| LLMClient[services/LLMClient]
        LLMClient -->|Extracts Structure| AccessibilityExtractor[services/AccessibilityExtractor]
        LLMClient -->|Intercepts JSON| BrowserSkills[services/BrowserSkills]
        BrowserSkills -->|Runs Page Actions| TabComponent
    end

    subgraph Rust E2E Runtime: blueberry-core
        CoreCLI --> Runner[Test Runner Engine]
        Runner --> Parser[YAML Test Parser]
        Runner --> PromptwareRS[promptware::run_e2e_loop]
        PromptwareRS -->|Compiles E2ETest| AgentClient[ollama_agent::OllamaAgent]
        PromptwareRS -->|Executes CDP| Interaction[browser::BrowserEngine]
    end

    subgraph local_env [Local Offline Environment]
        AgentClient -->|HTTP API: /api/generate| LocalOllama[Ollama: qwen3.6]
        LLMClient -->|Local API / qwen3.6| LocalOllama
        Interaction -->|Direct WebSockets CDP| HeadlessChrome[Headless / Headful Chrome]
    end

    subgraph ts_sdk [TypeScript SDK]
        TSSDK[blueberry-sdk] -->|Spawns / Programmatic builder| CoreCLI
    end

    subgraph cloud_env [Cloud AI Environment]
        LLMClient -->|Vercel AI SDK| CloudLLM[OpenAI / Anthropic Cloud APIs]
    end
```

---

## 🛠️ Technology Stack & Toolchain

### 1. Unified Toolchain: Vite+ (`vp`)

The project utilizes **Vite+**—a high-performance, consolidated web development toolchain that unifies building, formatting, linting, and environment workflows:

- **Vite & Rolldown**: Advanced bundler and client-side bundler layer.
- **tsdown**: Fast, lightweight compiler for TypeScript.
- **Oxlint & Oxfmt**: Rust-powered linting and formatting utilities delivering near-instant validation.
- **Vite Task**: Lifecycle integration managing monorepos and local developer runs.
- **`vp` CLI**: Single-entry CLI replacing loose scripts (`vp install`, `vp check`, `vp build`, `vp run <script>`).

### 2. Electron Desktop Runtime

- **Electron (v43.0.0)**: Chromium-powered main process environment.
- **React (v19.2.7) & TypeScript (v6.0.3)**: High-performance React renderer utilizing custom CSS variables and TailwindCSS layers.
- **TailwindCSS (v4.3.2)**: Integrated via modern CSS-first `@tailwindcss/postcss` for optimal layout styling.
- **Vercel AI SDK (v7.0.15) & AI Core (`ai`)**: Standardized multi-provider LLM connector.

### 3. Native Rust Core (`blueberry-core`)

- **Rust (Edition 2021)**: High-performance, memory-safe backend executable (`blueberry-core`).
- **`headless_chrome` CDP Client**: Direct WebSocket bindings communicating with the Chrome DevTools Protocol, eliminating heavy Node WebDriver and Java Selenium dependencies.
- **`serde` & `serde_json`**: Strongly typed serialization/deserialization for AST parsing and structured agent outputs.

---

## 📂 Codebase Directory Map

The repository is organized under a modularized monorepo/workspace-based architecture:

```
blueberry-browser/
├── src/
│   ├── browser/                  # Electron Host: Blueberry Browser
│   │   ├── main/                 # Electron Main Process (Modularized)
│   │   │   ├── index.ts          # System bootstrap & window management
│   │   │   ├── components/       # Window, menus, and browser frame logic
│   │   │   │   ├── Window.ts     # Main window & sidebar host
│   │   │   │   ├── Menu.ts       # Context & app menu systems
│   │   │   │   ├── SideBar.ts    # Floating AI assistant pane
│   │   │   │   ├── Tab.ts        # Isolation wrapper for webContents
│   │   │   │   └── TopBar.ts     # Browser frame headers and address controls
│   │   │   ├── ipc/              # Inter-Process Communication Bridges
│   │   │   │   └── EventManager.ts # Direct IPC message routing & E2E events
│   │   │   └── services/         # Core application services
│   │   │       ├── LLMClient.ts  # System-prompt compiler & streaming LLM router
│   │   │       ├── AccessibilityExtractor.ts # Client-side DOM outline engine
│   │   │       └── BrowserSkills.ts          # Page control actions registry
│   │   ├── renderer/             # React App UI layer (Sidebar, Settings, Frame)
│   │   └── preload/              # Electron secure bridges and API exposure
│   ├── promptwares/              # Self-evolving agentic application firmware
│   │   ├── OpenCode/             # Master browser companion chat loop
│   │   ├── E2ETest/              # Autonomous test runner loop
│   │   ├── AssertionAgent/       # Semantic assertion checking module
│   │   └── ChatCompanion/        # Template-based offline conversational helper
│   │       ├── Program.md / system_prompt.md  # Immutable agent firmware instructions
│   │       ├── user_prompt.md                 # Substitutable template triggers
│   │       ├── memory/                        # Evolving markdown learnings/rules
│   │       └── logs/                          # Run history and performance logs
│   ├── code/                     # Rust E2E CLI core (blueberry-core)
│   │   ├── Cargo.toml            # Rust manifest
│   │   └── src/
│   │       ├── main.rs           # CLI interface & subcommand router
│   │       ├── browser.rs        # Headless Chrome WebSocket controller
│   │       ├── yaml_parser.rs    # YAML AST schema parser
│   │       ├── promptware.rs     # Rust promptware compiler & runner
│   │       └── ollama_agent.rs   # Local Ollama client & assertion loop
│   └── sdk/                      # TypeScript SDK (blueberry-sdk)
│       └── src/index.ts          # Programmatic builder interface
├── AGENTS.md                     # Agent specific instructions & linter definitions
├── package.json                  # Pinned monorepo index
└── pnpm-workspace.yaml           # Catalog configurations
```

---

## 🧩 The Promptware Framework

A core architectural breakthrough in Blueberry Browser is **Promptwares**—self-contained, "evolving agentic applications" designed to compile dynamically, query local/remote LLMs, record execution logs, and write persistent, self-improving memory reflections.

### 1. File Structure of a Promptware Folder

Each promptware folder (e.g. `AssertionAgent`, `E2ETest`, `OpenCode`) operates as an isolated package:

1. **Firmware (`system_prompt.md` or `Program.md`)**: The immutable, system-level instructions directing the agent's core capabilities, operating constraints, and expected output format.
2. **Trigger (`user_prompt.md`)**: A markdown template compiled at runtime, substituting variables wrapped in double-curly braces (e.g., `{{CurrentUrl}}`, `{{Prompt}}`).
3. **Memory (`memory/*.md`)**: Persistent, user-editable markdown files where the agent reads compiled historical learnings and writes back reflections after each execution loop.
4. **Logs (`logs/*.md`)**: Dynamic job output transcripts detailing timestamps, extracted parameters, model responses, and actions.

### 2. Compilation and Substitution Pipeline

When a promptware is compiled (by `LLMClient.ts` in JS or `promptware.rs` in Rust):

- The compiler loads the core firmware file.
- It scans the `memory/` directory, aggregating all accumulated learnings, reflections, and historical rules into the system prompt context.
- It injects execution-specific headers (e.g., `CurrentTime`, `CurrentUrl`, `PageContent`, `AccessibilityContext`).
- If required, it substitutes custom markdown placeholders (such as `{{BrowserSkills}}`) with detailed API instructions.

---

## 🤖 The Electron Sidebar & OpenCode Master Agent

The persistent LLM Companion Panel (the Sidebar chat) is orchestrated by the **OpenCode** master browser agent.

````
[User Message] ──► [LLMClient] ──► Extracts tab screenshot (multimodal)
                         │
                         ▼
        Compiles OpenCode Promptware with context:
        - CurrentTime, CurrentUrl
        - PageContent (Truncated)
        - AccessibilityContext (from AccessibilityExtractor)
                         │
                         ▼
             [Streaming LLM Response]
                         │
                         ▼
             Check for JSON Code Block:
             ```json
             { "action": "click", "params": { "selector": "#btn" } }
             ```
                         │
                         ▼
         [EventManager / BrowserSkills] Executes Action
                         │
                         ▼
        State Changed? ──► YES ──► (Sleep 1.5s) ──► Re-trigger OpenCode Loop!
            │
            └──► NO ──► Render final explanation to User
````

### 1. AccessibilityExtractor

To feed lightweight but complete DOM context to the agent without exceeding LLM context windows, `AccessibilityExtractor.ts` runs client-side DOM-inspection scripts to build a highly structured, semantic Markdown outline:

- **Landmarks & Sections**: Summarizes structural roles (`<nav>`, `<main>`, `<header>`, `section`).
- **Headings Hierarchy**: Indents headings based on tag level (`H1`, `H2`, `H3`).
- **Interactive Elements**: Filters for actionable anchors, buttons, inputs, textareas, and inputs with custom roles, appending current state flags (`Disabled`, `Checked`, `Required`) and extracting unique, clean CSS selectors.

### 2. BrowserSkills & Dynamic Permissions

`BrowserSkills.ts` handles the execution of actions parsed from the agent's JSON output. It maps schema parameters to programmatic browser APIs and manages a dynamic permissions gate:

| Skill Action     | Description                         | Parameters Schema                                                                      |
| :--------------- | :---------------------------------- | :------------------------------------------------------------------------------------- |
| **`open_tab`**   | Opens a new browser tab.            | `url` (optional, string), `activate` (optional, boolean)                               |
| **`close_tab`**  | Closes a tab by its ID.             | `tabId` (required, string)                                                             |
| **`switch_tab`** | Activates another tab by its ID.    | `tabId` (required, string)                                                             |
| **`navigate`**   | Navigates the current tab to a URL. | `url` (required, string)                                                               |
| **`click`**      | Simulates a physical DOM click.     | `selector` (required, string)                                                          |
| **`type`**       | Inputs text into a target field.    | `selector` (required, string), `text` (required, string), `submit` (optional, boolean) |
| **`scroll_to`**  | Scrolls the active viewport.        | `direction` (required: `'up' \| 'down' \| 'top' \| 'bottom'`)                          |
| **`wait`**       | Sleeps the current thread.          | `ms` (required, number)                                                                |
| **`go_back`**    | Standard back navigation.           | _(No parameters)_                                                                      |
| **`go_forward`** | Standard forward navigation.        | _(No parameters)_                                                                      |

> [!TIP]
> **Dynamic Permissions Gate**: Each skill is registered in a permissions map. If an action's permission is programmatically disabled (e.g., due to user preferences or security profiles), the execution is aborted immediately, returning a standard restriction payload to the agent.

---

## ⚡ Rust Dynamic E2E Test Runner (`blueberry-core`)

The localized alternative to Playwright is the compiled `blueberry-core` Rust binary. It parses YAML test plans and supports both classical sequential actions and completely autonomous Promptware-driven E2E loops.

### 1. YAML Parser Schema Layout (`yaml_parser.rs`)

Test suites are declared in highly structured YAML configurations. The engine supports two execution branches:

#### Option A: Classical Step-by-Step Executions

```yaml
name: "Search Flow Test"
steps:
  - navigate: "https://www.google.com"
  - wait_for: "input[name='q']"
  - type:
      selector: "input[name='q']"
      text: "Blueberry Browser"
  - click: "input[type='submit']"
  - wait: 2000
  - screenshot: "google_results.png"
  - agent: "Verify that 'blueberry' is shown in the search results"
```

#### Option B: E2E Promptware Autonomous Loop

```yaml
name: "Search Flow Autonomous Agent Test"
prompt: "Search for Blueberry Browser on Google and verify that the results are loaded correctly"
```

### 2. Rust Promptware Run Loop (`promptware::run_e2e_loop`)

If a YAML file specifies a global `prompt` instead of a static sequence of `steps`, the Rust runner launches an **Autonomous Agent Loop**:

1. It initializes an active `BrowserEngine` viewport and registers a randomized `job_id`.
2. It extracts the current URL and page text context (automatically truncating deep text blocks to 5,000 characters to optimize local LLM latency).
3. It compiles the local `E2ETest` Promptware, stitching the user's objective, compiled memory logs, and current page context into an LLM system prompt.
4. It calls the local Ollama API (`/api/generate` using `qwen3.6`), pulling a deterministic low-temperature response.
5. It parses the returned JSON action. If the action is a page navigation or interaction, it executes it through WebSocket CDP channels and iterates.
6. The loop continues for up to 20 steps. At conclusion (success or failure), it outputs a final `reflection` written back to `E2ETest/memory/learnings.md` and saves the complete transcript inside `E2ETest/logs/job_*.md`.

### 3. CLI Subcommand Reference

`blueberry-core` exposes the following terminal utilities:

- `blueberry-core run <file.yaml> [--headful]`: Loads and runs a step-based or prompt-based E2E test plan.
- `blueberry-core agent "<prompt>" --context-file <file.txt>`: Quick CLI utility to verify assertions on offline text contexts.
- `blueberry-core promptware-run <name> --input "<text>"`: Directly compiles and runs any promptware module offline.
- `blueberry-core promptware-read-memory <name> <filename>`: Reads compiled learnings.
- `blueberry-core promptware-write-memory <name> <filename> <content>`: Overwrites/updates promptware memories.

---

## 🧹 Repository Hygiene & Policies

To ensure stability across developer workspaces, the codebase strictly enforces:

> [!IMPORTANT]
> **1. Package Version Pinning**: All dependencies inside `package.json` are fixed and pinned to exact, deterministic versions. Carets (`^`), tildes (`~`), and `latest` modifiers are strictly forbidden.
>
> **2. Clean Types Compilation**: Automatically generated type declaration files (`*.d.ts`) must never be checked into git. Let `vp check` or typescript configurations recompile definitions dynamically.
>
> **3. Continuous Verification**: Before pushing features or finalizing refactors, always execute `vp check` (running Oxlint and Oxfmt linting/formatting tests) and `vp build` to guarantee compilation success.
