"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import dynamic from "next/dynamic";
import Image from "next/image";
import { SensorHousingVideo } from "@/components/landing/SensorHousingVideo";
import { PhotoGallery } from "@/components/landing/PhotoGallery";
import { FIELD_PHOTOS, LAB_PHOTOS } from "@/components/landing/photo-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileButton } from "@/components/ProfileButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AtmosphereBackdrop } from "@/components/AtmosphereBackdrop";
import { MapPin, Thermometer, Droplets, BarChart3, ArrowRight, Activity, Sparkles, TrendingUp, Shield, Zap, Globe, Users, ImageIcon, Cpu, Menu } from "lucide-react";
import {
  fetchPublicDashboardData,
  formatMetricValue,
  type MapStation,
} from "@/lib/utils/readings";
import { evaluateAqi } from "@/lib/utils/aqi-standards";
import { useAqiStandard } from "@/lib/preferences";
import { getPublicStats } from "@/lib/api/stats";
import type { PublicStats } from "@/lib/api/types";

import { LoadingState } from "@/components/ui/loading-state";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import("@/components/Map").then((mod) => ({ default: mod.Map })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
      <LoadingState
        fill
        variant="overlay"
        message="Loading map"
        hint="Preparing the interactive air quality map"
      />
    </div>
  ),
});

type Station = MapStation;

// Stations will be loaded from API


// Animated Counter Component
function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = 0;
    const endValue = end;
    let rafId: number | null = null;
    let cancelled = false;

    const animate = () => {
      if (cancelled) return;

      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (endValue - startValue) * easeOutQuart);

      if (current !== countRef.current) {
        countRef.current = current;
        setCount(current);
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    animate();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
}

// Fade In On Scroll Component
function FadeInOnScroll({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {children}
    </div>
  );
}

// 3D PCB viewer placeholder lives in @/components/landing/PCBViewerPlaceholder.
// It must be loaded with next/dynamic (ssr: false) when used, so three.js stays
// out of this route's first-load bundle.

function SolidworksViewerPlaceholder() {
  return (
    <div className="w-full h-full rounded-xl border border-zinc-700 overflow-hidden relative bg-black">
      {/*
        play="visible": this sits below the fold, so it must not compete with
        the hero for the same 1.4 MB file during first paint. It shows its
        poster until scrolled to, then loads and plays.
      */}
      <SensorHousingVideo play="visible" className="w-full h-full object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-xs text-zinc-100/90 bg-gradient-to-t from-black/80 to-transparent">
        SolidWorks housing preview – final integration video (placeholder)
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const standard = useAqiStandard();
  const [stationsLoading, setStationsLoading] = useState(true);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [stationsPage, setStationsPage] = useState(0);
  const [pcbSlide, setPcbSlide] = useState(0);
  const [pcbModalOpen, setPcbModalOpen] = useState(false);
  const [solidworksModalOpen, setSolidworksModalOpen] = useState(false);
  const [heroMediaMode, setHeroMediaMode] = useState<"video" | "slideshow">("video");
  const [heroMediaSlide, setHeroMediaSlide] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const heroMediaSlides = [
    { src: "/photo_2026-03-16_22-45-38.jpg", label: "PCB stack & routing" },
    { src: "/photo_2026-03-16_22-45-39.jpg", label: "Assembled PCB module" },
    { src: "/photo_2026-03-16_22-45-40.jpg", label: "PCB in enclosure" },
  ];

  // Single fetch shared by station cards and embedded map
  useEffect(() => {
    const fetchStations = async () => {
      try {
        setStationsLoading(true);
        const { stations: stationsData } = await fetchPublicDashboardData();
        setStations(stationsData);
        setStationsLoading(false);
      } catch (error) {
        console.error("Error fetching stations:", error);
        // Keep empty array on error - will show loading state
      }
    };

    fetchStations();

    // Landing counts come from the dedicated public stats endpoint rather than
    // counting a full device/location fetch.
    getPublicStats()
      .then(setPublicStats)
      .catch(() => {
        /* non-fatal: fall back to stations.length below */
      });
  }, []);

  useEffect(() => {
    if (heroMediaMode !== "slideshow") return;
    const interval = window.setInterval(() => {
      setHeroMediaSlide((prev) => (prev + 1) % heroMediaSlides.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [heroMediaMode, heroMediaSlides.length]);

  /**
   * Route by auth state — but only once that state is actually known.
   *
   * `isAuthenticated` is false both when signed out and while /auth/me is still
   * in flight, so acting on it during validation sent signed-in visitors to the
   * login page. Every CTA on this page goes through here.
   */
  const goToApp = (path: string) => {
    if (isLoading) return;
    router.push(isAuthenticated ? path : "/login");
  };

  const handleGetStarted = () => goToApp("/dashboard");

  const scrollToId = (id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative">
      {/* Atmospheric backdrop: drifting clouds, wind streams, floating particles */}
      <AtmosphereBackdrop />
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-ring bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-all duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/*
                Logo and wordmark are one link home — the convention every
                visitor already expects from a site header.

                The wordmark is a <span>, not an <h1>: it used to be a heading,
                which gave the page two, and crawlers take the first as the
                page's topic. The one <h1> lives in the hero.
              */}
              <Link
                href="/"
                aria-label="Addis Air Net — home"
                className="flex items-center gap-3 animate-fade-in rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="p-2 rounded-lg border border-ring bg-ring text-background shadow-sm">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-xl font-semibold tracking-tight text-primary">
                  Addis Air Net
                </span>
              </Link>
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToId("map")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Map
              </button>
              <button
                onClick={() => scrollToId("sensors")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Sensors
              </button>
              <button
                onClick={() => scrollToId("data")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Data
              </button>
              <button
                onClick={() => scrollToId("hardware")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Hardware
              </button>
              <button
                onClick={() => scrollToId("photos")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Photos
              </button>
              <button
                onClick={() => scrollToId("team")}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:text-accent transition-all duration-300 hover:scale-105"
              >
                Team
              </button>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard")}
                    className="hidden sm:inline-flex border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 hover:scale-105"
                  >
                    Dashboard
                  </Button>
                  <ProfileButton />
                </>
              ) : (
                <>
                  <Button
                    onClick={() => router.push("/login")}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    Login
                  </Button>
                </>
              )}
              
              {/* Mobile Navigation */}
              <div className="md:hidden flex items-center ml-1">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary hover:bg-slate-100 rounded-lg">
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Toggle mobile menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-[300px] sm:w-[360px] bg-white border-l border-slate-200 p-0 flex flex-col"
                  >
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

                    {/* Drawer header with branding */}
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                        <Activity className="h-5 w-5 text-slate-800" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">Air Quality Monitor</p>
                        <p className="text-[11px] text-slate-400 leading-tight">Addis Ababa</p>
                      </div>
                    </div>

                    {/* Navigation links */}
                    <nav className="flex-1 overflow-y-auto px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 px-2 mb-3">
                        Sections
                      </p>
                      {[
                        { id: "map",      label: "Map",      icon: Globe,      desc: "Live air quality map" },
                        { id: "sensors",  label: "Sensors",  icon: Zap,        desc: "Monitoring stations" },
                        { id: "data",     label: "Data",     icon: BarChart3,  desc: "Air quality metrics" },
                        { id: "hardware", label: "Hardware", icon: Cpu,        desc: "PCB & enclosure design" },
                        { id: "photos",   label: "Photos",   icon: ImageIcon,  desc: "Field deployment shots" },
                        { id: "team",     label: "Team",     icon: Users,      desc: "The people behind it" },
                      ].map(({ id, label, icon: Icon, desc }) => (
                        <button
                          key={id}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            // Wait for Radix sheet close animation (300ms) to finish before scrolling
                            setTimeout(() => scrollToId(id), 350);
                          }}
                          className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-left group hover:bg-slate-50 active:bg-slate-100 transition-colors mb-1"
                        >
                          <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                            <Icon className="h-4 w-4 text-slate-600 group-hover:text-slate-900 transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{label}</p>
                            <p className="text-xs text-slate-400 truncate">{desc}</p>
                          </div>
                          <ArrowRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                    </nav>

                    {/* Bottom CTA */}
                    <div className="px-4 py-5 border-t border-slate-100">
                      {isAuthenticated ? (
                        <Button
                          onClick={() => { setIsMobileMenuOpen(false); router.push("/dashboard"); }}
                          className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Go to Dashboard
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => { setIsMobileMenuOpen(false); router.push("/login"); }}
                          className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Log in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Full-width hero media (video or slideshow) */}
      <section aria-label="Product media" className="relative w-full">
        <div className="relative w-full h-[280px] sm:h-[420px] lg:h-[560px] overflow-hidden border-y border-slate-200 bg-black">
          {heroMediaMode === "video" ? (
            <SensorHousingVideo
              className="absolute inset-0 w-full h-full object-cover"
              play="eager"
              poster={false}
              onError={() => setHeroMediaMode("slideshow")}
            />
          ) : (
            <div className="absolute inset-0">
              {heroMediaSlides.map((slide, idx) => (
                <div
                  key={slide.src}
                  className="absolute inset-0 bg-center bg-cover transition-opacity duration-700"
                  style={{
                    backgroundImage: `url('${slide.src}')`,
                    opacity: idx === heroMediaSlide ? 1 : 0,
                  }}
                />
              ))}
            </div>
          )}

          {/* Soft overlays for legibility */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Hero copy overlay + controls */}
          <div className="absolute inset-0">
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-10">
              <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
                <FadeInOnScroll delay={0}>
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur border border-white/15">
                      <Sparkles className="h-4 w-4 animate-spin-slow text-white/90" />
                      <span>Real‑time air quality for real cities</span>
                    </div>

                    {/*
                      The page's single <h1>, and the strongest on-page signal
                      of what this page is about. It previously read "Air
                      quality, made visible." — evocative, but with no place
                      name in it, so it matched nothing anyone actually
                      searches. The city and country now lead; the original
                      line survives as the second clause.
                    */}
                    <h1 className="mt-4 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow">
                      <span className="block">Addis Ababa air quality,</span>
                      <span className="block text-white/95">made visible.</span>
                    </h1>

                    <p className="mt-4 text-sm sm:text-lg text-white/85 leading-relaxed">
                      Monitor air quality across{" "}
                      <span className="font-semibold text-white">Addis Ababa</span> with real‑time data from{" "}
                      <span className="font-bold text-white">
                        {stationsLoading && !publicStats ? (
                          "0"
                        ) : (
                          <>
                            <AnimatedCounter end={publicStats?.stations ?? stations.length} />{" "}
                          </>
                        )}
                      </span>{" "}
                      monitoring stations – connected from PCB to enclosure to the cloud.
                    </p>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={handleGetStarted}
                        size="lg"
                        className="shadow-2xl shadow-black/30 h-12 px-6"
                      >
                        {isAuthenticated ? "Go to Dashboard" : "Log in to Dashboard"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => goToApp("/dashboard")}
                        variant="outline"
                        size="lg"
                        className="h-12 px-6 bg-transparent hover:bg-transparent border-sky-200/80 text-sky-200 font-extrabold tracking-wide hover:text-sky-100 hover:border-sky-200"
                      >
                        Explore Map
                      </Button>
                    </div>
                  </div>
                </FadeInOnScroll>

                <div className="flex items-center gap-3 justify-start lg:justify-end">
                  <div className="inline-flex rounded-full bg-white/10 border border-white/15 backdrop-blur px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setHeroMediaMode("video")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                        heroMediaMode === "video" ? "bg-white text-slate-900" : "text-white/85 hover:text-white"
                      }`}
                    >
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroMediaMode("slideshow")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                        heroMediaMode === "slideshow" ? "bg-white text-slate-900" : "text-white/85 hover:text-white"
                      }`}
                    >
                      Slideshow
                    </button>
                  </div>

                  {heroMediaMode === "slideshow" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setHeroMediaSlide((prev) => (prev + heroMediaSlides.length - 1) % heroMediaSlides.length)
                        }
                        className="h-9 w-9 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white hover:bg-white/20 transition-colors"
                        aria-label="Previous slide"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroMediaSlide((prev) => (prev + 1) % heroMediaSlides.length)}
                        className="h-9 w-9 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white hover:bg-white/20 transition-colors"
                        aria-label="Next slide"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {heroMediaMode === "slideshow" && (
                <div className="mx-auto max-w-6xl mt-4 flex items-center justify-between gap-4">
                  <p className="text-xs text-white/75">
                    {heroMediaSlides[heroMediaSlide]?.label}{" "}
                    <span className="text-white/50">
                      ({heroMediaSlide + 1}/{heroMediaSlides.length})
                    </span>
                  </p>
                  <div className="flex gap-1.5">
                    {heroMediaSlides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setHeroMediaSlide(i)}
                        className={`h-1.5 w-6 rounded-full transition-colors ${
                          i === heroMediaSlide ? "bg-white" : "bg-white/35 hover:bg-white/70"
                        }`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* New users strip */}
      <section aria-label="New users" className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-extrabold text-primary">New users:</span>{" "}
                Sign in, open the live map, then select a station to see air quality level, PM1.0/PM2.5, temperature, and humidity.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tip: start with stations marked <span className="font-semibold text-slate-700 dark:text-slate-300">Good</span> or{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">Moderate</span> to compare trends.
              </p>
            </div>
            <Button
              onClick={() => router.push("/getting-started")}
              variant="outline"
              className="border-sky-200 text-primary font-extrabold bg-transparent hover:bg-sky-50"
            >
              New user guide
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats strip (below the media hero) */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <FadeInOnScroll>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                <AnimatedCounter end={24} suffix="/7" />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Real‑time monitoring</div>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {stationsLoading && !publicStats ? <span className="text-base">Loading…</span> : <AnimatedCounter end={publicStats?.stations ?? stations.length} />}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Monitoring stations</div>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {/*
                  Comes from /public/stats, where it is derived from the reading
                  schema — add a sensor field and this follows on its own. The
                  literal is only a fallback for a slow or older API; it was
                  hardcoded to 4 for a long time, which counted what the public
                  dashboard *displays* rather than what the network collects.
                */}
                <AnimatedCounter end={publicStats?.parameters_tracked ?? 14} />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Parameters tracked</div>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {/*
                  Data confidence is substantiated as the percentage of active stations 
                  reporting data (i.e. not 'Offline' or 'No Data'). 
                  If no stations are loaded yet, we show a loading state or default to 99%.
                */}
                {stationsLoading ? (
                  <span className="text-base">Loading…</span>
                ) : (
                  <AnimatedCounter 
                    end={stations.length > 0 
                      ? Math.round((stations.filter(s => s.lastSeenAt !== null).length / stations.length) * 100) 
                      : 99} 
                    suffix="%" 
                  />
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Data confidence</div>
            </div>
          </div>
        </FadeInOnScroll>
      </section>

      {/* Map Section */}
      <section id="map" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
        <FadeInOnScroll>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <Globe className="h-6 w-6 text-primary animate-spin-slow" />
              {/* Section headings carry the query terms, not just brand voice. */}
              <h2 className="text-4xl md:text-5xl font-bold text-primary">
                Live air quality map of Addis Ababa
              </h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
              Real-time PM2.5 and PM1.0 readings from monitoring stations across
              Addis Ababa. Click any station for its latest measurements, and
              switch between the US EPA, European EAQI, UK DAQI and WHO 2021
              air quality standards from the top-left of the map.
            </p>
            <Button
              onClick={() => goToApp("/dashboard")}
              size="lg"
              className="bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600 transition-all duration-300 hover:scale-105"
            >
              View full map
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </FadeInOnScroll>
        
        <FadeInOnScroll delay={200}>
          <div className="h-[500px] md:h-[600px] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:shadow-slate-400/20 transition-all duration-500">
            <Map stations={stations} loading={stationsLoading} />
          </div>
        </FadeInOnScroll>
      </section>

      {/* Hardware & 3D Design Section */}
      <section
        id="hardware"
        className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 border-y border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80"
      >
        <FadeInOnScroll>
          <div className="flex flex-col lg:flex-row items-start gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-accent">
                <Cpu className="h-4 w-4" />
                <span>Hardware Pipeline</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-accent">
                From PCB layout to 3D air stations.
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                We treat the hardware as seriously as the data. This section will embed live 3D
                views of your PCB and enclosure, so collaborators can spin, zoom, and inspect the
                design directly in the browser.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-700 dark:text-slate-300">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">PCB</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    KiCad / Altium board exported as 3D model and rendered via{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-100">@react-three/fiber</span>.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Mechanical</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    SolidWorks / STEP enclosure visualized with{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-100">@react-three/drei</span> for orbit and
                    lighting.
                  </p>
                </div>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Coming soon – plug actual 3D assets into these viewers.
              </p>
            </div>
            <div className="flex-1 grid grid-cols-1 gap-6">
              <FadeInOnScroll>
                <div
                  className="h-64 md:h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/5 dark:bg-slate-100/5 overflow-hidden relative cursor-pointer group"
                  onClick={() => setPcbModalOpen(true)}
                >
                  {/* PCB slideshow */}
                  <div className="w-full h-full relative">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                      style={{ backgroundImage: "url('/photo_2026-03-16_22-45-38.jpg')", opacity: pcbSlide === 0 ? 1 : 0 }}
                    />
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                      style={{ backgroundImage: "url('/photo_2026-03-16_22-45-39.jpg')", opacity: pcbSlide === 1 ? 1 : 0 }}
                    />
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                      style={{ backgroundImage: "url('/photo_2026-03-16_22-45-40.jpg')", opacity: pcbSlide === 2 ? 1 : 0 }}
                    />
                    {/* Gradient overlay for text */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-end justify-between gap-3">
                      <div className="text-xs text-white space-y-1">
                        <p className="font-semibold">
                          {pcbSlide === 0 && "PCB stack & routing"}
                          {pcbSlide === 1 && "Assembled PCB module"}
                          {pcbSlide === 2 && "PCB in enclosure"}
                        </p>
                        <p className="text-[11px] text-zinc-200/80">
                          Hardware view {pcbSlide + 1} / 3
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPcbSlide((prev) => (prev + 2) % 3)}
                          className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => setPcbSlide((prev) => (prev + 1) % 3)}
                          className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPcbSlide(i)}
                          className={`h-1.5 w-4 rounded-full transition-colors ${
                            i === pcbSlide ? "bg-emerald-400" : "bg-white/40 hover:bg-white/80"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>
              <FadeInOnScroll delay={200}>
                <div
                  className="h-64 md:h-72 cursor-pointer"
                  onClick={() => setSolidworksModalOpen(true)}
                >
                  <Suspense fallback={<div className="w-full h-full bg-slate-100 rounded-xl" />}>
                    <SolidworksViewerPlaceholder />
                  </Suspense>
                </div>
              </FadeInOnScroll>
            </div>
          </div>
        </FadeInOnScroll>
      </section>

      {/* Sensors Section */}
      <section id="sensors" className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white dark:from-slate-950 via-slate-50 dark:via-slate-900 to-white dark:to-slate-950" />
        <FadeInOnScroll>
          <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 mb-3">
                <Zap className="h-6 w-6 text-accent animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold text-accent">
                  Monitoring stations
                </h2>
              </div>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-xl">
                Live view of every station included in the KPI map – scroll through the carousel to
                see current conditions at each device.
              </p>
            </div>
            {!stationsLoading && stations.length > 0 && (
              <div className="flex items-center gap-4 self-center">
                <button
                  type="button"
                  onClick={() => setStationsPage((prev) => Math.max(prev - 1, 0))}
                  disabled={stationsPage === 0}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-900 dark:bg-slate-700 text-white text-lg font-bold shadow-md hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-900 dark:disabled:hover:bg-slate-700 transition-colors"
                  aria-label="Previous stations"
                >
                  <span className="leading-none">‹</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pageSize = 3;
                    const maxPage = Math.max(Math.ceil(stations.length / pageSize) - 1, 0);
                    setStationsPage((prev) => Math.min(prev + 1, maxPage));
                  }}
                  disabled={stations.length <= 3 || (stationsPage + 1) * 3 >= stations.length}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-900 dark:bg-slate-700 text-white text-lg font-bold shadow-md hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-900 dark:disabled:hover:bg-slate-700 transition-colors"
                  aria-label="Next stations"
                >
                  <span className="leading-none">›</span>
                </button>
              </div>
            )}
          </div>
        </FadeInOnScroll>
        
        {stationsLoading && (
          <LoadingState
            variant="inline"
            message="Loading stations"
            hint="Pulling the latest readings from all monitoring locations"
            className="py-20"
          />
        )}
        {!stationsLoading && stations.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No stations available at the moment.</p>
          </div>
        )}
        {!stationsLoading && stations.length > 0 && (
          <div className="relative">
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 transition-transform duration-500">
                {stations
                  .slice(stationsPage * 3, stationsPage * 3 + 3)
                  .map((station, index) => {
                    const aqi = evaluateAqi(standard, station.pm2_5);
                    return (
                    <FadeInOnScroll key={station.id} delay={index * 100}>
                      <Card className="border-2 border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-500 hover:-translate-y-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm group">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                                <MapPin className="h-4 w-4 text-slate-900 dark:text-slate-100 group-hover:scale-110 transition-transform" />
                              </div>
                              <CardTitle className="text-lg font-bold">{station.name}</CardTitle>
                            </div>
                            <span
                              className="px-2.5 py-1 rounded-full text-xs font-semibold border animate-pulse-subtle"
                              style={{
                                backgroundColor: `${aqi.color}1f`,
                                borderColor: `${aqi.color}59`,
                                color: aqi.color,
                              }}
                            >
                              {aqi.category?.shortLabel ?? aqi.label}
                            </span>
                          </div>
                          <CardDescription
                            className="text-sm text-slate-600 dark:text-slate-400"
                            title={`${standard.attribution} ${standard.methodology}`}
                          >
                            {standard.shortName}{" "}
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">
                              {aqi.display}
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Activity className="h-3.5 w-3.5 group-hover/item:text-slate-900 dark:group-hover/item:text-slate-100 transition-colors" />
                                <span className="text-xs">PM1.0</span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                {formatMetricValue(station.pm1_0)}{" "}
                                {station.pm1_0 !== null && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">µg/m³</span>
                                )}
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Activity className="h-3.5 w-3.5 group-hover/item:text-slate-900 dark:group-hover/item:text-slate-100 transition-colors" />
                                <span className="text-xs">PM2.5</span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                {formatMetricValue(station.pm2_5)}{" "}
                                {station.pm2_5 !== null && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">µg/m³</span>
                                )}
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Thermometer className="h-3.5 w-3.5 group-hover/item:text-slate-900 dark:group-hover/item:text-slate-100 transition-colors" />
                                <span className="text-xs">Temp</span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                {station.temperature === null
                                  ? "—"
                                  : `${formatMetricValue(station.temperature)}°C`}
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Droplets className="h-3.5 w-3.5 group-hover/item:text-slate-900 dark:group-hover/item:text-slate-100 transition-colors" />
                                <span className="text-xs">Humidity</span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                {station.humidity === null
                                  ? "—"
                                  : `${formatMetricValue(station.humidity)}%`}
                              </p>
                            </div>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-900 dark:hover:border-slate-100 hover:text-slate-900 dark:hover:text-slate-100"
                              onClick={() => goToApp(`/sensors?device=${station.deviceId}`)}
                            >
                              View sensor details
                              <ArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </FadeInOnScroll>
                    );
                  })}
              </div>
            </div>
            {stations.length > 3 && (
              <div className="mt-5 flex justify-center gap-3">
                {Array.from({ length: Math.ceil(stations.length / 3) }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStationsPage(i)}
                    className={`h-3 w-6 rounded-full border transition-colors ${
                      i === stationsPage
                        // Active dot inverts on dark so it stays distinguishable
                        // from the inactive ones against the deep-slate page.
                        ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100"
                        : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 hover:border-slate-500 dark:hover:border-slate-400"
                    }`}
                    aria-label={`Go to stations slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Data Section */}
      <section id="data" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <FadeInOnScroll>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-4xl md:text-5xl font-bold text-primary">
                Comprehensive Air Quality Data
              </h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Track multiple air quality parameters in real-time with advanced analytics and insights
            </p>
          </div>
        </FadeInOnScroll>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Activity,
              title: "Particulate Matter",
              description: "PM1.0 & PM2.5",
              content: "Fine particles that can penetrate deep into the lungs and enter the bloodstream. Monitor PM1.0 and PM2.5 levels to assess air quality risks.",
              color: "primary",
            },
            {
              icon: Thermometer,
              title: "Environmental Data",
              description: "Temperature & Humidity",
              content: "Temperature and humidity measurements help understand how environmental conditions affect air quality and pollutant dispersion.",
              color: "chart-4",
            },
            {
              icon: BarChart3,
              title: "Air Quality Index",
              description: "AQI Ratings",
              content: "Readings are reported against a published index of your choosing — US EPA, the EEA's European AQI, UK DAQI or the WHO 2021 guidelines — selectable from the map. Categories and thresholds belong to those bodies; our figures are live PM2.5 rather than the 24-hour averages they define.",
              color: "chart-3",
            },
            {
              icon: Shield,
              title: "Historical Data",
              description: "Trends & Analytics",
              content: "Access historical data and analytics to track air quality trends over time, identify patterns, and understand long-term environmental changes.",
              color: "chart-1",
            },
            {
              icon: Globe,
              title: "Live Monitoring",
              description: "Real-time KPIs",
              content: "Public dashboard shows PM1.0, PM2.5, temperature, and humidity from every active station. Sign in for full research data including PM4.0, PM10, particle number concentrations, VOC and NOx.",
              color: "chart-2",
            },
          ].map((item, index) => (
            <FadeInOnScroll key={index} delay={index * 100}>
              <Card className="border-2 border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:border-slate-900/70 dark:hover:border-slate-100/40 transition-all duration-500 hover:-translate-y-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm group">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="h-6 w-6 text-slate-900 dark:text-slate-100 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{item.title}</CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400">{item.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.content}
                  </p>
                </CardContent>
              </Card>
            </FadeInOnScroll>
          ))}
        </div>
      </section>

      {/* Photo Journey Section */}
      <section
        id="photos"
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 border-y border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80"
      >
        <FadeInOnScroll>
          {/*
            Heading above, photos full width below — not a text/photo split.
            The copy here is three lines and the gallery is tall, so side-by-side
            left half the section as empty column.
          */}
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <ImageIcon className="h-4 w-4 text-accent" />
              <span>Field Photos</span>
            </div>
            <h2 className="text-3xl font-bold text-accent md:text-4xl">
              Stations in streets, rooftops, and traffic.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Every station on the map was carried up a ladder by someone. These are the
              deployment days — mounting enclosures above the traffic they measure, bolting
              units to columns and canopies, and configuring each one before it goes up.
            </p>
          </div>
          <PhotoGallery photos={FIELD_PHOTOS} />
        </FadeInOnScroll>
      </section>

      {/* Team Section */}
      <section id="team" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <FadeInOnScroll>
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-4">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-4xl md:text-5xl font-bold text-primary">The team behind the air.</h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Highlight researchers, engineers, and partners – similar to leading air quality
              platforms that show credibility through the people involved.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Your Name",
                role: "Hardware & Systems",
                blurb: "Designs the sensing hardware, from PCB stack‑up to enclosure integration.",
                image: "",
              },
              {
                name: "Teammate Name",
                role: "Data & Software",
                blurb: "Builds the data pipeline, analytics, and dashboards that sit on top.",
                image: "/team/dev-team.png",
              },
              {
                name: "Partner / Lab",
                role: "Research Partner",
                blurb: "Validates measurements, calibrates sensors, and co‑authors insights.",
                image: LAB_PHOTOS[0]?.src ?? "",
                // The card overlays the name on the photo, so `name` makes a
                // poor alt — it describes the role, not the picture. Carry the
                // real description from the photo data instead.
                imageAlt: LAB_PHOTOS[0]?.alt,
                // Wide bench shot squared off: bias upward to keep the work on
                // the table in frame rather than the floor.
                imageFocus: "center 35%",
              },
            ].map((member, idx) => (
              <FadeInOnScroll key={member.name} delay={idx * 100}>
                <div className="group relative h-full rounded-2xl bg-gradient-to-br from-emerald-200 via-slate-200 to-sky-200 p-px transition-all duration-500 hover:-translate-y-1.5 hover:from-emerald-400 hover:via-teal-300 hover:to-sky-400 hover:shadow-[0_24px_48px_-16px_rgba(16,185,129,0.35)]">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1rem-1px)] bg-white dark:bg-slate-900">
                    <div className="pointer-events-none absolute -right-16 -top-16 z-10 h-40 w-40 rounded-full bg-emerald-200/50 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    {member.image ? (
                      <div className="relative aspect-square w-full overflow-hidden">
                        {/*
                          next/image so this 2 MB PNG is resized and served as
                          AVIF/WebP at the size the card actually renders, rather
                          than shipped whole. `fill` + the parent's aspect-square
                          keeps the original object-cover framing.
                        */}
                        <Image
                          src={member.image}
                          alt={member.imageAlt ?? member.name}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          style={{ objectPosition: member.imageFocus ?? "center" }}
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-5">
                          <p className="text-lg font-semibold text-white">{member.name}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-emerald-300">
                            {member.role}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 dark:from-emerald-950 via-white dark:via-slate-900 to-sky-50 dark:to-sky-950">
                        <div className="absolute h-40 w-40 rounded-full border border-emerald-200/80 transition-transform duration-700 group-hover:scale-125" />
                        <div className="absolute h-56 w-56 rounded-full border border-emerald-100/70 transition-transform duration-700 group-hover:scale-110" />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white shadow-lg shadow-emerald-500/40 ring-4 ring-white dark:ring-slate-900 transition-transform duration-500 group-hover:scale-110">
                          {member.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join("") || "AQ"}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-5">
                          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-emerald-600">
                            {member.role}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="flex-1 p-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{member.blurb}</p>
                  </div>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </FadeInOnScroll>
      </section>

      {/* PCB fullscreen viewer */}
      {pcbModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-4">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => setPcbModalOpen(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center text-sm hover:bg-black"
            >
              ✕
            </button>
            <div className="w-full h-full relative">
              <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                style={{ backgroundImage: "url('/photo_2026-03-16_22-45-38.jpg')", opacity: pcbSlide === 0 ? 1 : 0 }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                style={{ backgroundImage: "url('/photo_2026-03-16_22-45-39.jpg')", opacity: pcbSlide === 1 ? 1 : 0 }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
                style={{ backgroundImage: "url('/photo_2026-03-16_22-45-40.jpg')", opacity: pcbSlide === 2 ? 1 : 0 }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-end justify-between gap-3">
                <div className="text-sm text-white space-y-1">
                  <p className="font-semibold">
                    {pcbSlide === 0 && "PCB stack & routing"}
                    {pcbSlide === 1 && "Assembled PCB module"}
                    {pcbSlide === 2 && "PCB in enclosure"}
                  </p>
                  <p className="text-xs text-zinc-200/80">Click arrows or dots to browse views.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full bg-black/70 border-white/40 text-white hover:bg-black"
                    onClick={() => setPcbSlide((prev) => (prev + 2) % 3)}
                  >
                    ‹
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full bg-black/70 border-white/40 text-white hover:bg-black"
                    onClick={() => setPcbSlide((prev) => (prev + 1) % 3)}
                  >
                    ›
                  </Button>
                </div>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPcbSlide(i)}
                    className={`h-2 w-6 rounded-full transition-colors ${
                      i === pcbSlide ? "bg-emerald-400" : "bg-white/40 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SolidWorks fullscreen viewer */}
      {solidworksModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-4">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => setSolidworksModalOpen(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center text-sm hover:bg-black"
            >
              ✕
            </button>
            {/* Opened deliberately by the user, and by now the file is cached. */}
            <SensorHousingVideo
              className="w-full h-full object-contain bg-black"
              play="eager"
              controls
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FadeInOnScroll>
              <div>
                <Link
                  href="/"
                  aria-label="Addis Air Net — home"
                  className="flex items-center gap-3 mb-4 w-fit rounded-lg transition-opacity hover:opacity-80"
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <Activity className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Addis Air Net</h3>
                </Link>
                <p className="text-slate-600 dark:text-slate-400">
                  Real-time air quality monitoring for a cleaner and healthier Addis Ababa. Empowering
                  citizens, planners, and researchers with transparent data.
                </p>
              </div>
            </FadeInOnScroll>
            <FadeInOnScroll delay={100}>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Quick Links</h4>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  <li>
                    <button
                      onClick={() => scrollToId("map")}
                      className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
                    >
                      Map
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => scrollToId("sensors")}
                      className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
                    >
                      Sensors
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => scrollToId("data")}
                      className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
                    >
                      Data
                    </button>
                  </li>
                  <li>
                    <a href="/getting-started" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                      Getting started
                    </a>
                  </li>
                  <li>
                    <a href="/dashboard" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                      Dashboard
                    </a>
                  </li>
                </ul>
              </div>
            </FadeInOnScroll>
            <FadeInOnScroll delay={200}>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Partners</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Addis Ababa University
                  <br />
                  C40 Cities
                  <br />
                  <span className="text-sm opacity-75">Environmental Protection Agency</span>
                </p>
              </div>
            </FadeInOnScroll>
          </div>
          <FadeInOnScroll delay={300}>
            <div className="border-t border-slate-200 dark:border-slate-800 mt-8 pt-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              <p>&copy; 2026 Addis Air Net.</p>
            </div>
          </FadeInOnScroll>
        </div>
      </footer>

      <style jsx>{`
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 1s ease-out;
        }
        .animate-slide-in-right {
          animation: slide-in-right 1s ease-out 0.2s both;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        /* Atmospheric hero layers (clouds, wind streams, particles) live in
           @/components/AtmosphereBackdrop — the old animated grid was replaced. */
      `}</style>
    </div>
  );
}
