import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../common/lib/utils";

interface TabBarButtonProps {
  Icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export const TabBarButton: React.FC<TabBarButtonProps> = ({ Icon, onClick, className }) => (
  <div
    className={cn(
      "size-8 flex items-center justify-center rounded-md",
      "hover:bg-primary/10 active:bg-primary/20 app-region-no-drag",
      "transition-colors duration-200 cursor-pointer",
      className,
    )}
    onClick={onClick}
    tabIndex={-1}
  >
    <Icon className="size-4.5" />
  </div>
);
