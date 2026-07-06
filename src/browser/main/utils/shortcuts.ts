import { WebContents } from "electron";
import type { Window } from "../components/Window";
import { matchShortcut } from "../services/SettingsManager";

/**
 * Register standard keyboard shortcuts on a WebContents.
 */
export function registerKeyboardShortcuts(browserWindow: Window, webContents: WebContents): void {
  webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const { shortcuts } = browserWindow;

    // New Tab
    if (matchShortcut(shortcuts.newTab, input)) {
      event.preventDefault();
      browserWindow.createTab();
      return;
    }

    // Close Tab
    if (matchShortcut(shortcuts.closeTab, input)) {
      event.preventDefault();
      if (browserWindow.activeTab) {
        browserWindow.closeTab(browserWindow.activeTab.id);
      }
      return;
    }

    // Reload
    if (matchShortcut(shortcuts.reload, input)) {
      event.preventDefault();
      if (browserWindow.activeTab) {
        browserWindow.activeTab.reload();
      }
      return;
    }

    // Force Reload
    if (matchShortcut(shortcuts.forceReload, input)) {
      event.preventDefault();
      if (browserWindow.activeTab) {
        browserWindow.activeTab.webContents.reloadIgnoringCache();
      }
      return;
    }

    // Toggle Sidebar
    if (matchShortcut(shortcuts.toggleSidebar, input)) {
      event.preventDefault();
      browserWindow.sidebar.toggle();
      browserWindow.updateAllBounds();
      return;
    }

    // Go Back
    if (matchShortcut(shortcuts.goBack, input)) {
      event.preventDefault();
      if (browserWindow.activeTab) {
        browserWindow.activeTab.goBack();
      }
      return;
    }

    // Go Forward
    if (matchShortcut(shortcuts.goForward, input)) {
      event.preventDefault();
      if (browserWindow.activeTab) {
        browserWindow.activeTab.goForward();
      }
      return;
    }
  });
}
