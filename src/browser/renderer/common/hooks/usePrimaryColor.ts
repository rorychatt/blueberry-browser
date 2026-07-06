import { useEffect, useState } from "react";

// Convert hex to R G B space-separated string
export const hexToRgbStr = (hex: string): string | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `${r} ${g} ${b}`;
};

// Calculate relative luminance to determine optimal foreground text (dark vs light)
export const getContrastingColor = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "255 255 255";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "20 20 20" : "255 255 255";
};

export const usePrimaryColor = () => {
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    const savedColor = localStorage.getItem("primaryColor");
    return savedColor || "#4361ee"; // Default Blueberry Cobalt
  });

  useEffect(() => {
    const rgbStr = hexToRgbStr(primaryColor);
    if (rgbStr) {
      document.documentElement.style.setProperty("--primary", rgbStr);
      const fgStr = getContrastingColor(primaryColor);
      document.documentElement.style.setProperty("--primary-foreground", fgStr);
    }

    localStorage.setItem("primaryColor", primaryColor);

    // Broadcast change to main process
    if (window.electron) {
      window.electron.ipcRenderer.send("primary-color-changed", primaryColor);
    }
  }, [primaryColor]);

  // Listen for primary color changes from other windows
  useEffect(() => {
    const handlePrimaryColorUpdate = (_event: unknown, newColor: string) => {
      setPrimaryColor(newColor);
    };

    if (window.electron) {
      window.electron.ipcRenderer.on("primary-color-updated", handlePrimaryColorUpdate);
    }

    return () => {
      if (window.electron) {
        window.electron.ipcRenderer.removeListener(
          "primary-color-updated",
          handlePrimaryColorUpdate,
        );
      }
    };
  }, []);

  return { primaryColor, setPrimaryColor };
};
