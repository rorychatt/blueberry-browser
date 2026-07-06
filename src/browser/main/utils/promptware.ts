import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";

export function getPromptwaresDir(): string {
  const workspaceDir = process.cwd();
  const possiblePaths = [
    path.join(workspaceDir, "src", "promptwares"),
    path.join(workspaceDir, "promptwares"),
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

export async function compilePromptwareSystemAndUser(
  name: string,
  values: Record<string, string>,
): Promise<{ system: string; user: string }> {
  const promptwaresDir = getPromptwaresDir();
  const folder = path.join(promptwaresDir, name);

  let systemInstructions = "";

  const primaryPath = path.join(folder, "system_prompt.md");
  const fallbackPath = path.join(folder, "Program.md");

  if (existsSync(primaryPath)) {
    try {
      systemInstructions = await fs.readFile(primaryPath, "utf8");
    } catch (error) {
      console.error(`Failed to read system_prompt.md for promptware ${name}:`, error);
    }
  }

  if (!systemInstructions && existsSync(fallbackPath)) {
    try {
      systemInstructions = await fs.readFile(fallbackPath, "utf8");
    } catch (error) {
      console.error(`Failed to read Program.md fallback for promptware ${name}:`, error);
    }
  }

  if (!systemInstructions) {
    systemInstructions = `# ${name} Program\nNo instructions found.`;
  }

  // Load Memory files
  const memoryDir = path.join(folder, "memory");
  const memoryFiles: string[] = [];
  let memoryContents = "";
  try {
    if (existsSync(memoryDir)) {
      const files = await fs.readdir(memoryDir);
      const mdFiles = files.filter((f) => f.endsWith(".md") && f !== ".gitkeep");

      for (const file of mdFiles) {
        memoryFiles.push(file);
        try {
          const content = await fs.readFile(path.join(memoryDir, file), "utf8");
          memoryContents += `### File: ${file}\n\n${content}\n\n---\n\n`;
        } catch {
          // Ignore files that cannot be read
        }
      }
    }
  } catch (err) {
    console.error(`Failed to read memories for ${name}:`, err);
  }

  const memoryFilesListing =
    memoryFiles.length === 0 ? "(no memory files yet)" : memoryFiles.join(", ");
  const memoryContentsSection =
    memoryContents === "" ? "(no accumulated memories yet)" : memoryContents;

  const systemPrompt = `You are an agentic application that evolves over time.

This prompt is your Firmware and is never allowed to change.

Your program folder is: ${folder}

## Goal

Your goal is to complete the instructions in the **System Instructions** section below with the following priority:

1. Completeness
2. Speed
3. Token efficiency
4. Improvement over time

**Memory Files:**
${memoryFilesListing}

**Accumulated Memories / Reflections:**
${memoryContentsSection}

To read a memory file offline:
Use the CLI command: \`blueberry-core promptware-read-memory ${name} <filename>.md\`

Complete your task and return the appropriate output.

## Reflection

Every execution needs to end with a reflection step. This is your opportunity to improve over time. What did we learn during this session?
When you return your final JSON response, provide a \`reflection\` field containing your key takeaways, lessons, or rules learned. This will be automatically written to a memory file for you.

## System Instructions

${systemInstructions}
`;

  // Load user prompt
  const userMdPath = path.join(folder, "user_prompt.md");
  let userPrompt = "";
  if (existsSync(userMdPath)) {
    try {
      const userTemplate = await fs.readFile(userMdPath, "utf8");
      let compiledUser = userTemplate;
      for (const [key, val] of Object.entries(values)) {
        compiledUser = compiledUser.replaceAll(`{{${key}}}`, val);
      }
      userPrompt = compiledUser;
    } catch (err) {
      console.error(`Failed to read user_prompt.md for ${name}:`, err);
    }
  }

  if (!userPrompt) {
    // Fallback to default user prompt format
    const headerStr = Object.keys(values)
      .toSorted()
      .map((key) => `${key}: ${values[key]}`)
      .join("\n");
    userPrompt = `---\n${headerStr}\n---`;
  }

  return { system: systemPrompt, user: userPrompt };
}

// Helper to extract the core reflection text from an entry
const getCoreText = (entryText: string): string => {
  const match = /Reflection\/(?:Pattern Identified|Learning)[*\s:]+([\s\S]*)/i.exec(entryText);
  const content = match ? match[1] : entryText;
  return content
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

export async function saveReflectionMemory(
  promptwareName: string,
  titleOrPrompt: string,
  fullRefContent: string,
  coreReflection: string,
): Promise<string> {
  const slug =
    titleOrPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "reflection";
  const filename = `${slug}.md`;

  const promptwaresDir = getPromptwaresDir();
  const memoryDir = path.join(promptwaresDir, promptwareName, "memory");
  await fs.mkdir(memoryDir, { recursive: true });
  const filePath = path.join(memoryDir, filename);

  let existingContent = "";
  try {
    existingContent = await fs.readFile(filePath, "utf8");
  } catch {
    // File does not exist
  }

  if (existingContent) {
    // Split the existing file by '---' to get individual entries
    const entries = existingContent
      .split(/\n\s*---\s*\n/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const newCoreNormalized = coreReflection
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

    // Check if any existing entry has the same normalized core reflection
    const isDuplicate = entries.some((entry) => getCoreText(entry) === newCoreNormalized);
    if (isDuplicate) {
      return filename;
    }

    // Add the new entry
    entries.push(fullRefContent.trim());

    const updatedContent = `${entries.join("\n\n---\n\n")}\n`;
    await fs.writeFile(filePath, updatedContent, "utf8");
  } else {
    await fs.writeFile(filePath, `${fullRefContent.trim()}\n`, "utf8");
  }

  return filename;
}

export async function writeLog(
  promptwareName: string,
  jobId: string,
  content: string,
): Promise<void> {
  const promptwaresDir = getPromptwaresDir();
  const logsDir = path.join(promptwaresDir, promptwareName, "logs");
  await fs.mkdir(logsDir, { recursive: true });
  await fs.writeFile(path.join(logsDir, `${jobId}.md`), content, "utf8");
}
