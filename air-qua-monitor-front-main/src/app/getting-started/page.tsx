"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, MapPin, Activity, ShieldCheck, Bell, LineChart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function GettingStartedPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">New users</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Getting started with Air Quality Monitor
              </h1>
              <p className="mt-2 text-slate-600">
                A quick guide to find stations, understand AQI, and track the air you breathe.
              </p>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="border-slate-200 text-slate-700"
            >
              Back to home
            </Button>
          </div>

          <div className="grid gap-5">
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 rounded-lg bg-purple-600/10 text-purple-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>1) Sign in (recommended)</CardTitle>
                    <CardDescription>Access your dashboard and get a consistent experience.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  If you’re not signed in, start with login/signup. If you’re already signed in, you can go straight to the dashboard.
                </p>
                <Button
                  onClick={() => router.push(isAuthenticated ? "/dashboard" : "/login")}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {isAuthenticated ? "Go to dashboard" : "Sign in / Sign up"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 rounded-lg bg-slate-900/10 text-slate-900">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>2) Open the live map</CardTitle>
                    <CardDescription>Choose a station close to you.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  The map shows stations across the city. Click any marker to view the latest readings and status.
                </p>
                <Button onClick={() => router.push(isAuthenticated ? "/dashboard" : "/login")} variant="outline" className="border-purple-200 text-purple-700 font-bold bg-transparent hover:bg-purple-50">
                  Open map
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 rounded-lg bg-emerald-600/10 text-emerald-700">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>3) Understand the numbers</CardTitle>
                    <CardDescription>Start with AQI, then look at the pollutants.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>
                  - <span className="font-semibold text-slate-900">AQI</span> is the quickest summary of air quality.
                </p>
                <p>
                  - <span className="font-semibold text-slate-900">PM2.5 / PM10</span> are key particle pollutants (often the biggest driver).
                </p>
                <p>
                  - <span className="font-semibold text-slate-900">Temperature / humidity</span> add context to the air conditions.
                </p>
                <p>
                  - <span className="font-semibold text-slate-900">Air quality level</span> summarizes PM2.5-based conditions (Good through Hazardous).
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 rounded-lg bg-amber-500/10 text-amber-700">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Tips</CardTitle>
                      <CardDescription>Quick wins for first-time use.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-2">
                  <p>- Compare a “Good” station vs a busy-road station to see the difference.</p>
                  <p>- Check trends at different times of day (morning and evening peaks).</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 rounded-lg bg-purple-600/10 text-purple-700">
                      <LineChart className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Next</CardTitle>
                      <CardDescription>Go deeper once you’re comfortable.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-2">
                  <p>- Explore the sensors list for device-specific details.</p>
                  <p>- Use the dashboard for a wider overview.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

