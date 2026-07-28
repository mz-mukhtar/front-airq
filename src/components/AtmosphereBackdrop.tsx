import type { CSSProperties } from "react";

import "./atmosphere-backdrop.css";

type ParticleTone = "sky" | "emerald" | "teal";

interface Particle {
  /** Vertical position (vh for viewport-anchored, % for page-depth-anchored). */
  top: string;
  left: string;
  /** Diameter in px (3–8). */
  size: number;
  /** Float loop duration in seconds (18–40). */
  duration: number;
  /** Stagger offset in seconds (applied as a negative delay so loops start mid-cycle). */
  delay: number;
  tone: ParticleTone;
}

const PARTICLES: Particle[] = [
  { top: "9vh", left: "12%", size: 5, duration: 26, delay: 0, tone: "sky" },
  { top: "14vh", left: "68%", size: 3, duration: 19, delay: 4, tone: "teal" },
  { top: "22vh", left: "38%", size: 7, duration: 34, delay: 9, tone: "emerald" },
  { top: "30vh", left: "85%", size: 4, duration: 22, delay: 13, tone: "sky" },
  { top: "38vh", left: "6%", size: 6, duration: 30, delay: 6, tone: "teal" },
  { top: "50vh", left: "54%", size: 3, duration: 18, delay: 11, tone: "sky" },
  { top: "62vh", left: "26%", size: 8, duration: 40, delay: 17, tone: "emerald" },
  { top: "74vh", left: "78%", size: 4, duration: 24, delay: 2, tone: "teal" },
  { top: "92vh", left: "46%", size: 5, duration: 28, delay: 20, tone: "sky" },
  { top: "115vh", left: "16%", size: 6, duration: 36, delay: 7, tone: "emerald" },
  { top: "135vh", left: "64%", size: 3, duration: 21, delay: 15, tone: "sky" },
  { top: "42%", left: "88%", size: 5, duration: 32, delay: 10, tone: "teal" },
  { top: "70%", left: "8%", size: 4, duration: 27, delay: 5, tone: "emerald" },
];

/**
 * Decorative, CSS-only atmospheric backdrop: drifting blurred cloud shapes,
 * faint curved wind-stream lines, and floating dust/pollen particles.
 *
 * Renders absolutely positioned behind content (z-index -10), never intercepts
 * pointer events, is hidden from assistive tech, and freezes entirely under
 * `prefers-reduced-motion: reduce`. Place inside a `position: relative`
 * container; the backdrop clips its own layers (overflow hidden), so it never
 * introduces horizontal scrolling.
 */
export function AtmosphereBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`atmosphere-backdrop pointer-events-none${className ? ` ${className}` : ""}`}
    >
      {/* Drifting blurred cloud shapes */}
      <div className="atmos-cloud atmos-cloud-1" />
      <div className="atmos-cloud atmos-cloud-2" />
      <div className="atmos-cloud atmos-cloud-3" />

      {/* Faint curved wind-stream lines */}
      <div className="atmos-stream atmos-stream-1" />
      <div className="atmos-stream atmos-stream-2" />
      <div className="atmos-stream atmos-stream-3" />

      {/* Floating dust / pollen particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`atmos-particle atmos-particle--${p.tone}`}
          style={
            {
              top: p.top,
              left: p.left,
              "--s": `${p.size}px`,
              "--d": `${p.duration}s`,
              animationDelay: `-${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
