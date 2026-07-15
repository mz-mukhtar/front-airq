"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Settings as SettingsIcon } from "lucide-react";

interface MapSettings {
  defaultZoom: number;
  defaultLocation: {
    lat: number | null;
    lng: number | null;
  } | null;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [mapSettings, setMapSettings] = useState<MapSettings>({
    defaultZoom: 12,
    defaultLocation: null,
  });
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("mapSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMapSettings(settings);
      if (settings.defaultLocation) {
        setLat(settings.defaultLocation.lat?.toString() || "");
        setLng(settings.defaultLocation.lng?.toString() || "");
      }
    }
  }, []);

  const handleSave = () => {
    const settings: MapSettings = {
      defaultZoom: mapSettings.defaultZoom,
      defaultLocation: lat && lng
        ? {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
          }
        : null,
    };
    
    localStorage.setItem("mapSettings", JSON.stringify(settings));
    setMapSettings(settings);
    setSaved(true);
    
    // Dispatch custom event to notify map component
    window.dispatchEvent(new Event("mapSettingsChanged"));
    
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearLocation = () => {
    setLat("");
    setLng("");
    const settings: MapSettings = {
      ...mapSettings,
      defaultLocation: null,
    };
    localStorage.setItem("mapSettings", JSON.stringify(settings));
    setMapSettings(settings);
    
    // Dispatch custom event to notify map component
    window.dispatchEvent(new Event("mapSettingsChanged"));
  };

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <AppShell
      sectionLabel="Settings"
      title="Application preferences"
      subtitle="Map defaults and display options"
      icon={SettingsIcon}
      mainClassName="bg-transparent"
    >
      {isLoading ? (
        <LoadingState
          fill
          variant="page"
          message="Loading settings"
          hint="Checking your account and preferences"
          className="h-[calc(100vh-3.75rem)]"
        />
      ) : (
        <div className="mx-auto max-w-4xl p-6 md:p-8">
          <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>
                Basic application settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred language
                  </p>
                </div>
                <select className="px-3 py-2 border rounded-md bg-background">
                  <option>English</option>
                  <option>Amharic</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred theme
                  </p>
                </div>
                <select className="px-3 py-2 border rounded-md bg-background">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>System</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Map Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>
                Configure map display settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="zoom">Default Zoom Level</Label>
                <p className="text-sm text-muted-foreground">
                  Set the default map zoom level (1-18)
                </p>
                <select
                  id="zoom"
                  value={mapSettings.defaultZoom}
                  onChange={(e) => setMapSettings({ ...mapSettings, defaultZoom: parseInt(e.target.value) })}
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
                  <p className="font-medium">Show Station Labels</p>
                  <p className="text-sm text-muted-foreground">
                    Display station names on the map
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 rounded border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            {saved && (
              <span className="text-sm text-green-600 flex items-center">Settings saved!</span>
            )}
            <Button 
              onClick={handleSave}
              className="bg-[#016FC4] hover:bg-[#0159a0] text-white"
            >
              Save Settings
            </Button>
          </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

