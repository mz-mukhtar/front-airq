"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  ArrowRight,
  Bell,
  Download,
  LineChart,
  MapPin,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAqiStandard } from "@/lib/preferences";
import { AQI_STANDARDS, categoryRangeLabel } from "@/lib/utils/aqi-standards";

/** Section shell so every step looks the same. */
function Step({
  icon: Icon,
  iconClass,
  title,
  description,
  children,
}: {
  icon: typeof MapPin;
  iconClass: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={`mt-1 rounded-lg p-2 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
        {children}
      </CardContent>
    </Card>
  );
}

export default function GettingStartedPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // The reader's own selected scale, so the bands below are the ones they will
  // actually see on the map rather than a scale they never chose.
  const standard = useAqiStandard();

  // Anonymous visitors get the public landing map, not the login wall. The
  // signed-in map is the fullscreen dashboard.
  const mapHref = isAuthenticated ? "/dashboard" : "/#map";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                New users
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                Getting started with Addis Air Net
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                How to read the map, what the numbers mean, and what you can do
                with the data.
              </p>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="shrink-0 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
            >
              Back to home
            </Button>
          </div>

          <div className="grid gap-5">
            <Step
              icon={MapPin}
              iconClass="bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100"
              title="1) Open the live map"
              description="No account needed."
            >
              <p>
                The map shows every monitoring station in the network. Each
                bubble carries that station&rsquo;s current reading, coloured by
                how clean the air is. Click one for its latest PM1.0 and PM2.5
                concentrations, temperature, humidity, and the time it last
                reported.
              </p>
              <p>
                Faded bubbles are stations that have not reported recently, so
                you can tell stale data from live data at a glance.
              </p>
              <Button
                onClick={() => router.push(mapHref)}
                variant="outline"
                className="border-sky-200 bg-transparent font-bold text-primary hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-sky-950/40"
              >
                Open the map
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Step>

            <Step
              icon={Activity}
              iconClass="bg-emerald-600/10 text-emerald-700"
              title="2) Understand the numbers"
              description="What the big number on each station actually is."
            >
              <p>
                The large number on a station is an{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  air quality index
                </span>{" "}
                — a single figure derived from the measured{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  PM2.5
                </span>{" "}
                concentration. It is not itself a measurement; it is a way of
                turning one into a category you can act on.
              </p>
              <p>
                Which index you see is your choice. Different bodies draw their
                thresholds in different places, so the same air can read
                &ldquo;Moderate&rdquo; on one scale and &ldquo;Fair&rdquo; on
                another. Pick a scale from the{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Index
                </span>{" "}
                selector in the top-left of the map:
              </p>
              <ul className="ml-1 space-y-1">
                {AQI_STANDARDS.map((option) => (
                  <li key={option.id}>
                    &mdash;{" "}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {option.name}
                    </span>{" "}
                    <span className="text-slate-500 dark:text-slate-500">
                      {option.source}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your current scale: {standard.name}
                </p>
                <ul className="space-y-1.5">
                  {standard.categories.map((category, index) => (
                    <li key={category.label} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                        aria-hidden
                      />
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {category.label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-500">
                        {categoryRangeLabel(standard, index)} µg/m³ PM2.5
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  {standard.methodology}
                </p>
              </div>

              <p className="pt-1">Alongside the index, each station reports:</p>
              <ul className="ml-1 space-y-1">
                <li>
                  &mdash;{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    PM2.5
                  </span>{" "}
                  — particles under 2.5 micrometres, in µg/m³. Small enough to
                  reach deep into the lungs, which is why health guidance is
                  built around it.
                </li>
                <li>
                  &mdash;{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    PM1.0
                  </span>{" "}
                  — the finest fraction, under 1 micrometre.
                </li>
                <li>
                  &mdash;{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Temperature and humidity
                  </span>{" "}
                  — context for the reading. Still, humid mornings trap
                  pollution near the ground.
                </li>
                <li>
                  &mdash; A dash (
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    —
                  </span>
                  ) means that sensor reported nothing. It never means zero.
                </li>
              </ul>
            </Step>

            <Step
              icon={Radio}
              iconClass="bg-sky-600/10 text-sky-700"
              title="3) Browse the station list"
              description="Also public — no account needed."
            >
              <p>
                Below the map on the home page, every station appears as a card
                with its current readings, so you can scan them side by side
                rather than hunting for markers.
              </p>
              <Button
                onClick={() => router.push("/#sensors")}
                variant="outline"
                className="border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
              >
                See the stations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Step>

            <Step
              icon={ShieldCheck}
              iconClass="bg-primary/10 text-primary"
              title="4) Sign in for the research data"
              description="History, charts and export live behind an account."
            >
              <p>
                The public map shows the latest reading. An account adds the
                record behind it: charts over 6 hours to a year, a full readings
                table, and the raw measurements the map summarises — including
                PM4.0, PM10, particle counts, and the VOC and NOx indices.
              </p>
              <p>
                It also opens the station explorer, where every monitor is a
                searchable, filterable card with a detail panel — the signed-in
                version of the list on the home page.
              </p>
              <Button onClick={() => router.push(isAuthenticated ? "/sensors" : "/login")}>
                {isAuthenticated ? "Open sensor data" : "Sign in / Sign up"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Step>

            <Step
              icon={LineChart}
              iconClass="bg-primary/10 text-primary"
              title="5) Read the charts"
              description="Trends, zooming, and comparing two stations."
            >
              <p>
                Pick a window — 6H, 24H, 7D, 30D or 1Y — and the charts redraw
                against averaged buckets rather than raw points, so a year loads
                as quickly as a day. Scroll on a chart to zoom, or drag the
                timeline below it to scrub.
              </p>
              <p>
                Select a second station to compare two side by side on the same
                axes. Gaps in a line are real: they mean the sensor reported
                nothing in that period, and the chart breaks rather than drawing
                a straight line through the missing time.
              </p>
            </Step>

            <Step
              icon={Download}
              iconClass="bg-teal-600/10 text-teal-700"
              title="6) Export the data"
              description="CSV or Excel, for analysis elsewhere."
            >
              <p>
                From the sensors page, <strong>Export</strong> opens a dialog
                where you choose stations, a date range — the window you are
                viewing, or dates you set — and the format.
              </p>
              <p>
                Exports carry the complete metric set, not just what the charts
                show: PM1.0, PM2.5, PM4.0, PM10, particle number concentrations,
                typical particle size, temperature, humidity, VOC and NOx, with
                timestamps. Optionally include device and location columns.
                Empty cells mean no reading; a zero means a measured zero.
              </p>
            </Step>

            <Step
              icon={Bell}
              iconClass="bg-amber-500/10 text-amber-700"
              title="7) Find threshold exceedances"
              description="When did the air cross a limit?"
            >
              <p>
                The alerts page searches the record for readings at or above a
                PM2.5 threshold you set — 35 µg/m³ by default — across the
                stations and period you choose.
              </p>
              <p>
                It reports history, not live notifications: it answers &ldquo;how
                often did this station exceed the limit last month?&rdquo;, and
                does not send anything or track whether an exceedance was
                acknowledged.
              </p>
            </Step>

            <Step
              icon={Activity}
              iconClass="bg-amber-500/10 text-amber-700"
              title="Tips"
              description="Quick wins for first-time use."
            >
              <p>
                &mdash; Compare a quiet residential station against one on a
                busy road to see how local the difference is.
              </p>
              <p>
                &mdash; Look at morning and evening peaks — traffic and cooking
                smoke both show up clearly.
              </p>
              <p>
                &mdash; Switch to the WHO scale to see how a reading sits
                against the international guideline rather than a national index.
              </p>
              <p>
                &mdash; Check the last-updated time before drawing conclusions.
                A station that stopped reporting hours ago is telling you about
                hours ago.
              </p>
            </Step>
          </div>
        </div>
      </div>
    </div>
  );
}
