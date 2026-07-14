"use client";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileButton } from "@/components/ProfileButton";
import { useAuth } from "@/contexts/AuthContext";
import { useStationNavItems } from "@/hooks/useStationNavItems";
import {
  Database,
  Menu,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS, ADMIN_NAV_ITEM, isActiveNavPath } from "@/lib/app-nav";

const navItems = APP_NAV_ITEMS.filter((item) => item.path !== "/sensors");

/** Above Leaflet panes (~400–800) and map chrome. */
const FLOATING_MENU_Z = "z-[1100]";

function isActivePath(pathname: string, path: string) {
  return isActiveNavPath(pathname, path);
}

export function MapPageChrome() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { stations, stationsLoading } = useStationNavItems();

  const items = [...navItems];
  if (user?.role === "admin") {
    items.push(ADMIN_NAV_ITEM);
  }

  const sensorsActive =
    pathname === "/sensors" ||
    pathname.startsWith("/sensors/") ||
    pathname === "/stations" ||
    pathname.startsWith("/stations/");

  const sensorMenuItems = (
    <>
      <DropdownMenuItem onClick={() => router.push("/stations")}>
        All Sensors
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {stationsLoading ? (
        <DropdownMenuItem disabled>Loading stations…</DropdownMenuItem>
      ) : stations.length === 0 ? (
        <DropdownMenuItem disabled>No stations available</DropdownMenuItem>
      ) : (
        stations.map((station) => (
          <DropdownMenuItem
            key={station.id}
            onClick={() => router.push(`/sensors?device=${station.deviceId}`)}
          >
            {station.name}
          </DropdownMenuItem>
        ))
      )}
    </>
  );

  return (
    <>
      {/* Top-left branding */}
      <div className="pointer-events-auto absolute top-4 left-4 md:left-20 z-[1000] max-w-[min(100vw-2rem,22rem)]">
        <div className="rounded-2xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-ring text-background flex items-center justify-center text-xs font-semibold tracking-tight">
              AQ
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Dashboard
              </p>
              <p className="text-sm font-semibold text-primary truncate">
                Addis Ababa air quality map
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground hidden sm:block">
            Real-time PM and AQI · click a station for details
          </p>
        </div>
      </div>

      {/* Top-right profile */}
      <div className="pointer-events-auto absolute top-4 right-4 z-[1000]">
        <div className="rounded-2xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg p-1.5">
          <ProfileButton menuClassName={FLOATING_MENU_Z} />
        </div>
      </div>

      {/* Left floating nav — desktop */}
      <nav className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 z-[1000] hidden md:flex flex-col gap-2">
        {items.map(({ icon: Icon, label, path }) => {
          const active = isActivePath(pathname, path);
          return (
            <Button
              key={path}
              variant="ghost"
              size="icon"
              title={label}
              onClick={() => router.push(path)}
              className={cn(
                "h-11 w-11 rounded-xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg",
                active
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-primary hover:bg-background/95"
              )}
            >
              <Icon className="h-5 w-5" />
            </Button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Sensors"
              className={cn(
                "h-11 w-11 rounded-xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg",
                sensorsActive
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-primary hover:bg-background/95"
              )}
            >
              <Database className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="right"
            className={cn(FLOATING_MENU_Z, "w-56 max-h-72 overflow-y-auto")}
          >
            {sensorMenuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Mobile nav menu */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-[1000] md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full border border-white/20 bg-background/90 backdrop-blur-md shadow-lg"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className={cn(FLOATING_MENU_Z, "w-72")}>
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-2">
              {items.map(({ icon: Icon, label, path }) => {
                const active = isActivePath(pathname, path);
                return (
                  <Button
                    key={path}
                    variant={active ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => router.push(path)}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                );
              })}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={sensorsActive ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                  >
                    <Database className="h-5 w-5" />
                    Sensors
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn(FLOATING_MENU_Z, "w-56 max-h-72 overflow-y-auto")}
                >
                  {sensorMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
