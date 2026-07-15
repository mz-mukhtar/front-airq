"use client";

import { ProfileButton } from "@/components/ProfileButton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface AppHeaderProps {
  sectionLabel?: string;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  sectionLabel,
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[3.75rem] shrink-0 items-center gap-4 border-b border-border/60",
        "bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:px-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon && (
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          {sectionLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {sectionLabel}
            </p>
          )}
          {title && (
            <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <div className="rounded-xl border border-border/60 bg-card/80 p-1 shadow-sm">
          <ProfileButton />
        </div>
      </div>
    </header>
  );
}
