"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Info } from "lucide-react";
import { AQI_STANDARDS, AqiStandard } from "@/lib/utils/aqi-standards";
import { setAqiStandard } from "@/lib/preferences";
import { cn } from "@/lib/utils";

interface AqiStandardSelectorProps {
  standard: AqiStandard;
}

/**
 * Map overlay that lets the reader pick which air-quality index the map reports
 * against. Rendered outside <MapContainer> so Leaflet never sees the clicks,
 * and above Leaflet's own controls (z-index 1000 on the pane stack).
 */
export function AqiStandardSelector({ standard }: AqiStandardSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Air quality index: ${standard.name}. Change index standard`}
        className="flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-left shadow-md backdrop-blur transition-colors hover:bg-card"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Index
        </span>
        <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
        <span className="text-xs font-bold text-foreground">{standard.shortName}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Air quality index standard"
          className="absolute left-0 top-full z-10 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <p className="border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Report air quality as
          </p>
          {AQI_STANDARDS.map((option) => {
            const selected = option.id === standard.id;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setAqiStandard(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60",
                  selected && "bg-muted/40"
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 text-primary",
                    !selected && "invisible"
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground">
                    {option.name}
                  </span>
                  <span className="block text-[10px] leading-snug text-muted-foreground">
                    {option.source}
                  </span>
                </span>
                <span className="mt-0.5 flex shrink-0 gap-px" aria-hidden>
                  {option.categories.map((c) => (
                    <span
                      key={c.label}
                      className="h-3 w-1.5 first:rounded-l-sm last:rounded-r-sm"
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
          <div className="space-y-1.5 border-t border-border/60 bg-muted/30 px-3 py-2 text-[10px] leading-snug text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span>{standard.attribution}</span>
            </p>
            <p className="pl-[1.125rem]">{standard.methodology}</p>
            <p className="pl-[1.125rem] opacity-80">Your choice is saved to your account.</p>
          </div>
        </div>
      )}
    </div>
  );
}
