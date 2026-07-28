import { MapPin, Database, Settings, Shield, Activity, AlertTriangle, HelpCircle, type LucideIcon } from "lucide-react";

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
  // Public, but it belongs in the app nav too: the guide explains the index
  // scales and the export dialog, which is exactly when a signed-in user wants
  // it. Previously it was reachable only from one strip on the landing page.
  { icon: HelpCircle, label: "Guide", path: "/getting-started", description: "How to read the data" },
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
