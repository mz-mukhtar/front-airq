import type { Metadata, Viewport } from "next";
import { Geist, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AuthInitializer } from "@/components/AuthInitializer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { homePageGraph } from "@/lib/structured-data";
import { OG_BASE, SITE_NAME, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Required, not optional: without it Next resolves relative OG/canonical URLs
  // against http://localhost:3000 on a self-hosted deploy — a warning, not an
  // error, so it ships silently broken.
  metadataBase: new URL(SITE_URL),
  title: {
    // The formula the established players converge on: place + "Air Quality
    // Index (AQI)" + the pollutants we actually publish. Deliberately no live
    // AQI number — SERP snippets are cached and go stale, which is why a
    // competitor currently renders "is now --." in Google's results.
    //
    // PM1.0, not PM10, even though PM10 is the higher-volume search term: the
    // live public pages show PM1.0 and PM2.5, and a title promising a figure the
    // page does not display is the kind of mismatch that costs more in bounce
    // rate than the extra impressions are worth. PM10 is still measured and
    // exported, and structured-data.ts declares it as a dataset variable, so the
    // term is not absent from the site — it is just no longer in the headline.
    default: "Addis Ababa Air Quality Index (AQI) — Live PM2.5 & PM1.0 | Addis Air Net",
    template: "%s | Addis Air Net",
  },
  description:
    "Live air quality in Addis Ababa, Ethiopia. Real-time AQI, PM2.5 and PM1.0 readings, temperature and humidity from a network of monitoring stations across the city — reported against US EPA, European EAQI, UK DAQI or WHO 2021 standards.",
  applicationName: SITE_NAME,
  keywords: [
    "air quality Addis Ababa",
    "Addis Ababa AQI",
    "Addis Ababa air quality index",
    "air pollution Addis Ababa",
    "Ethiopia air quality",
    "Ethiopia air pollution",
    "Addis Ababa PM2.5",
    "air quality map Ethiopia",
    "የአየር ጥራት",
    "የአዲስ አበባ የአየር ጥራት",
    "የአየር ብክለት",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "science",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
    // No hreflang yet, deliberately. Amharic is a stored preference, not a
    // distinct URL, so there is nothing for an `am` alternate to point at —
    // and pointing it at the English page would be a false signal. Add these
    // when /am/ exists as real localised routes.
  },
  openGraph: {
    ...OG_BASE,
    title: "Addis Ababa Air Quality Index (AQI) — Live PM2.5 & PM1.0",
    description:
      "Live AQI, PM2.5 and PM1.0 readings from a monitoring network across Addis Ababa, Ethiopia.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Addis Ababa Air Quality Index (AQI) — Live PM2.5 & PM1.0",
    description:
      "Live AQI, PM2.5 and PM1.0 readings from a monitoring network across Addis Ababa, Ethiopia.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// themeColor and colorScheme belong here, not in `metadata` — they were moved
// out in Next 13.2 and warn if left behind.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Runs before paint: applies the saved theme so the first frame is already
// dark when it should be (no light flash). Mirrors resolveTheme() in
// lib/preferences.ts — keep the two in sync.
const themeInitScript = `
try {
  var p = JSON.parse(localStorage.getItem("userPreferences") || "{}");
  var t = p.theme || "light";
  var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  if (p.language === "am") document.documentElement.lang = "am";
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: themeInitScript mutates <html>'s class and lang
    // before React hydrates, so the server markup deliberately differs here.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Structured data in the root layout so it lands in the prerendered
          HTML. It cannot live in the pages themselves — those are all client
          components, and markup injected after hydration is markup a crawler
          may never see.
        */}
        <JsonLd data={homePageGraph()} />
        <ThemeProvider>
          <AuthInitializer>
            {children}
          </AuthInitializer>
        </ThemeProvider>
      </body>
    </html>
  );
}
