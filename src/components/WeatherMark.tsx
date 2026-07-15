import * as React from "react";
import { cn } from "@/lib/utils";

type WeatherMarkProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export function WeatherMark({ className, title = "Weather", ...props }: WeatherMarkProps) {
  const id = React.useId().replace(/:/g, "");
  const sun = `weather-sun-${id}`;
  const cloud = `weather-cloud-${id}`;
  const rain = `weather-rain-${id}`;
  const haze = `weather-haze-${id}`;

  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn(className)}
      {...props}
    >
      <defs>
        <linearGradient id={sun} x1="110" y1="10" x2="134" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.55" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id={cloud} x1="32" y1="15" x2="136" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset="0.5" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id={rain} x1="59" y1="78" x2="109" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id={haze} x1="14" y1="82" x2="70" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F472B6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#A78BFA" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Sun */}
      <g opacity="0.95" stroke={`url(#${sun})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="122" cy="28" r="12" fill="#FEF08A" fillOpacity="0.55" />
        <path d="M122 7v6" />
        <path d="M122 43v6" />
        <path d="M101 28h6" />
        <path d="M137 28h6" />
        <path d="M108.5 14.5l4.2 4.2" />
        <path d="M129.3 35.3l4.2 4.2" />
        <path d="M135.5 14.5l-4.2 4.2" />
        <path d="M114.7 35.3l-4.2 4.2" />
      </g>

      {/* Cloud */}
      <path
        d="M52 70h62c12 0 22-8.2 22-18.5 0-9.2-8.1-16.9-18.7-18.1C115.3 23 105.3 15 93.5 15c-12.2 0-22.7 8.5-25.2 20.2-1.6-.5-3.3-.8-5.1-.8-9.5 0-17.2 7-17.2 15.6 0 .8.1 1.7.3 2.5C38.2 54.6 32 60 32 66.6 32 72 41 70 52 70Z"
        stroke={`url(#${cloud})`}
        strokeWidth="4"
        strokeLinejoin="round"
        fill="#EDE9FE"
        fillOpacity="0.45"
        opacity="0.95"
      />

      {/* Rain */}
      <g stroke={`url(#${rain})`} strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <path d="M64 78l-5 10" />
        <path d="M84 78l-5 10" />
        <path d="M104 78l-5 10" />
      </g>

      {/* Dust / haze */}
      <g stroke={`url(#${haze})`} strokeWidth="4" strokeLinecap="round" opacity="0.75">
        <path d="M18 82c10 0 14-6 24-6s14 6 24 6" />
        <path d="M14 92c12 0 16-6 28-6s16 6 28 6" />
      </g>

      <g opacity="0.7">
        <circle cx="22" cy="74" r="2.5" fill="#F472B6" />
        <circle cx="34" cy="88" r="2.2" fill="#34D399" />
        <circle cx="50" cy="80" r="2.1" fill="#38BDF8" />
        <circle cx="118" cy="86" r="2.3" fill="#FBBF24" />
      </g>
    </svg>
  );
}
