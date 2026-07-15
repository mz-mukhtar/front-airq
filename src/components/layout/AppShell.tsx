"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  sectionLabel?: string;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  headerActions?: React.ReactNode;
  mainClassName?: string;
}

export function AppShell({
  children,
  sectionLabel,
  title,
  subtitle,
  icon,
  headerActions,
  mainClassName,
}: AppShellProps) {
  // Start with a deterministic value so server and client markup match;
  // restore the persisted preference after mount.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarOpen");
    if (saved !== null) {
      setSidebarOpen(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,var(--muted)_0%,var(--background)_45%,color-mix(in_oklab,var(--primary)_6%,var(--background))_100%)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin] duration-300 ease-out",
          sidebarOpen ? "lg:ml-[15.5rem]" : "lg:ml-[4.75rem]"
        )}
      >
        <AppHeader
          sectionLabel={sectionLabel}
          title={title}
          subtitle={subtitle}
          icon={icon}
          actions={headerActions}
        />

        <main className={cn("flex-1 overflow-auto", mainClassName)}>{children}</main>
      </div>
    </div>
  );
}
