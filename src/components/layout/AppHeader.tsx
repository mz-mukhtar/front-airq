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
        // min-h, not a fixed h: the previous 3.75rem was exactly the height of
        // the three text lines, leaving no room above or below and letting a
        // long title press against the border. The min keeps every page's
        // header the same height; the padding is what stops it crushing.
        "sticky top-0 z-30 flex min-h-[var(--app-header-height)] shrink-0 items-center gap-4",
        "border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/70 md:px-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon && (
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-5 w-5" />
          </div>
        )}
        {/*
          Two lines, not three: the section label sits above, and the title and
          subtitle share the line below as "Title : subtitle". The subtitle is
          the part that gives when space runs short — it truncates while the
          title stays whole, since the title is what identifies the page.
        */}
        <div className="min-w-0 space-y-1">
          {sectionLabel && (
            <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-muted-foreground">
              {sectionLabel}
            </p>
          )}
          <div className="flex min-w-0 items-baseline gap-1.5">
            {title && (
              <h1 className="max-w-full shrink-0 truncate text-base font-semibold leading-tight text-foreground md:text-lg">
                {title}
              </h1>
            )}
            {subtitle && (
              <span
                className="hidden min-w-0 items-baseline gap-1.5 sm:flex"
                title={subtitle}
              >
                <span aria-hidden className="text-muted-foreground/60">
                  :
                </span>
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              </span>
            )}
          </div>
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
