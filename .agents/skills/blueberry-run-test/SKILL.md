---
name: blueberry-run-test
description: Run an AI-native end-to-end (E2E) YAML-defined test suite or a natural language browser assertion in Blueberry Browser. Use this skill when you want to execute browser automation tests, test user flows on live websites, or run page-assertion validations using Playwright and the local Ollama agent.
---

# blueberry-run-test

Execute E2E YAML-defined tests or automated agent-led webpage assertions using the Blueberry CLI engine.

## Invocation

```bash
blueberry-core run <yaml-file-path> [--headful]
```

Or run via the compiled binary directly:

```bash
./src/code/target/debug/blueberry-core run <yaml-file-path> [--headful]
```

- **yaml-file-path**: The absolute or relative path to the E2E YAML test file (e.g., `tests/google_search.yaml`).
- **--headful**: (Optional) Flag to run the browser in headful (visible window) mode. Default is headless.

## What This Skill Does

1. Parses the specified YAML test suite.
2. Initializes the modern Playwright-based `BrowserEngine` (headful or headless).
3. Executes each test step sequentially:
   - `navigate`: Navigates to the specified URL.
   - `click`: Clicks on the element matching the CSS selector.
   - `type`: Types text into the input field matching the CSS selector.
   - `wait`: Pauses execution for a specified duration in milliseconds.
   - `wait_for`: Waits for a CSS selector to exist on the page.
   - `screenshot`: Captures and saves a webpage screenshot.
   - `agent`: Prompts the local Ollama LLM agent to perform semantic evaluation on the active page context.
4. Generates a beautiful execution pass/fail summary and exits with code 0 on success or 1 on failure.

## Guidelines

- Ensure the Rust CLI is built (`cargo build` in `src/code`) before running tests.
- When running tests on a server or remote terminal, do not use `--headful` unless a virtual framebuffer is configured.
- Use exact, robust CSS selectors for clicks and types.
- Check logs and screenshots when a step fails.
