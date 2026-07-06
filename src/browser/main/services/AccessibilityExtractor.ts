import type { Tab } from "../components/Tab";

interface HeadingData {
  level: string;
  text: string;
}

interface LandmarkData {
  tag: string;
  ariaLabel: string;
  id: string;
}

interface InteractiveData {
  tag: string;
  type: string;
  role: string;
  name: string;
  selector: string;
  disabled: boolean;
  checked: boolean;
  required: boolean;
  href: string;
}

interface DOMData {
  title: string;
  url: string;
  headings: HeadingData[];
  landmarks: LandmarkData[];
  interactives: InteractiveData[];
}

/**
 * Run client-side DOM inspection script to extract accessibility tree structure.
 */
export async function extractAccessibility(tab: Tab): Promise<string> {
  try {
    const script = `
      (() => {
        const getSelector = (el) => {
          if (el.id) return "#" + el.id;
          if (el.getAttribute("data-testid")) {
            return "[data-testid=\\"" + el.getAttribute("data-testid") + "\\"]";
          }
          if (el.name && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
            return el.tagName.toLowerCase() + "[name=\\"" + el.name + "\\"]";
          }
          const path = [];
          let current = el;
          while (current && current.nodeType === 1) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector += "#" + current.id;
              path.unshift(selector);
              break;
            }
            let sibling = current;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
              if (sibling.tagName === current.tagName) nth++;
            }
            if (nth > 1 || (current.nextElementSibling && current.nextElementSibling.tagName === current.tagName)) {
              selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            current = current.parentElement;
          }
          return path.join(" > ");
        };

        const getAccessibleName = (el) => {
          let name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || "";
          if (!name && el.getAttribute("aria-labelledby")) {
            const labels = el.getAttribute("aria-labelledby").split(" ").map(id => document.getElementById(id)).filter(Boolean);
            name = labels.map(l => l.innerText).join(" ");
          }
          if (!name && el.tagName === "INPUT" && el.id) {
            const label = document.querySelector("label[for=\\"" + el.id + "\\"]");
            if (label) name = label.innerText;
          }
          if (!name) name = el.innerText || el.textContent || "";
          return name.trim().replace(/\\s+/g, " ");
        };

        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.innerText.trim().replace(/\\s+/g, " ")
        }));

        const landmarks = Array.from(document.querySelectorAll("nav, main, header, footer, aside, section")).map(l => ({
          tag: l.tagName.toLowerCase(),
          ariaLabel: l.getAttribute("aria-label") || "",
          id: l.id || ""
        }));

        const interactives = [];
        const visited = new Set();
        const elements = document.querySelectorAll("a, button, input, select, textarea, [role=\\"button\\"], [role=\\"link\\"], [role=\\"checkbox\\"], [role=\\"searchbox\\"], [role=\\"textbox\\"]");

        elements.forEach(el => {
          if (visited.has(el)) return;
          visited.add(el);

          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || el.offsetWidth === 0 || el.offsetHeight === 0) {
            return;
          }

          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || "";
          const role = el.getAttribute("role") || "";
          const name = getAccessibleName(el);
          const selector = getSelector(el);
          
          const disabled = el.disabled || el.getAttribute("aria-disabled") === "true";
          const checked = el.checked || el.getAttribute("aria-checked") === "true";
          const required = el.required || el.getAttribute("aria-required") === "true";

          interactives.push({
            tag,
            type,
            role,
            name,
            selector,
            disabled,
            checked,
            required,
            href: el.getAttribute("href") || ""
          });
        });

        return {
          title: document.title,
          url: window.location.href,
          headings,
          landmarks,
          interactives
        };
      })()
    `;

    const result = await tab.runJs(script);
    if (!result) {
      return "No page accessibility context is available.";
    }

    const data = result as DOMData;
    return formatMarkdown(data);
  } catch (error) {
    console.error("Failed to extract accessibility context:", error);
    return `Failed to extract accessibility tree: ${(error as Error).message}`;
  }
}

function formatMarkdown(data: DOMData): string {
  let md = `## Page Outline: "${data.title}"\n`;
  md += `**URL:** ${data.url}\n\n`;

  if (data.landmarks.length > 0) {
    md += `### Landmarks & Sections\n`;
    for (const lm of data.landmarks) {
      const labelStr = lm.ariaLabel ? ` (Aria-Label: "${lm.ariaLabel}")` : "";
      const idStr = lm.id ? ` #${lm.id}` : "";
      md += `- \`<${lm.tag}>\`${idStr}${labelStr}\n`;
    }
    md += `\n`;
  }

  if (data.headings.length > 0) {
    md += `### Headings Hierarchy\n`;
    for (const h of data.headings) {
      const indent = "  ".repeat(parseInt(h.level.charAt(1)) - 1);
      md += `${indent}- [${h.level.toUpperCase()}] ${h.text}\n`;
    }
    md += `\n`;
  }

  if (data.interactives.length > 0) {
    md += `### Interactive & Actionable Elements\n`;
    for (const el of data.interactives) {
      const label = el.name ? `"${el.name}"` : "(No accessible label)";
      let elTypeStr = el.tag;
      if (el.tag === "input" && el.type) {
        elTypeStr = `input[type="${el.type}"]`;
      } else if (el.role) {
        elTypeStr = `${el.tag}[role="${el.role}"]`;
      }

      const states: string[] = [];
      if (el.disabled) states.push("Disabled");
      if (el.checked) states.push("Checked");
      if (el.required) states.push("Required");
      const stateStr = states.length > 0 ? ` [State: ${states.join(", ")}]` : "";

      const hrefStr = el.href ? ` [Href: ${el.href}]` : "";

      md += `- **${elTypeStr}** ${label}${stateStr}${hrefStr}\n  Selector: \`${el.selector}\`\n`;
    }
  } else {
    md += `*(No interactive elements found on the page)*\n`;
  }

  return md;
}
