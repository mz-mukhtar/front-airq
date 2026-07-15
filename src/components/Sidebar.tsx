"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Activity,
} from "lucide-react";
import { useStationNavItems, type StationNavItem } from "@/hooks/useStationNavItems";
import { useAuth } from "@/contexts/AuthContext";
import {
  APP_NAV_ITEMS,
  ADMIN_NAV_ITEM,
  DIAGNOSTICS_NAV_ITEM,
  isActiveNavPath,
  type AppNavItem,
} from "@/lib/app-nav";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function NavButton({
  item,
  active,
  expanded,
  onNavigate,
  nested,
}: {
  item: AppNavItem;
  active: boolean;
  expanded: boolean;
  onNavigate: (path: string) => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      title={!expanded ? item.label : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
        nested ? "px-3 py-2" : "px-3 py-2.5",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-foreground/80 hover:bg-card hover:text-foreground hover:shadow-sm",
        !expanded && "justify-center px-0 py-2.5"
      )}
    >
      {active && !nested && (
        <span className="absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-ring" />
      )}
      <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0", active && "text-primary-foreground")} />
      {expanded && (
        <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
          <span>{item.label}</span>
          {item.description && !nested && (
            <span
              className={cn(
                "text-[10px] font-normal",
                active ? "text-primary-foreground/75" : "text-muted-foreground"
              )}
            >
              {item.description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function SidebarNav({
  expanded,
  onNavigate,
  stations,
  stationsLoading,
  menuItems,
  pathname,
}: {
  expanded: boolean;
  onNavigate: (path: string) => void;
  stations: StationNavItem[];
  stationsLoading: boolean;
  menuItems: AppNavItem[];
  pathname: string;
}) {
  const sensorsActive =
    pathname === "/sensors" ||
    pathname.startsWith("/sensors/") ||
    pathname === "/stations" ||
    pathname.startsWith("/stations/");
  const [sensorsOpen, setSensorsOpen] = useState(sensorsActive);

  useEffect(() => {
    if (sensorsActive) setSensorsOpen(true);
  }, [sensorsActive]);

  const coreItems = menuItems.filter((i) => i.path !== "/sensors");
  const sensorsItem = menuItems.find((i) => i.path === "/sensors");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {expanded && (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Platform
        </p>
      )}

      {coreItems.map((item) => (
        <NavButton
          key={item.path}
          item={item}
          active={isActiveNavPath(pathname, item.path)}
          expanded={expanded}
          onNavigate={onNavigate}
        />
      ))}

      {sensorsItem && (
        <div className="space-y-1">
          {expanded ? (
            <>
              <button
                type="button"
                onClick={() => setSensorsOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  sensorsActive
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-foreground/80 hover:bg-card hover:shadow-sm"
                )}
              >
                <sensorsItem.icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                <span className="flex flex-1 flex-col items-start text-left leading-tight">
                  <span>{sensorsItem.label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {sensorsItem.description}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    sensorsOpen && "rotate-180"
                  )}
                />
              </button>
              {sensorsOpen && (
                <div className="ml-2 space-y-0.5 border-l border-border/70 pl-2">
                  <button
                    type="button"
                    onClick={() => onNavigate("/stations")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                      pathname === "/stations" || pathname.startsWith("/stations/")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    All stations
                  </button>
                  {stationsLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
                  ) : stations.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No stations</p>
                  ) : (
                    stations.map((station) => (
                      <button
                        key={station.id}
                        type="button"
                        onClick={() => onNavigate(`/sensors?device=${station.deviceId}`)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span className="truncate">{station.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <NavButton
              item={sensorsItem}
              active={sensorsActive}
              expanded={false}
              onNavigate={onNavigate}
            />
          )}
        </div>
      )}
    </nav>
  );
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { stations, stationsLoading } = useStationNavItems();

  const menuItems = [...APP_NAV_ITEMS];
  if (user?.role === "admin") {
    menuItems.push(ADMIN_NAV_ITEM);
    menuItems.push(DIAGNOSTICS_NAV_ITEM);
  }

  const onNavigate = (path: string) => router.push(path);

  const sidebarPanel = (
    <>
      <div
        className={cn(
          "flex items-center border-b border-border/50 px-3 py-4",
          isOpen ? "justify-between gap-2" : "justify-center"
        )}
      >
        {isOpen ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Air Quality</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Monitor
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
        )}
        {isOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="hidden h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground lg:flex"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SidebarNav
        expanded={isOpen}
        onNavigate={onNavigate}
        stations={stations}
        stationsLoading={stationsLoading}
        menuItems={menuItems}
        pathname={pathname}
      />

      <div className="mt-auto border-t border-border/50 p-3">
        {!isOpen ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="mx-auto flex h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        ) : (
          <div className="rounded-xl bg-card/80 px-3 py-2.5 ring-1 ring-border/60">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Signed in</p>
            <p className="truncate text-xs font-medium text-foreground">{user?.email ?? "—"}</p>
            {user?.role === "admin" && (
              <span className="mt-1 inline-flex rounded-md bg-ring/10 px-1.5 py-0.5 text-[10px] font-semibold text-ring">
                Admin
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-border/60 bg-card/90 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex",
          "shadow-[4px_0_24px_-12px_rgba(0,0,0,0.12)]",
          isOpen ? "w-[15.5rem]" : "w-[4.75rem]"
        )}
      >
        {sidebarPanel}
      </aside>

      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 top-3.5 z-50 h-10 w-10 rounded-xl border-border/60 bg-card/90 shadow-md backdrop-blur lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[17rem] border-border/60 bg-card/95 p-0 backdrop-blur-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">{sidebarPanel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
