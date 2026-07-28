"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Settings as SettingsIcon } from "lucide-react";
import { loadPreferences, updatePreferences, usePreferences } from "@/lib/preferences";
import { LanguagePreference, ThemePreference } from "@/lib/api/types";

/** Chrome-stable placeholder: same shell, loader only in the content area. */
function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sectionLabel="Settings"
      title="Application preferences"
      subtitle="Map defaults and display options"
      icon={SettingsIcon}
      mainClassName="bg-transparent"
    >
      {children}
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth
      fallback={
        <SettingsShell>
          <LoadingState
            fill
            variant="page"
            message="Loading settings"
            hint="Checking your account and preferences"
            className="h-[calc(100vh-var(--app-header-height))]"
          />
        </SettingsShell>
      }
    >
      <SettingsContent />
    </RequireAuth>
  );
}

function SettingsContent() {
  const preferences = usePreferences();

  const [zoom, setZoom] = useState<number>(
    () => loadPreferences().map?.defaultZoom ?? 12
  );
  const [lat, setLat] = useState<string>(() => {
    const loc = loadPreferences().map?.defaultLocation;
    return loc?.lat !== undefined && loc?.lat !== null ? String(loc.lat) : "";
  });
  const [lng, setLng] = useState<string>(() => {
    const loc = loadPreferences().map?.defaultLocation;
    return loc?.lng !== undefined && loc?.lng !== null ? String(loc.lng) : "";
  });
  const [showLabels, setShowLabels] = useState<boolean>(
    () => loadPreferences().map?.showStationLabels ?? true
  );
  const [saved, setSaved] = useState(false);

  const handleSaveMapSettings = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const hasLocation = lat !== "" && lng !== "" && !isNaN(parsedLat) && !isNaN(parsedLng);

    updatePreferences({
      map: {
        defaultZoom: zoom,
        defaultLocation: hasLocation ? { lat: parsedLat, lng: parsedLng } : null,
        showStationLabels: showLabels,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearLocation = () => {
    setLat("");
    setLng("");
    updatePreferences({ map: { defaultLocation: null } });
  };

  // No auth branching here: RequireAuth only mounts this once the session is
  // confirmed, so the shell renders straight to content.
  return (
    <SettingsShell>
      <div className="mx-auto max-w-4xl p-6 md:p-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>Basic application settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="language-select" className="font-medium">
                      Language
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Select your preferred language
                    </p>
                  </div>
                  <select
                    id="language-select"
                    value={preferences.language ?? "en"}
                    onChange={(e) =>
                      updatePreferences({ language: e.target.value as LanguagePreference })
                    }
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="en">English</option>
                    <option value="am">Amharic</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="theme-select" className="font-medium">
                      Theme
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred theme
                    </p>
                  </div>
                  <select
                    id="theme-select"
                    value={preferences.theme ?? "light"}
                    onChange={(e) =>
                      updatePreferences({ theme: e.target.value as ThemePreference })
                    }
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Map Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Map</CardTitle>
                <CardDescription>Configure map display settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="zoom">Default Zoom Level</Label>
                  <p className="text-sm text-muted-foreground">
                    Set the default map zoom level (1-18)
                  </p>
                  <select
                    id="zoom"
                    value={zoom}
                    onChange={(e) => setZoom(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-md bg-background w-full"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Default Location (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Set a default center location for the map. Leave empty to use default or center on stations.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lat">Latitude</Label>
                        <Input
                          id="lat"
                          type="number"
                          step="any"
                          placeholder="e.g., 9.0333"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lng">Longitude</Label>
                        <Input
                          id="lng"
                          type="number"
                          step="any"
                          placeholder="e.g., 38.7500"
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    {(lat || lng) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearLocation}
                        className="mt-2"
                      >
                        Clear Location
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <label htmlFor="show-labels" className="font-medium">
                      Show Station Labels
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Display station names on the map
                    </p>
                  </div>
                  <input
                    id="show-labels"
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 accent-primary focus:ring-ring"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button (map section) */}
            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  Settings saved!{" "}
                  <span className="text-muted-foreground">· Synced with account</span>
                </span>
              )}
              <Button onClick={handleSaveMapSettings}>Save Settings</Button>
            </div>
        </div>
      </div>
    </SettingsShell>
  );
}
