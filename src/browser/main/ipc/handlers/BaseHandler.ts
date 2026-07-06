import type { Window } from "../../components/Window";

export interface IpcHandler {
  register(): void;
  cleanup?(): void;
}

export abstract class BaseHandler implements IpcHandler {
  protected readonly mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
  }

  abstract register(): void;
}
