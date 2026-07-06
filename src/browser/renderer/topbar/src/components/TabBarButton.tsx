import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../common/lib/utils";

interface TabBarButtonProps {
  Icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
  strokeWidth?: number;
}

export const TabBarButton: React.FC<TabBarButtonProps> = ({
  Icon,
  onClick,
  className,
  iconClassName,
  strokeWidth = 1.5,
}) => (
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
    <Icon className={cn("size-4", iconClassName)} strokeWidth={strokeWidth} />
  </div>
);
