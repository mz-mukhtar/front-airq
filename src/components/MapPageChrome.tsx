"use client";

import Link from "next/link";
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
import { AqiStandardSelector } from "@/components/map/AqiStandardSelector";
import { useAqiStandard } from "@/lib/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { useStationNavItems } from "@/hooks/useStationNavItems";
import { useWaitlistNotifications } from "@/hooks/useWaitlistNotifications";
import {
  Database,
  Menu,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_NAV_ITEMS,
  ADMIN_NAV_ITEM,
  DIAGNOSTICS_NAV_ITEM,
  isActiveNavPath,
} from "@/lib/app-nav";

const navItems = APP_NAV_ITEMS.filter((item) => item.path !== "/sensors");

/** Above Leaflet panes (~400–800) and map chrome. */
const FLOATING_MENU_Z = "z-[1100]";

function isActivePath(pathname: string, path: string) {
  return isActiveNavPath(pathname, path);
}

/** Cap the badge so a long queue cannot widen the floating rail. */
function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}

function badgeLabel(count: number) {
  return count === 1
    ? "1 access request awaiting review"
    : `${count} access requests awaiting review`;
}

export function MapPageChrome() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { stations, stationsLoading } = useStationNavItems();
  const { pending: pendingRequests } = useWaitlistNotifications();
  const standard = useAqiStandard();

  const items = [...navItems];
  if (user?.role === "admin") {
    items.push(ADMIN_NAV_ITEM);
    items.push(DIAGNOSTICS_NAV_ITEM);
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
      {/* Top-left branding, with the index picker stacked under it */}
      <div className="pointer-events-auto absolute top-4 left-4 md:left-20 z-[1000] flex max-w-[min(100vw-2rem,22rem)] flex-col items-start gap-2">
        <div className="w-full rounded-2xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg px-4 py-3">
          {/* Monogram + wordmark go home, as a header brand mark should. */}
          <Link
            href="/"
            aria-label="Addis Air Net — home"
            className="flex items-center gap-3 rounded-xl transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="h-10 w-10 shrink-0 rounded-xl bg-ring text-background flex items-center justify-center text-xs font-semibold tracking-tight">
              AAN
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Dashboard
              </p>
              <p className="text-sm font-semibold text-primary truncate">Addis Air Net</p>
            </div>
          </Link>
          <p className="mt-2 text-[11px] text-muted-foreground hidden sm:block">
            Addis Ababa · real-time PM and AQI · click a station for details
          </p>
        </div>

        {/*
          Which index the map reports against. Lives here rather than inside
          <Map> so it flows under the branding card instead of overlapping it,
          and so it stays available while the map is still loading.
        */}
        <AqiStandardSelector standard={standard} />
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
          const badge = path === ADMIN_NAV_ITEM.path ? pendingRequests : 0;
          return (
            <Button
              key={path}
              variant="ghost"
              size="icon"
              title={badge > 0 ? `${label} — ${badgeLabel(badge)}` : label}
              onClick={() => router.push(path)}
              className={cn(
                "relative h-11 w-11 rounded-xl border border-white/20 bg-background/85 backdrop-blur-md shadow-lg",
                active
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-primary hover:bg-background/95"
              )}
            >
              <Icon className="h-5 w-5" />
              {badge > 0 && (
                <>
                  <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
                    {badgeText(badge)}
                  </span>
                  <span className="sr-only">{badgeLabel(badge)}</span>
                </>
              )}
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
                const badge = path === ADMIN_NAV_ITEM.path ? pendingRequests : 0;
                return (
                  <Button
                    key={path}
                    variant={active ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => router.push(path)}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                    {badge > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
                        {badgeText(badge)}
                        <span className="sr-only"> {badgeLabel(badge)}</span>
                      </span>
                    )}
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
