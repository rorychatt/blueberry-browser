import { WebContents } from "electron";
import type { Window } from "../components/Window";

/**
 * Register standard keyboard shortcuts on a WebContents.
 */
export function registerKeyboardShortcuts(window: Window, webContents: WebContents): void {
  webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const isCmdOrCtrl = process.platform === "darwin" ? input.meta : input.control;

    // CMD+T / CTRL+T: New Tab
    if (isCmdOrCtrl && input.key.toLowerCase() === "t") {
      event.preventDefault();
      window.createTab();
      return;
    }

    // CMD+W / CTRL+W: Close Tab
    if (isCmdOrCtrl && input.key.toLowerCase() === "w") {
      event.preventDefault();
      if (window.activeTab) {
        window.closeTab(window.activeTab.id);
      }
      return;
    }

    // CMD+R / CTRL+R: Reload
    if (isCmdOrCtrl && input.key.toLowerCase() === "r" && !input.shift) {
      event.preventDefault();
      if (window.activeTab) {
        window.activeTab.reload();
      }
      return;
    }

    // CMD+SHIFT+R / CTRL+SHIFT+R: Force Reload
    if (isCmdOrCtrl && input.key.toLowerCase() === "r" && input.shift) {
      event.preventDefault();
      if (window.activeTab) {
        window.activeTab.webContents.reloadIgnoringCache();
      }
      return;
    }

    // CMD+E / CTRL+E: Toggle Sidebar
    if (isCmdOrCtrl && input.key.toLowerCase() === "e") {
      event.preventDefault();
      window.sidebar.toggle();
      window.updateAllBounds();
      return;
    }

    // CMD+LEFT / CTRL+LEFT or ALT+LEFT: Go Back
    if ((isCmdOrCtrl || input.alt) && input.key === "ArrowLeft") {
      if (window.activeTab) {
        event.preventDefault();
        window.activeTab.goBack();
      }
      return;
    }

    // CMD+RIGHT / CTRL+RIGHT or ALT+RIGHT: Go Forward
    if ((isCmdOrCtrl || input.alt) && input.key === "ArrowRight") {
      if (window.activeTab) {
        event.preventDefault();
        window.activeTab.goForward();
      }
      return;
    }
  });
}
