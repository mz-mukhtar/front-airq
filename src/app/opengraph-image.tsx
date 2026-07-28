import { ImageResponse } from "next/og";

export const alt =
  "Addis Air Net — live air quality monitoring for Addis Ababa, Ethiopia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social preview card, rasterised at build time.
 *
 * Rendered by Satori, which supports flexbox only and does not see the app's
 * Tailwind stylesheet — hence the inline styles and the explicit `display:
 * flex` on every container. No custom font is loaded: Satori's built-in face is
 * adequate here and reading a font off disk is one more thing that can fail a
 * production build for a decorative asset.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #041427 0%, #0b3b5a 55%, #0e7490 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#7dd3fc",
            }}
          >
            Addis Air Net
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 22,
            }}
          >
            Addis Ababa air quality,
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              lineHeight: 1.1,
              color: "#4ade80",
            }}
          >
            measured and public.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.88)" }}>
            Live PM2.5 · PM1.0 · temperature · humidity
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              marginTop: 14,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            US EPA · European EAQI · UK DAQI · WHO 2021
          </div>
        </div>
      </div>
    ),
    size
  );
}
