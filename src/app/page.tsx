"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileButton } from "@/components/ProfileButton";
import { MapPin, Thermometer, Droplets, BarChart3, ArrowRight, Activity, Sparkles, TrendingUp, Shield, Zap, Globe, Users, ImageIcon, Cpu } from "lucide-react";
import {
  fetchPublicDashboardData,
  getAirQualityLevelBadgeClass,
  type MapStation,
} from "@/lib/utils/readings";
import { WeatherMark } from "@/components/WeatherMark";
import { LoadingState } from "@/components/ui/loading-state";

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

interface Station extends MapStation {}

// Stations will be loaded from API

// Status badge colors from backend air_quality_level
const getStatusColor = (status: string) => {
  const badge = getAirQualityLevelBadgeClass(status);
  const colorMap: Record<string, string> = {
    "text-green-600 bg-green-50": "bg-green-100 text-green-800 border-green-300",
    "text-yellow-600 bg-yellow-50": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "text-orange-600 bg-orange-50": "bg-orange-100 text-orange-800 border-orange-300",
    "text-red-600 bg-red-50": "bg-red-100 text-red-800 border-red-300",
    "text-purple-600 bg-purple-50": "bg-purple-100 text-purple-800 border-purple-300",
    "text-purple-800 bg-purple-100": "bg-purple-200 text-purple-900 border-purple-400",
  };
  return colorMap[badge] ?? "bg-gray-100 text-gray-800 border-gray-300";
};

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

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
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
      <video
        src="/Sensor%20housing%20Final.mp4"
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        poster="/photo_2026-03-16_22-45-40.jpg"
      />
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
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsPage, setStationsPage] = useState(0);
  const [pcbSlide, setPcbSlide] = useState(0);
  const [pcbModalOpen, setPcbModalOpen] = useState(false);
  const [solidworksModalOpen, setSolidworksModalOpen] = useState(false);
  const [heroMediaMode, setHeroMediaMode] = useState<"video" | "slideshow">("video");
  const [heroMediaSlide, setHeroMediaSlide] = useState(0);

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
      } catch (error) {
        console.error("Error fetching stations:", error);
        // Keep empty array on error - will show loading state
      } finally {
        setStationsLoading(false);
      }
    };

    fetchStations();
  }, []);

  useEffect(() => {
    if (heroMediaMode !== "slideshow") return;
    const interval = window.setInterval(() => {
      setHeroMediaSlide((prev) => (prev + 1) % heroMediaSlides.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [heroMediaMode, heroMediaSlides.length]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  const scrollToId = (id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative">
      {/* Light gray grid background */}
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-ring bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-all duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3 animate-fade-in">
                <div className="p-2 rounded-lg border border-ring bg-ring text-background shadow-sm">
                  <Activity className="h-5 w-5" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-primary">
                  Air Quality Monitor
                </h1>
              </div>
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
                  <Button
                    variant="outline"
                    onClick={() => router.push("/login")}
                    className="hidden sm:inline-flex border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 hover:scale-105"
                  >
                    Dashboard
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Full-width hero media (video or slideshow) */}
      <section aria-label="Product media" className="relative w-full">
        <div className="relative w-full h-[280px] sm:h-[420px] lg:h-[560px] overflow-hidden border-y border-slate-200 bg-black">
          {heroMediaMode === "video" ? (
            <video
              src="/Sensor%20housing%20Final.mp4"
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
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

                    <h1 className="mt-4 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow">
                      <span className="block">Air quality,</span>
                      <span className="block text-white/95">made visible.</span>
                    </h1>

                    <p className="mt-4 text-sm sm:text-lg text-white/85 leading-relaxed">
                      Monitor air quality across{" "}
                      <span className="font-semibold text-white">Addis Ababa</span> with real‑time data from{" "}
                      <span className="font-bold text-white">
                        {stationsLoading ? (
                          "0+"
                        ) : (
                          <>
                            <AnimatedCounter end={stations.length} suffix="+" />{" "}
                          </>
                        )}
                      </span>{" "}
                      monitoring stations – connected from PCB to enclosure to the cloud.
                    </p>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={handleGetStarted}
                        size="lg"
                        className="bg-purple-600 text-white hover:bg-purple-700 shadow-2xl shadow-black/30 h-12 px-6"
                      >
                        Get started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          if (isAuthenticated) {
                            router.push("/dashboard");
                          } else {
                            router.push("/login");
                          }
                        }}
                        variant="outline"
                        size="lg"
                        className="h-12 px-6 bg-transparent hover:bg-transparent border-purple-200/80 text-purple-200 font-extrabold tracking-wide hover:text-purple-100 hover:border-purple-200"
                      >
                        View dashboard
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
      <section aria-label="New users" className="w-full border-b border-slate-200 bg-white/90">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-700">
                <span className="font-extrabold text-purple-700">New users:</span>{" "}
                Sign in, open the live map, then select a station to see air quality level, PM2.5/PM10, temperature, and humidity.
              </p>
              <p className="text-xs text-slate-500">
                Tip: start with stations marked <span className="font-semibold text-slate-700">Good</span> or{" "}
                <span className="font-semibold text-slate-700">Moderate</span> to compare trends.
              </p>
            </div>
            <Button
              onClick={() => router.push("/getting-started")}
              variant="outline"
              className="border-purple-200 text-purple-700 font-extrabold bg-transparent hover:bg-purple-50"
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
            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-900/70 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                <AnimatedCounter end={24} suffix="/7" />
              </div>
              <div className="text-xs text-slate-500">Real‑time monitoring</div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-900/70 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                {stationsLoading ? <span className="text-base">Loading…</span> : <AnimatedCounter end={stations.length} suffix="+" />}
              </div>
              <div className="text-xs text-slate-500">Monitoring stations</div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-900/70 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                <AnimatedCounter end={4} />
              </div>
              <div className="text-xs text-slate-500">Parameters tracked</div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-900/70 transition-all duration-300 hover:shadow-lg">
              <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                <AnimatedCounter end={99} suffix="%" />
              </div>
              <div className="text-xs text-slate-500">Data confidence</div>
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
              <h2 className="text-4xl md:text-5xl font-bold text-primary">
                Interactive Air Quality Map
              </h2>
            </div>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
              Explore real-time air quality data from monitoring stations across the city. 
              Click on any marker to view detailed readings.
            </p>
            <Button
              onClick={() => {
                if (isAuthenticated) {
                  router.push("/dashboard");
                } else {
                  router.push("/login");
                }
              }}
              size="lg"
              className="bg-slate-900 text-white hover:bg-slate-800 transition-all duration-300 hover:scale-105"
            >
              View full map
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </FadeInOnScroll>
        
        <FadeInOnScroll delay={200}>
          <div className="h-[500px] md:h-[600px] rounded-xl shadow-2xl border border-slate-200 bg-slate-50 hover:shadow-slate-400/20 transition-all duration-500">
            <Map stations={stations} loading={stationsLoading} />
          </div>
        </FadeInOnScroll>
      </section>

      {/* Hardware & 3D Design Section */}
      <section
        id="hardware"
        className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 border-y border-slate-200/90 bg-white/80"
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
              <p className="text-lg text-slate-600 leading-relaxed">
                We treat the hardware as seriously as the data. This section will embed live 3D
                views of your PCB and enclosure, so collaborators can spin, zoom, and inspect the
                design directly in the browser.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-700">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">PCB</p>
                  <p className="text-slate-500">
                    KiCad / Altium board exported as 3D model and rendered via{" "}
                    <span className="font-mono text-slate-900">@react-three/fiber</span>.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">Mechanical</p>
                  <p className="text-slate-500">
                    SolidWorks / STEP enclosure visualized with{" "}
                    <span className="font-mono text-slate-900">@react-three/drei</span> for orbit and
                    lighting.
                  </p>
                </div>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Coming soon – plug actual 3D assets into these viewers.
              </p>
            </div>
            <div className="flex-1 grid grid-cols-1 gap-6">
              <FadeInOnScroll>
                <div
                  className="h-64 md:h-72 rounded-xl border border-slate-200 bg-slate-900/5 overflow-hidden relative cursor-pointer group"
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-slate-50 to-white" />
        <FadeInOnScroll>
          <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 mb-3">
                <Zap className="h-6 w-6 text-accent animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold text-accent">
                  Monitoring stations
                </h2>
              </div>
              <p className="text-sm md:text-base text-slate-600 max-w-xl">
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
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-900 text-white text-lg font-bold shadow-md hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition-colors"
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
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-900 text-white text-lg font-bold shadow-md hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition-colors"
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
                  .map((station, index) => (
                    <FadeInOnScroll key={station.id} delay={index * 100}>
                      <Card className="border-2 border-slate-200 hover:shadow-2xl hover:border-slate-900/70 transition-all duration-500 hover:-translate-y-2 bg-white/90 backdrop-blur-sm group">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-slate-200 transition-colors">
                                <MapPin className="h-4 w-4 text-slate-900 group-hover:scale-110 transition-transform" />
                              </div>
                              <CardTitle className="text-lg font-bold">{station.name}</CardTitle>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                                station.status
                              )} animate-pulse-subtle`}
                            >
                              {station.status}
                            </span>
                          </div>
                          <CardDescription className="text-sm text-slate-600">
                            Air quality:{" "}
                            <span className="font-semibold text-slate-900">
                              {station.airQualityLevel}
                            </span>
                            {" · "}
                            AQI{" "}
                            <span className="font-semibold text-slate-900 text-lg">
                              {station.aqi}
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Activity className="h-3.5 w-3.5 group-hover/item:text-slate-900 transition-colors" />
                                <span className="text-xs">PM2.5</span>
                              </div>
                              <p className="font-bold text-slate-900 text-base">
                                {station.pm2_5.toFixed(1)}{" "}
                                <span className="text-xs text-slate-500 font-normal">µg/m³</span>
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Activity className="h-3.5 w-3.5 group-hover/item:text-slate-900 transition-colors" />
                                <span className="text-xs">PM10</span>
                              </div>
                              <p className="font-bold text-slate-900 text-base">
                                {station.pm10_0.toFixed(1)}{" "}
                                <span className="text-xs text-slate-500 font-normal">µg/m³</span>
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Thermometer className="h-3.5 w-3.5 group-hover/item:text-slate-900 transition-colors" />
                                <span className="text-xs">Temp</span>
                              </div>
                              <p className="font-bold text-slate-900 text-base">
                                {station.temperature.toFixed(1)}°C
                              </p>
                            </div>
                            <div className="space-y-1 group/item">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Droplets className="h-3.5 w-3.5 group-hover/item:text-slate-900 transition-colors" />
                                <span className="text-xs">Humidity</span>
                              </div>
                              <p className="font-bold text-slate-900 text-base">
                                {station.humidity.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-900"
                              onClick={() => {
                                if (isAuthenticated) {
                                  router.push(`/sensors?device=${station.deviceId}`);
                                } else {
                                  router.push("/login");
                                }
                              }}
                            >
                              View sensor details
                              <ArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </FadeInOnScroll>
                  ))}
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
                        ? "bg-slate-900 border-slate-900"
                        : "bg-slate-200 border-slate-300 hover:bg-slate-400 hover:border-slate-500"
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
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Track multiple air quality parameters in real-time with advanced analytics and insights
            </p>
          </div>
        </FadeInOnScroll>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Activity,
              title: "Particulate Matter",
              description: "PM2.5 & PM10",
              content: "Fine particles that can penetrate deep into the lungs and enter the bloodstream. Monitor PM2.5 and PM10 levels to assess air quality risks.",
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
              content: "The AQI provides a standardized way to understand air quality levels, from Good to Hazardous, helping you make informed decisions.",
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
              content: "Public dashboard shows PM2.5, PM10, temperature, and humidity from every active station. Sign in for full research data including VOC and NOx.",
              color: "chart-2",
            },
          ].map((item, index) => (
            <FadeInOnScroll key={index} delay={index * 100}>
              <Card className="border-2 border-slate-200 hover:shadow-2xl hover:border-slate-900/70 transition-all duration-500 hover:-translate-y-2 bg-white/90 backdrop-blur-sm group">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="h-6 w-6 text-slate-900 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900">{item.title}</CardTitle>
                      <CardDescription className="text-slate-500">{item.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed">
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
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 border-y border-slate-200/90 bg-white/80"
      >
        <FadeInOnScroll>
          <div className="flex flex-col lg:flex-row items-start gap-10">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-accent">
                <ImageIcon className="h-4 w-4 text-accent" />
                <span>Field Photos</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-accent">
                Stations in streets, rooftops, and traffic.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Use this area as a visual story: deployment days, installation details, calibration
                work, and the people around the stations. It mirrors what other mature air quality
                platforms show – not just charts, but how the hardware lives in the real world.
              </p>
              <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                <li>Close‑ups of the PCB and sensor modules.</li>
                <li>Photos of stations on lamp posts and buildings.</li>
                <li>City‑scale shots that connect context to data.</li>
              </ul>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="aspect-[4/3] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-3 text-xs text-slate-500">
                Deployment photo
              </div>
              <div className="aspect-[4/3] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-3 text-xs text-slate-500">
                Enclosure detail shot
              </div>
              <div className="aspect-[4/3] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-3 text-xs text-slate-500">
                City‑scale street scene
              </div>
              <div className="aspect-[4/3] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-3 text-xs text-slate-500">
                Lab / calibration setup
              </div>
            </div>
          </div>
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
            <p className="text-lg text-slate-600">
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
                image: "",
              },
            ].map((member, idx) => (
              <FadeInOnScroll key={member.name} delay={idx * 100}>
                <div className="group relative h-full rounded-2xl bg-gradient-to-br from-emerald-200 via-slate-200 to-sky-200 p-px transition-all duration-500 hover:-translate-y-1.5 hover:from-emerald-400 hover:via-teal-300 hover:to-sky-400 hover:shadow-[0_24px_48px_-16px_rgba(16,185,129,0.35)]">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1rem-1px)] bg-white">
                    <div className="pointer-events-none absolute -right-16 -top-16 z-10 h-40 w-40 rounded-full bg-emerald-200/50 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    {member.image ? (
                      <div className="relative overflow-hidden">
                        <img
                          src={member.image}
                          alt={member.name}
                          className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
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
                      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
                        <div className="absolute h-40 w-40 rounded-full border border-emerald-200/80 transition-transform duration-700 group-hover:scale-125" />
                        <div className="absolute h-56 w-56 rounded-full border border-emerald-100/70 transition-transform duration-700 group-hover:scale-110" />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white shadow-lg shadow-emerald-500/40 ring-4 ring-white transition-transform duration-500 group-hover:scale-110">
                          {member.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join("") || "AQ"}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-5">
                          <p className="text-lg font-semibold text-slate-900">{member.name}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-emerald-600">
                            {member.role}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="flex-1 p-5 text-sm leading-relaxed text-slate-600">{member.blurb}</p>
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
            <video
              src="/Sensor%20housing%20Final.mp4"
              className="w-full h-full object-contain bg-black"
              autoPlay
              loop
              muted
              playsInline
              controls
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FadeInOnScroll>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                    <Activity className="h-5 w-5 text-slate-900" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Air Quality Monitor</h3>
                </div>
                <p className="text-slate-600">
                  Real-time air quality monitoring for a cleaner and healthier Addis Ababa. Empowering
                  citizens, planners, and researchers with transparent data.
                </p>
              </div>
            </FadeInOnScroll>
            <FadeInOnScroll delay={100}>
              <div>
                <h4 className="font-semibold text-slate-900 mb-4">Quick Links</h4>
                <ul className="space-y-2 text-slate-600">
                  <li>
                    <button
                      onClick={() => scrollToId("map")}
                      className="hover:text-slate-900 transition-colors text-left"
                    >
                      Map
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => scrollToId("sensors")}
                      className="hover:text-slate-900 transition-colors text-left"
                    >
                      Sensors
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => scrollToId("data")}
                      className="hover:text-slate-900 transition-colors text-left"
                    >
                      Data
                    </button>
                  </li>
                  <li>
                    <a href="/dashboard" className="hover:text-slate-900 transition-colors">
                      Dashboard
                    </a>
                  </li>
                </ul>
              </div>
            </FadeInOnScroll>
            <FadeInOnScroll delay={200}>
              <div>
                <h4 className="font-semibold text-slate-900 mb-4">Partners</h4>
                <p className="text-slate-600">
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
            <div className="border-t border-slate-200 mt-8 pt-8 text-center text-slate-500 text-xs">
              <p>&copy; 2024 Air Quality Monitor. Inspired by leading urban air-quality platforms.</p>
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
        /* Animated hero background: modern net + slow glow */
        .hero-net {
          /* Primary orthogonal green grid */
          background-image:
            linear-gradient(
              to right,
              rgba(22, 163, 74, 0.22) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(22, 163, 74, 0.22) 1px,
              transparent 1px
            ),
            /* Subtle diagonal purple grid overlay for depth */
            linear-gradient(
              135deg,
              rgba(147, 51, 234, 0.12) 1px,
              transparent 1px
            );
          background-size: 40px 40px, 40px 40px, 80px 80px;
          background-position: 0 0, 0 0, 0 0;
          animation: net-drift 18s linear infinite;
        }
        .hero-glow {
          background:
            radial-gradient(circle at 10% 0%, rgba(22, 163, 74, 0.22), transparent 60%),
            radial-gradient(circle at 90% 20%, rgba(147, 51, 234, 0.2), transparent 65%),
            radial-gradient(circle at 40% 100%, rgba(124, 45, 18, 0.12), transparent 70%);
          animation: glow-pulse 22s ease-in-out infinite alternate;
        }
        @keyframes net-drift {
          0% {
            background-position: 0px 0px, 0px 0px;
          }
          50% {
            background-position: 20px 10px, 10px 20px;
          }
          100% {
            background-position: 40px 0px, 0px 40px;
          }
        }
        @keyframes glow-pulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1.08);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
