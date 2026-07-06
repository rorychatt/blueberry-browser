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
    docs += '  "params": { ... },\n';
    docs +=
      '  "reflection": "Brief reflection on what was learned or observed during this step (used to update persistent memory)",\n';
    docs +=
      "  \"reflection_title\": \"A short 2-3 word topic name representing this reflection (e.g. 'google_search_input', 'login_failure', etc.)\"\n";
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

  private static readonly VISUAL_CSS = `
    .blueberry-vignette {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483645;
      box-shadow: inset 0 0 50px rgba(59, 130, 246, 0.35), inset 0 0 120px rgba(99, 102, 241, 0.15);
      border: 4px solid rgba(59, 130, 246, 0.3);
      opacity: 0;
      transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 16px;
    }
    .blueberry-vignette.active {
      opacity: 1;
    }
    .blueberry-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(59, 130, 246, 0.4);
      padding: 8px 16px;
      border-radius: 9999px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.25);
      transform: translateY(-10px);
      transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }
    .blueberry-vignette.active .blueberry-badge {
      transform: translateY(0);
    }
    .blueberry-badge-dot {
      width: 10px;
      height: 10px;
      background: #3b82f6;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 10px #3b82f6, 0 0 20px #3b82f6;
      animation: blueberry-pulse-animation 1.5s infinite ease-in-out;
    }
    @keyframes blueberry-pulse-animation {
      0% { transform: scale(0.85); opacity: 0.5; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.85); opacity: 0.5; }
    }
    .blueberry-cursor {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      left: 0;
      top: 0;
      width: 36px;
      height: 36px;
      opacity: 0;
      transform: translate3d(50vw, 105vh, 0);
      transition: transform 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
      filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
    }
    .blueberry-cursor.visible {
      opacity: 1;
    }
    .blueberry-click-ripple {
      position: fixed;
      border: 2.5px solid #6366f1;
      background: rgba(99, 102, 241, 0.2);
      border-radius: 50%;
      width: 12px;
      height: 12px;
      opacity: 1;
      transform: translate3d(-50%, -50%, 0) scale(1);
      transition: transform 0.5s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.5s ease-out;
      pointer-events: none;
      z-index: 2147483646;
    }
  `;

  /**
   * Injects the CSS and JS for vignette and virtual cursor into the active tab.
   */
  private static async injectVisuals(window: Window): Promise<void> {
    const tab = window.activeTab;
    if (!tab) return;

    try {
      // Injects the CSS directly into the document using WebContents.insertCSS,
      // completely bypassing page-level Content Security Policies (e.g. style-src restrictions).
      const needsCss = await tab.runJs(`!window.__blueberryStylesInjected`);
      if (needsCss) {
        await tab.webContents.insertCSS(this.VISUAL_CSS);
        await tab.runJs(`window.__blueberryStylesInjected = true;`);
      }
    } catch (e) {
      console.error("Failed to inject CSS styles via insertCSS:", e);
    }

    const script = `
      (() => {
        function safeAppend(el) {
          const body = document.body;
          if (body) {
            body.appendChild(el);
          } else {
            document.documentElement.appendChild(el);
            // Setup a MutationObserver to automatically relocate elements to document.body once loaded,
            // avoiding layering issues where elements attached to documentElement are masked by body background colors.
            const observer = new MutationObserver((mutations, obs) => {
              if (document.body) {
                document.body.appendChild(el);
                obs.disconnect();
              }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
          }
        }

        function ensureVignette() {
          let vignette = document.querySelector(".blueberry-vignette");
          if (!vignette) {
            vignette = document.createElement("div");
            vignette.className = "blueberry-vignette";
            vignette.innerHTML = '<div class="blueberry-badge">' +
              '<span class="blueberry-badge-dot"></span>' +
              '<span>Blueberry Agent Active</span>' +
              '</div>';
            safeAppend(vignette);
          } else if (vignette.parentElement !== document.body && document.body) {
            document.body.appendChild(vignette);
          }
          return vignette;
        }

        function ensureCursor() {
          let cursor = document.querySelector(".blueberry-cursor");
          if (!cursor) {
            cursor = document.createElement("div");
            cursor.className = "blueberry-cursor";
            cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M4 2.5L25 15.5L15.5 17.5L21.5 25.5L18.5 27L12.5 19L4 24.5V2.5Z" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>' +
              '<circle cx="4" cy="2.5" r="3" fill="#6366f1" stroke="#ffffff" stroke-width="1.5"/>' +
              '</svg>';
            safeAppend(cursor);
          } else if (cursor.parentElement !== document.body && document.body) {
            document.body.appendChild(cursor);
          }
          return cursor;
        }

        // Try to inject initially
        try {
          ensureVignette();
          ensureCursor();
        } catch (e) {
          console.error("Initial visuals injection failed:", e);
        }

        window.__blueberryAgent = {
          showVignette() {
            try {
              const v = ensureVignette();
              if (v) v.classList.add("active");
            } catch (e) {
              console.error("Failed to show vignette:", e);
            }
          },
          hideVignette() {
            try {
              const v = document.querySelector(".blueberry-vignette");
              if (v) v.classList.remove("active");
              const c = document.querySelector(".blueberry-cursor");
              if (c) c.classList.remove("visible");
            } catch (e) {
              console.error("Failed to hide vignette:", e);
            }
          },
          async moveCursorTo(x, y) {
            try {
              const v = ensureVignette();
              if (v) v.classList.add("active");

              const c = ensureCursor();
              if (!c) return;

              c.classList.add("visible");
              c.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";

              window.__blueberryLastCursorX = x;
              window.__blueberryLastCursorY = y;

              await new Promise(resolve => setTimeout(resolve, 800));

              const ripple = document.createElement("div");
              ripple.className = "blueberry-click-ripple";
              ripple.style.left = x + "px";
              ripple.style.top = y + "px";
              safeAppend(ripple);

              void ripple.offsetWidth;
              ripple.style.transform = "translate3d(-50%, -50%, 0) scale(4)";
              ripple.style.opacity = "0";

              setTimeout(() => ripple.remove(), 500);
              await new Promise(resolve => setTimeout(resolve, 150));
            } catch (e) {
              console.error("Failed to move cursor:", e);
            }
          }
        };
      })();
    `;
    try {
      await tab.runJs(script);
    } catch (e) {
      console.error("Failed to inject agent visuals script:", e);
    }
  }

  /**
   * Helper to show vignette effect on the active tab.
   */
  public static async showAgentVisuals(window: Window): Promise<void> {
    const tab = window.activeTab;
    if (!tab) return;
    await this.injectVisuals(window);
    try {
      await tab.runJs(
        `if (window.__blueberryAgent && typeof window.__blueberryAgent.showVignette === "function") window.__blueberryAgent.showVignette();`,
      );
    } catch (e) {
      console.error("Failed to show agent vignette:", e);
    }
  }

  /**
   * Helper to hide vignette and cursor on the active tab.
   */
  public static async hideAgentVisuals(window: Window): Promise<void> {
    const tab = window.activeTab;
    if (!tab) return;
    try {
      await tab.runJs(
        `if (window.__blueberryAgent && typeof window.__blueberryAgent.hideVignette === "function") window.__blueberryAgent.hideVignette();`,
      );
    } catch (e) {
      console.error("Failed to hide agent vignette:", e);
    }
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

          // Ensure visual stylesheet and control API exist
          await this.injectVisuals(window);

          const clickScript = `
            (async () => {
              const el = document.querySelector(\`${selector.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`);
              if (!el) {
                throw new Error("Element matching selector \\"${selector}\\" was not found on the page.");
              }
              el.scrollIntoView({ block: "center", inline: "center" });
              
              // Wait briefly for scroll to settle
              await new Promise(resolve => setTimeout(resolve, 150));
              
              // Calculate center coordinates relative to viewport
              const rect = el.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;

              // Move the virtual cursor with hover animation
              if (window.__blueberryAgent && typeof window.__blueberryAgent.moveCursorTo === "function") {
                await window.__blueberryAgent.moveCursorTo(x, y);
              }

              // Added visual delay to see the cursor clearly at the destination before clicking
              await new Promise(resolve => setTimeout(resolve, 500));

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
          let lastError: Error | null = null;
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              await tab.runJs(clickScript);
              return {
                success: true,
                message: `Simulated click on element matching CSS selector: \`${selector}\``,
                stateChanged: true,
              };
            } catch (err) {
              lastError = err as Error;
              console.warn(
                `[BrowserSkills] Click attempt ${attempt} failed for selector "${selector}":`,
                err,
              );
              if (attempt < maxAttempts) {
                // Wait 1 second before next attempt
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          return {
            success: false,
            message: `Failed to click element matching CSS selector \`${selector}\` after ${maxAttempts} attempts: ${lastError?.message || "Unknown error"}`,
            stateChanged: false,
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

          // Ensure visual stylesheet and control API exist
          await this.injectVisuals(window);

          const typeScript = `
            (async () => {
              const el = document.querySelector(\`${selector.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`);
              if (!el) {
                throw new Error("Element matching selector \\"${selector}\\" was not found on the page.");
              }
              el.scrollIntoView({ block: "center", inline: "center" });
              
              // Wait briefly for scroll to settle
              await new Promise(resolve => setTimeout(resolve, 150));
              
              // Calculate center coordinates relative to viewport
              const rect = el.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;

              // Move the virtual cursor with hover animation
              if (window.__blueberryAgent && typeof window.__blueberryAgent.moveCursorTo === "function") {
                await window.__blueberryAgent.moveCursorTo(x, y);
              }

              // Added visual delay to see the cursor clearly at the destination before typing
              await new Promise(resolve => setTimeout(resolve, 500));

              el.focus();
              if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                  "value"
                )?.set;
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(el, \`${text.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`);
                } else {
                  el.value = \`${text.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`;
                }
              } else {
                el.textContent = \`${text.replace(/`/g, "\\`").replace(/\\/g, "\\\\")}\`;
              }
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              
              if (${submit}) {
                // Added visual delay to see the typed text in the input field before submitting
                await new Promise(resolve => setTimeout(resolve, 500));

                const keyEvents = ["keydown", "keypress", "keyup"];
                for (const type of keyEvents) {
                  el.dispatchEvent(new KeyboardEvent(type, {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                  }));
                }
                const form = el.form || el.closest("form");
                if (form) {
                  try {
                    form.requestSubmit();
                  } catch (e) {
                    try {
                      form.submit();
                    } catch (err) {}
                  }
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
