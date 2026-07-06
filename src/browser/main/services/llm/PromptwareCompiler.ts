import { join } from "node:path";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { BrowserSkills } from "../BrowserSkills";

export function getPromptwaresDir(): string {
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

export async function compilePromptware(
  name: string,
  headers: Record<string, string>,
): Promise<string> {
  const promptwaresDir = getPromptwaresDir();
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

Your goal is to complete the instructions in the **Program** section below (inlined from ${
    loadedPath.endsWith("system_prompt.md") ? "system_prompt.md" : "Program.md"
  }) with the following priority:

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
export { BrowserSkills };
