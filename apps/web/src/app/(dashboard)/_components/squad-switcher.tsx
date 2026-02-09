"use client";

import { ChevronsUpDown, Users, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@clawe/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@clawe/ui/components/sidebar";
import { useSquad } from "@/providers/squad-provider";
import { Skeleton } from "@clawe/ui/components/skeleton";

export const SquadSwitcher = () => {
  const { state } = useSidebar();
  const { squads, selectedSquad, setSelectedSquad, isLoading } = useSquad();

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size={state === "collapsed" ? "lg" : "sm"}
            className="min-h-9 justify-center"
          >
            <Skeleton className="size-5 rounded-sm bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-4 w-24 bg-gray-200 group-data-[collapsible=icon]:hidden dark:bg-gray-700" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!selectedSquad) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size={state === "collapsed" ? "lg" : "sm"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground min-h-9 justify-center"
            >
              <div className="bg-brand flex aspect-square size-5 items-center justify-center rounded-sm text-white">
                <Users className="size-3" />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">
                  {selectedSquad.name}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Squads
            </DropdownMenuLabel>
            {squads.map((squad) => (
              <DropdownMenuItem
                key={squad.id}
                onClick={() => setSelectedSquad(squad)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Users className="size-3.5 shrink-0" />
                </div>
                {squad.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add squad</div>
              <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                Soon
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
