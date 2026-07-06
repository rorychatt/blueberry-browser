import { Menu, app } from "electron";
import type { Window } from "./Window";

export class AppMenu {
  private readonly mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.createMenu();
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: "File",
        submenu: [
          {
            accelerator: "CmdOrCtrl+T",
            click: () => {
              this.handleNewTab();
            },
            label: "New Tab",
          },
          {
            accelerator: "CmdOrCtrl+W",
            click: () => {
              this.handleCloseTab();
            },
            label: "Close Tab",
          },
          { type: "separator" },
          {
            accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
            click: () => {
              app.quit();
            },
            label: "Quit",
          },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { accelerator: "CmdOrCtrl+Z", label: "Undo", role: "undo" },
          { accelerator: "Shift+CmdOrCtrl+Z", label: "Redo", role: "redo" },
          { type: "separator" },
          { accelerator: "CmdOrCtrl+X", label: "Cut", role: "cut" },
          { accelerator: "CmdOrCtrl+C", label: "Copy", role: "copy" },
          { accelerator: "CmdOrCtrl+V", label: "Paste", role: "paste" },
          {
            accelerator: "CmdOrCtrl+A",
            label: "Select All",
            role: "selectAll",
          },
        ],
      },
      {
        label: "View",
        submenu: [
          {
            accelerator: "CmdOrCtrl+R",
            click: () => {
              this.handleReload();
            },
            label: "Reload",
          },
          {
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => {
              this.handleForceReload();
            },
            label: "Force Reload",
          },
          { type: "separator" },
          {
            accelerator: "CmdOrCtrl+E",
            click: () => {
              this.handleToggleSidebar();
            },
            label: "Toggle Sidebar",
          },
          { type: "separator" },
          {
            accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
            click: () => {
              this.handleToggleDevTools();
            },
            label: "Toggle Developer Tools",
          },
          {
            accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
            click: () => {
              this.handleToggleFullscreen();
            },
            label: "Toggle Fullscreen",
          },
        ],
      },
      {
        label: "Go",
        submenu: [
          {
            accelerator: "CmdOrCtrl+Left",
            click: () => {
              this.handleGoBack();
            },
            label: "Back",
          },
          {
            accelerator: "CmdOrCtrl+Right",
            click: () => {
              this.handleGoForward();
            },
            label: "Forward",
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // Menu action handlers
  private handleNewTab(): void {
    this.mainWindow.createTab("https://www.google.com");
  }

  private handleCloseTab(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.closeTab(this.mainWindow.activeTab.id);
    }
  }

  private handleReload(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.reload();
    }
  }

  private handleForceReload(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.webContents.reloadIgnoringCache();
    }
  }

  private handleToggleSidebar(): void {
    this.mainWindow.sidebar.toggle();
    this.mainWindow.updateAllBounds();
  }

  private handleToggleDevTools(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.webContents.toggleDevTools();
    }
  }

  private handleToggleFullscreen(): void {
    const isFullScreen = this.mainWindow.baseWindow.isFullScreen();
    this.mainWindow.baseWindow.setFullScreen(!isFullScreen);
  }

  private handleGoBack(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.goBack();
    }
  }

  private handleGoForward(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.goForward();
    }
  }
}
