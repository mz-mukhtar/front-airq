"use client";

import { useEffect, useRef } from "react";

/**
 * The sensor-housing clip, in one place.
 *
 * It is 1.4 MB and was mounted by three separate <video> elements, two of them
 * autoplaying above the fold — so a first-time visitor could pull it twice in
 * parallel before the HTTP cache had a copy to serve. One component now owns
 * both the URL and the loading policy.
 */
const SRC = "/Sensor%20housing%20Final.mp4";
const POSTER = "/photo_2026-03-16_22-45-40.jpg";

interface SensorHousingVideoProps {
  className?: string;
  /**
   * `eager` — start on mount. For the hero, where the motion is the point.
   * `visible` — fetch nothing until it scrolls into view, then load and play.
   *   This is what keeps the below-the-fold copy from racing the hero for
   *   bandwidth on first paint.
   */
  play?: "eager" | "visible";
  controls?: boolean;
  poster?: boolean;
  onError?: () => void;
}

export function SensorHousingVideo({
  className,
  play = "eager",
  controls = false,
  poster = true,
  onError,
}: SensorHousingVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (play !== "visible") return;
    const video = ref.current;
    if (!video) return;

    // preload="none" means nothing is fetched until something asks for it;
    // calling play() is what asks. That pairing is deliberate — `preload="none"`
    // together with `autoPlay` is self-contradictory and browsers resolve it
    // inconsistently, so the visible variant carries no autoPlay attribute and
    // drives playback from here instead.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            /* autoplay blocked — the poster stays, which is a fine fallback */
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [play]);

  const eager = play === "eager";

  return (
    <video
      ref={ref}
      src={SRC}
      className={className}
      // Only the eager variant declares autoPlay; see the effect above.
      autoPlay={eager}
      preload={eager ? "auto" : "none"}
      poster={poster ? POSTER : undefined}
      loop
      muted
      playsInline
      controls={controls}
      onError={onError}
    />
  );
}
