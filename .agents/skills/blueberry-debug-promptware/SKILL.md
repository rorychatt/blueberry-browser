---
name: blueberry-debug-promptware
description: Analyze a promptware execution log (from src/promptwares/<name>/logs/) to identify issues, failures, and improvement opportunities in the promptware instructions, memories, selectors, or CLI integration. Use this skill when you want to investigate why an agentic test run failed, diagnose parsing errors, or refine promptware performance.
---

# blueberry-debug-promptware

Analyze a Blueberry promptware execution log to diagnose failures and identify concrete improvements to instructions, memories, or selectors.

## Invocation

```
/blueberry-debug-promptware <promptware-name> <job-id-or-path> <comment>
```

- **promptware-name**: The folder name of the promptware (e.g. `E2ETest`, `AssertionAgent`).
- **job-id-or-path**: The Job ID (e.g. `job_20260706_120000`) or the full path to the `.md` log file.
- **comment**: Description of what went wrong or what specifically to investigate.

## What This Skill Does

1. Reads the markdown execution log file from `src/promptwares/<promptware-name>/logs/<job_id>.md`.
2. Reconstructs the execution timeline step-by-step: URLs visited, actions chosen, CSS selectors targeted, and elapsed times.
3. Highlights failures, such as:
   - JSON parsing errors of the LLM responses.
   - Missing required action schema fields (e.g. action "navigate" without "url").
   - Navigation or timeout failures inside Playwright's `BrowserEngine`.
   - Local Ollama agent assertion failures.
4. Cross-references the execution with:
   - `Program.md` (or `system_prompt.md` / `user_prompt.md`).
   - Already stored reflections in `memory/`.
5. Recommends concrete fixes: better CSS selectors, added reflections/rules in `memory/` files, or updated instruction text.

## Guidelines

- **Read-only**: Do not modify source code or memories during analysis. Produce findings and actionable recommendations only.
- **Root-Cause Analysis**: Focus on distinguishing between model failure (e.g. hallucinations, invalid JSON, wrong selectors) and infrastructure failure (e.g. Playwright engine issues, Ollama service connection errors).
- **Be Specific**: Quote the exact steps, errors, and lines from the log.
