import React from "react";
import { Plus, X } from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { Favicon } from "../components/Favicon";
import { TabBarButton } from "../components/TabBarButton";
import { cn } from "@common/lib/utils";

interface TabItemProps {
  id: string;
  title: string;
  favicon?: string | null;
  isActive: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onActivate: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  title,
  favicon,
  isActive,
  isPinned = false,
  onClose,
  onActivate,
}) => {
  const baseClassName = cn(
    "relative flex items-center h-8 pl-4 pr-3 select-none rounded-lg gap-2",
    "text-primary group/tab transition-all duration-200 cursor-pointer",
    "app-region-no-drag", // Make tabs clickable
    isActive
      ? "bg-background shadow-tab dark:bg-secondary dark:shadow-none font-medium"
      : "bg-transparent hover:bg-muted/50 dark:hover:bg-muted/30",
    isPinned ? "w-8 !px-0 justify-center gap-0" : "min-w-[140px] max-w-[200px]",
  );

  return (
    <div className="py-1">
      <div className={baseClassName} onClick={() => !isActive && onActivate()}>
        {/* Favicon */}
        <div className="flex-shrink-0 flex items-center">
          <Favicon src={favicon} />
        </div>

        {/* Title (hide for pinned tabs) */}
        {!isPinned && (
          <span className="text-xs truncate max-w-[200px] flex-1">{title || "New Tab"}</span>
        )}

        {/* Close button (shows on hover) */}
        {!isPinned && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={cn(
              "flex-shrink-0 p-1 rounded-md transition-opacity",
              "hover:bg-muted dark:hover:bg-muted/50",
              "opacity-0 group-hover/tab:opacity-100",
              isActive && "opacity-100",
            )}
          >
            <X className="size-3 text-primary dark:text-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

// Extract favicon from URL (simplified - you might want to improve this)
const getFavicon = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
};

export const TabBar: React.FC = () => {
  const { tabs, createTab, closeTab, switchTab } = useBrowser();

  const handleCreateTab = () => {
    void createTab();
  };

  return (
    <div className="flex-1 overflow-x-hidden flex items-center">
      {/* Tabs */}
      <div className="flex-1 overflow-x-auto flex items-center px-4 gap-2">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            title={tab.title}
            favicon={getFavicon(tab.url)}
            isActive={tab.isActive}
            onClose={async () => closeTab(tab.id)}
            onActivate={async () => switchTab(tab.id)}
          />
        ))}
      </div>

      {/* Add Tab Button */}
      <div className="pl-1.5 pr-4">
        <TabBarButton Icon={Plus} onClick={handleCreateTab} />
      </div>
    </div>
  );
};
