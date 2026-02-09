"use client";

import { Users } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";

export type AgentsPanelHeaderProps = {
  total: number;
  collapsed?: boolean;
};

export const AgentsPanelHeader = ({
  total,
  collapsed = false,
}: AgentsPanelHeaderProps) => {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-b",
        collapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3",
      )}
    >
      <div className="flex items-center gap-2">
        <Users className="text-foreground h-4 w-4" />
        {!collapsed && (
          <h2 className="text-sm font-semibold tracking-wide">Agents</h2>
        )}
      </div>

      {!collapsed && (
        <span className="text-muted-foreground rounded-md border px-2 py-0.5 text-xs tabular-nums">
          {total}
        </span>
      )}
    </div>
  );
};
