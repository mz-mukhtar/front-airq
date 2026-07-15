import { MapPin, Database, Settings, Shield, Activity, AlertTriangle, type LucideIcon } from "lucide-react";

export interface AppNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  description?: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { icon: MapPin, label: "Map", path: "/dashboard", description: "Live stations" },
  { icon: Database, label: "Sensors", path: "/sensors", description: "Charts & export" },
  { icon: AlertTriangle, label: "Alerts", path: "/alerts", description: "Exceedances" },
  { icon: Settings, label: "Settings", path: "/settings", description: "Preferences" },
];

export const ADMIN_NAV_ITEM: AppNavItem = {
  icon: Shield,
  label: "Admin",
  path: "/admin",
  description: "Users & devices",
};

export const DIAGNOSTICS_NAV_ITEM: AppNavItem = {
  icon: Activity,
  label: "Diagnostics",
  path: "/diagnostics",
  description: "Sensor health",
};

export function isActiveNavPath(pathname: string, path: string) {
  if (path === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
