import type { CSSProperties } from "react";
import "./auth-atmosphere.css";

/**
 * Sparse floating dust / pollen motes. Fixed (deterministic) configs so
 * server and client render identically — no hydration mismatch.
 * size: px · duration/delay: s · dx: horizontal drift in px · opacity: peak.
 * Negative delays start each mote mid-flight so the scene is alive on load.
 */
const PARTICLES = [
  { left: "7%", top: "72%", size: 5, duration: 26, delay: -4, dx: 16, opacity: 0.5 },
  { left: "14%", top: "38%", size: 3, duration: 19, delay: -11, dx: -12, opacity: 0.4 },
  { left: "22%", top: "58%", size: 4, duration: 31, delay: -7, dx: 20, opacity: 0.45 },
  { left: "31%", top: "26%", size: 2, duration: 16, delay: -2, dx: 10, opacity: 0.35 },
  { left: "44%", top: "66%", size: 6, duration: 34, delay: -18, dx: -18, opacity: 0.4 },
  { left: "55%", top: "31%", size: 3, duration: 22, delay: -9, dx: 14, opacity: 0.4 },
  { left: "63%", top: "76%", size: 4, duration: 28, delay: -14, dx: -14, opacity: 0.5 },
  { left: "72%", top: "48%", size: 2, duration: 17, delay: -5, dx: 12, opacity: 0.35 },
  { left: "81%", top: "62%", size: 5, duration: 33, delay: -21, dx: 18, opacity: 0.45 },
  { left: "88%", top: "34%", size: 3, duration: 21, delay: -12, dx: -10, opacity: 0.4 },
  { left: "36%", top: "84%", size: 4, duration: 25, delay: -16, dx: 15, opacity: 0.4 },
  { left: "93%", top: "80%", size: 2, duration: 18, delay: -8, dx: -8, opacity: 0.3 },
] as const;

/**
 * AuthAtmosphere — shared full-viewport environmental backdrop for the auth
 * pages. Renders a serene daytime sky in the light theme (sun glow, drifting
 * clouds, pollen motes, low haze) and a moonlit night sky in the dark theme.
 *
 * Purely decorative: pointer-events disabled, hidden from assistive tech,
 * and all motion is removed under prefers-reduced-motion (see
 * auth-atmosphere.css). Place inside a `relative overflow-hidden` wrapper,
 * with the page content in a sibling `relative z-10` container.
 */
export function AuthAtmosphere() {
  return (
    <div className="auth-atmosphere" aria-hidden="true">
      <div className="auth-atmosphere__sky" />
      <div className="auth-atmosphere__sun" />
      <div className="auth-atmosphere__cloud auth-atmosphere__cloud--one" />
      <div className="auth-atmosphere__cloud auth-atmosphere__cloud--two" />
      <div className="auth-atmosphere__cloud auth-atmosphere__cloud--three" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="auth-atmosphere__particle"
          style={
            {
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--p-dur": `${p.duration}s`,
              "--p-delay": `${p.delay}s`,
              "--p-dx": `${p.dx}px`,
              "--p-opacity": p.opacity,
            } as CSSProperties
          }
        />
      ))}
      <div className="auth-atmosphere__haze" />
    </div>
  );
}
