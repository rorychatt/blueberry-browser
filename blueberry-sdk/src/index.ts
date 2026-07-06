import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface TypeStep {
  selector: string;
  text: string;
}

export type Step =
  | { navigate: string }
  | { click: string }
  | { type: TypeStep }
  | { wait: number }
  | { wait_for: string }
  | { screenshot: string }
  | { agent: string };

export class Blueberry {
  private readonly suiteName: string;
  private readonly steps: Step[] = [];

  constructor(name: string = "TypeScript E2E Run") {
    this.suiteName = name;
  }

  navigate(url: string): this {
    this.steps.push({ navigate: url });
    return this;
  }

  click(selector: string): this {
    this.steps.push({ click: selector });
    return this;
  }

  type(selector: string, text: string): this {
    this.steps.push({ type: { selector, text } });
    return this;
  }

  wait(ms: number): this {
    this.steps.push({ wait: ms });
    return this;
  }

  waitFor(selector: string): this {
    this.steps.push({ wait_for: selector });
    return this;
  }

  screenshot(filepath: string): this {
    this.steps.push({ screenshot: filepath });
    return this;
  }

  agent(prompt: string): this {
    this.steps.push({ agent: prompt });
    return this;
  }

  private toYaml(): string {
    let yaml = `name: "${this.suiteName.replaceAll('"', String.raw`\"`)}"\nsteps:\n`;
    for (const step of this.steps) {
      if ("navigate" in step) {
        yaml += `  - navigate: "${step.navigate.replaceAll('"', String.raw`\"`)}"\n`;
      } else if ("click" in step) {
        yaml += `  - click: "${step.click.replaceAll('"', String.raw`\"`)}"\n`;
      } else if ("type" in step) {
        yaml += `  - type:\n      selector: "${step.type.selector.replaceAll('"', String.raw`\"`)}"\n      text: "${step.type.text.replaceAll('"', String.raw`\"`)}"\n`;
      } else if ("wait" in step) {
        yaml += `  - wait: ${step.wait}\n`;
      } else if ("wait_for" in step) {
        yaml += `  - wait_for: "${step.wait_for.replaceAll('"', String.raw`\"`)}"\n`;
      } else if ("screenshot" in step) {
        yaml += `  - screenshot: "${step.screenshot.replaceAll('"', String.raw`\"`)}"\n`;
      } else if ("agent" in step) {
        yaml += `  - agent: "${step.agent.replaceAll('"', String.raw`\"`)}"\n`;
      }
    }
    return yaml;
  }

  async run(options: { headful?: boolean } = {}): Promise<void> {
    const yamlContent = this.toYaml();

    // Create a temporary YAML file
    const tempFileDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }

    const tempFilePath = path.join(tempFileDir, `temp_suite_${Date.now()}.yaml`);
    fs.writeFileSync(tempFilePath, yamlContent);

    // Resolve path to the compiled Rust CLI
    const rustBinPath = path.resolve(__dirname, "../../blueberry-core/target/debug/blueberry-core");

    const headfulFlag = options.headful ? "--headful" : "";
    const command = `"${rustBinPath}" run "${tempFilePath}" ${headfulFlag}`;

    try {
      console.log(`Running Blueberry E2E engine command: ${command}`);
      const stdout = execSync(command, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Blueberry Playwright execution failed: ${error}`, { cause: error });
    } finally {
      // Clean up the temp YAML file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
}
