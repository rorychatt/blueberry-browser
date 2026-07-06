/* eslint-disable @typescript-eslint/no-extraneous-class, @typescript-eslint/no-explicit-any */
import type { Window } from "../components/Window";

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
}

export class BrowserSkills {
  // Map to store permission settings. By default, all skills are allowed (true).
  private static permissions = new Map<string, boolean>([
    ["open_tab", true],
    ["close_tab", true],
    ["switch_tab", true],
    ["navigate", true],
    ["click", true],
    ["type", true],
    ["scroll_to", true],
    ["wait", true],
    ["go_back", true],
    ["go_forward", true],
  ]);

  public static readonly SKILL_DEFINITIONS: Record<string, SkillDefinition> = {
    open_tab: {
      name: "open_tab",
      description: "Opens a new browser tab with an optional initial URL.",
      parameters: {
        url: {
          type: "string",
          description: "The initial URL to load. Defaults to google.com.",
          required: false,
        },
        activate: {
          type: "boolean",
          description: "Whether to immediately switch to this tab. Defaults to true.",
          required: false,
        },
      },
    },
    close_tab: {
      name: "close_tab",
      description: "Closes an existing tab by its ID.",
      parameters: {
        tabId: {
          type: "string",
          description: "The ID of the tab to close (e.g., 'tab-1').",
          required: true,
        },
      },
    },
    switch_tab: {
      name: "switch_tab",
      description: "Switches the active tab to the specified tab ID.",
      parameters: {
        tabId: {
          type: "string",
          description: "The ID of the tab to activate (e.g., 'tab-2').",
          required: true,
        },
      },
    },
    navigate: {
      name: "navigate",
      description: "Navigates the currently active tab to a new URL.",
      parameters: {
        url: {
          type: "string",
          description:
            "The complete destination URL (must start with http:// or https://, or blueberry://settings).",
          required: true,
        },
      },
    },
    click: {
      name: "click",
      description: "Simulates a click event on an element matching a CSS selector.",
      parameters: {
        selector: {
          type: "string",
          description: "The unique CSS selector of the target element.",
          required: true,
        },
      },
    },
    type: {
      name: "type",
      description:
        "Types text into a text input or textarea matching a CSS selector, optionally submitting or hitting Enter.",
      parameters: {
        selector: {
          type: "string",
          description: "The CSS selector of the text input element.",
          required: true,
        },
        text: { type: "string", description: "The text content to input.", required: true },
        submit: {
          type: "boolean",
          description: "If true, submits the form or simulates an Enter keypress after typing.",
          required: false,
        },
      },
    },
    scroll_to: {
      name: "scroll_to",
      description: "Scrolls the currently active page in a specified direction.",
      parameters: {
        direction: {
          type: "string",
          description: "Where to scroll. Must be 'up', 'down', 'top', or 'bottom'.",
          required: true,
        },
      },
    },
    wait: {
      name: "wait",
      description: "Waits for a specified duration in milliseconds before continuing.",
      parameters: {
        ms: {
          type: "number",
          description: "Duration in milliseconds (e.g., 2000).",
          required: true,
        },
      },
    },
    go_back: {
      name: "go_back",
      description: "Navigates back in the active tab's history.",
      parameters: {},
    },
    go_forward: {
      name: "go_forward",
      description: "Navigates forward in the active tab's history.",
      parameters: {},
    },
  };

  /**
   * Set dynamic permissions for a specific skill.
   */
  public static setPermission(skillName: string, allowed: boolean): void {
    if (this.permissions.has(skillName)) {
      this.permissions.set(skillName, allowed);
      console.log(
        `🔒 Custom Permission Updated: "${skillName}" is now ${allowed ? "ALLOWED" : "DENIED"}`,
      );
    }
  }

  /**
   * Check if a specific skill is allowed to execute.
   */
  public static isPermissionGranted(skillName: string): boolean {
    return this.permissions.get(skillName) ?? false;
  }

  /**
   * Generate highly detailed, clear markdown formatting instructions for the skills
   * to inject into the LLM prompt.
   */
  public static getSkillsInstructions(): string {
    let docs = "You have direct access to Browser Skills to control the browser Window and Tabs. ";
    docs +=
      "To execute an action, output a single JSON block wrapped inside a markdown code fence like this:\n\n";
    docs += "```json\n";
    docs += "{\n";
    docs += '  "action": "skill_name",\n';
    docs += '  "params": { ... }\n';
    docs += "}\n";
    docs += "```\n\n";
    docs += "CRITICAL: You are only allowed to output ONE action per response. ";
    docs +=
      "After executing an action, the browser will update your Page Context and you will run again to inspect the results.\n\n";
    docs += "### Available Skills & Dynamic Permissions:\n\n";

    for (const [key, skill] of Object.entries(this.SKILL_DEFINITIONS)) {
      const allowed = this.isPermissionGranted(key);
      const permissionStatus = allowed ? "✅ ALLOWED" : "❌ DENIED (Permission Restricted)";

      docs += `#### Skill: \`${skill.name}\` (${permissionStatus})\n`;
      docs += `${skill.description}\n`;

      const paramKeys = Object.keys(skill.parameters);
      if (paramKeys.length > 0) {
        docs += "Parameters:\n";
        for (const pk of paramKeys) {
          const param = skill.parameters[pk];
          const reqStr = param.required ? "Required" : "Optional";
          docs += `- \`${pk}\` (${param.type}, ${reqStr}): ${param.description}\n`;
        }
      } else {
        docs += "- No parameters required.\n";
      }
      docs += "\n";
    }

    return docs;
  }

  /**
   * Execute an action on the active browser Window.
   */
  public static async executeAction(
    window: Window,
    action: { action: string; params?: Record<string, any> },
  ): Promise<{ success: boolean; message: string; stateChanged: boolean }> {
    const { action: skillName, params = {} } = action;

    if (!this.SKILL_DEFINITIONS[skillName]) {
      return {
        success: false,
        message: `Unknown skill action name: "${skillName}"`,
        stateChanged: false,
      };
    }

    if (!this.isPermissionGranted(skillName)) {
      return {
        success: false,
        message: `Access Denied: The custom permission to run the "${skillName}" skill is currently disabled in your browser rules.`,
        stateChanged: false,
      };
    }

    try {
      switch (skillName) {
        case "open_tab": {
          const url = params.url || undefined;
          const activate = params.activate !== false;
          const newTab = window.createTab(url, activate);
          return {
            success: true,
            message: `Successfully opened new tab (ID: "${newTab.id}") with URL: "${newTab.url}"`,
            stateChanged: true,
          };
        }

        case "close_tab": {
          const tabId = params.tabId;
          if (!tabId) {
            return {
              success: false,
              message: "Missing required parameter: 'tabId'",
              stateChanged: false,
            };
          }
          const closed = window.closeTab(tabId);
          if (closed) {
            return {
              success: true,
              message: `Successfully closed tab (ID: "${tabId}")`,
              stateChanged: true,
            };
          }
          return {
            success: false,
            message: `Failed to close tab: Tab with ID "${tabId}" was not found.`,
            stateChanged: false,
          };
        }

        case "switch_tab": {
          const tabId = params.tabId;
          if (!tabId) {
            return {
              success: false,
              message: "Missing required parameter: 'tabId'",
              stateChanged: false,
            };
          }
          const switched = window.switchActiveTab(tabId);
          if (switched) {
            return {
              success: true,
              message: `Switched active tab to: "${tabId}"`,
              stateChanged: true,
            };
          }
          return {
            success: false,
            message: `Failed to switch active tab: Tab with ID "${tabId}" was not found.`,
            stateChanged: false,
          };
        }

        case "navigate": {
          let url = (params.url || "").trim();
          // Strip any leading/trailing single/double quotes (sometimes output by LLMs)
          url = url.replace(/^['"\s]+|['"\s]+$/g, "");

          if (!url) {
            return {
              success: false,
              message: "Missing required parameter: 'url'",
              stateChanged: false,
            };
          }

          // Ensure URL has a valid scheme (e.g. http://, https://, file://)
          if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            url = "https://" + url;
          }

          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab is available to navigate.",
              stateChanged: false,
            };
          }
          await tab.loadURL(url);
          return {
            success: true,
            message: `Successfully navigated active tab to: "${url}"`,
            stateChanged: true,
          };
        }

        case "click": {
          const selector = params.selector;
          if (!selector) {
            return {
              success: false,
              message: "Missing required parameter: 'selector'",
              stateChanged: false,
            };
          }
          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab available for clicking.",
              stateChanged: false,
            };
          }

          const clickScript = `
            (() => {
              const el = document.querySelector(\`${selector.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`);
              if (!el) {
                throw new Error("Element matching selector \\"${selector}\\" was not found on the page.");
              }
              el.scrollIntoView({ block: "center", inline: "center" });
              el.focus();
              const clickEvent = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window
              });
              el.dispatchEvent(clickEvent);
              el.click();
              return true;
            })()
          `;
          await tab.runJs(clickScript);
          return {
            success: true,
            message: `Simulated click on element matching CSS selector: \`${selector}\``,
            stateChanged: true,
          };
        }

        case "type": {
          const selector = params.selector;
          const text = params.text;
          const submit = params.submit === true;

          if (!selector || text === undefined) {
            return {
              success: false,
              message: `Missing required parameter(s): ${!selector ? "'selector'" : ""} ${text === undefined ? "'text'" : ""}`,
              stateChanged: false,
            };
          }

          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab available for typing.",
              stateChanged: false,
            };
          }

          const typeScript = `
            (() => {
              const el = document.querySelector(\`${selector.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`);
              if (!el) {
                throw new Error("Element matching selector \\"${selector}\\" was not found on the page.");
              }
              el.scrollIntoView({ block: "center", inline: "center" });
              el.focus();
              el.value = \`${text.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              
              if (${submit}) {
                const form = el.form || el.closest("form");
                if (form) {
                  form.requestSubmit();
                } else {
                  const enterEvent = new KeyboardEvent("keydown", {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                  });
                  el.dispatchEvent(enterEvent);
                }
              }
              return true;
            })()
          `;
          await tab.runJs(typeScript);
          return {
            success: true,
            message: `Typed text "${text}" into element: \`${selector}\` (submit: ${submit})`,
            stateChanged: true,
          };
        }

        case "scroll_to": {
          const direction = params.direction;
          if (!direction || !["up", "down", "top", "bottom"].includes(direction)) {
            return {
              success: false,
              message:
                "Missing or invalid parameter 'direction'. Must be 'up', 'down', 'top', or 'bottom'.",
              stateChanged: false,
            };
          }

          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab available for scrolling.",
              stateChanged: false,
            };
          }

          const scrollScript = `
            (() => {
              const dir = "${direction}";
              if (dir === "top") window.scrollTo({ top: 0, behavior: "smooth" });
              else if (dir === "bottom") window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
              else if (dir === "up") window.scrollBy({ top: -window.innerHeight * 0.7, behavior: "smooth" });
              else if (dir === "down") window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" });
              return true;
            })()
          `;
          await tab.runJs(scrollScript);
          return {
            success: true,
            message: `Scrolled active tab: ${direction.toUpperCase()}`,
            stateChanged: true,
          };
        }

        case "wait": {
          const ms = params.ms;
          if (typeof ms !== "number") {
            return {
              success: false,
              message: "Missing or invalid parameter 'ms' (must be a number).",
              stateChanged: false,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, ms));
          return {
            success: true,
            message: `Waited successfully for ${ms}ms.`,
            stateChanged: false,
          };
        }

        case "go_back": {
          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab available to go back.",
              stateChanged: false,
            };
          }
          tab.goBack();
          return {
            success: true,
            message: "Navigated history backward.",
            stateChanged: true,
          };
        }

        case "go_forward": {
          const tab = window.activeTab;
          if (!tab) {
            return {
              success: false,
              message: "No active tab available to go forward.",
              stateChanged: false,
            };
          }
          tab.goForward();
          return {
            success: true,
            message: "Navigated history forward.",
            stateChanged: true,
          };
        }

        default:
          return {
            success: false,
            message: `Skill action "${skillName}" is defined but not implemented in executive handlers.`,
            stateChanged: false,
          };
      }
    } catch (err) {
      console.error(`Error executing skill "${skillName}":`, err);
      return {
        success: false,
        message: `Failed to execute skill "${skillName}": ${(err as Error).message}`,
        stateChanged: false,
      };
    }
  }
}
