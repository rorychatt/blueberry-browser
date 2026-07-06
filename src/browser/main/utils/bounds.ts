export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the bounds for a tab WebContentsView.
 * Starts below the 88px top bar and subtracts the 400px sidebar if visible.
 */
export function calculateTabBounds(
  windowBounds: { width: number; height: number },
  isSidebarVisible: boolean,
): ViewBounds {
  const sidebarWidth = isSidebarVisible ? 400 : 0;
  return {
    x: 0,
    y: 88, // Start below the topbar
    width: windowBounds.width - sidebarWidth,
    height: windowBounds.height - 88, // Subtract topbar height
  };
}
