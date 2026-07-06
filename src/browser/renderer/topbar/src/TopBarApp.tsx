import React from "react";
import { BrowserProvider } from "./contexts/BrowserContext";
import { TabBar } from "./components/TabBar";
import { AddressBar } from "./components/AddressBar";
import { usePrimaryColor } from "../../common/hooks/usePrimaryColor";

export const TopBarApp: React.FC = () => {
  usePrimaryColor();
  const isMac =
    typeof window !== "undefined" &&
    ((window.topBarAPI && window.topBarAPI.platform === "darwin") ||
      window.navigator.userAgent.includes("Mac"));

  return (
    <BrowserProvider>
      <div className="flex flex-col bg-transparent select-none">
        {/* Tab Bar */}
        <div
          className="w-full h-10 flex items-center app-region-drag bg-muted/60 dark:bg-muted/40 border-b border-border/20"
          style={isMac ? { paddingLeft: "80px" } : undefined}
        >
          <TabBar />
        </div>

        {/* Toolbar */}
        <div className="flex items-center px-4 py-1.5 gap-3 app-region-drag bg-background shadow-subtle z-10 border-b border-border/40 dark:shadow-[0_0_6px_rgba(0,0,0,0.2)]">
          <AddressBar />
        </div>
      </div>
    </BrowserProvider>
  );
};
