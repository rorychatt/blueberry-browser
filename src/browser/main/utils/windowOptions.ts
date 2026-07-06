import { BaseWindowConstructorOptions } from "electron";

/**
 * Returns the default BaseWindow configuration options.
 */
export function getBaseWindowOptions(): BaseWindowConstructorOptions {
  return {
    width: 1000,
    height: 800,
    show: true,
    backgroundColor: "#18181b",
    autoHideMenuBar: false,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin" ? {} : { titleBarOverlay: true }),
    trafficLightPosition: { x: 15, y: 13 },
  };
}
