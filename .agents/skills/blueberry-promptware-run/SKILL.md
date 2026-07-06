---
name: blueberry-promptware-run
description: Compile and execute a specific promptware (e.g. AssertionAgent, ChatCompanion, E2ETest, OpenCode) with custom inputs using the local Ollama LLM. Use this skill when you want to compile an agentic program with dynamic parameters, test promptware responses, or run offline agent actions.
---

# blueberry-promptware-run

Compile and execute promptware programs using the Blueberry CLI engine.

## Invocation

```bash
blueberry-core promptware-run <name> --input <input-string>
```

Or run via the compiled binary directly:

```bash
./src/code/target/debug/blueberry-core promptware-run <name> --input <input-string>
```

- **name**: The name of the promptware folder to compile and run (e.g., `ChatCompanion`, `AssertionAgent`, `E2ETest`, `OpenCode`).
- **input-string**: The user input or prompt argument to supply to the promptware compilation headers.

## What This Skill Does

1. Discovers the promptware template folder under `src/promptwares/<name>/`.
2. Gathers and populates parameters from the `--input` argument into the promptware templates (`system_prompt.md`, `user_prompt.md`, `Program.md`).
3. Appends the relevant context, instructions, rules, and existing memories of that promptware.
4. Queries the local Ollama instance with the fully compiled unified prompt.
5. Prints the raw completion result or JSON schema response to standard output.

## Guidelines

- Verify that the target promptware folder exists under `src/promptwares/` before running.
- Make sure the local Ollama service is running and has the required model loaded (default: `mistral` or `llama3` as defined in `src/code/src/ollama_agent.rs`).
- To inspect or edit the memory files for a promptware, use the companion memory read/write commands or edit files directly under `src/promptwares/<name>/memory/`.
