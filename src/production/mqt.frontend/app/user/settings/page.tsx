"use client";

import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import Navbar from "@/components/navbar/Navbar";
import { LocationInput } from "@/components/weather/LocationInput";
import { weatherService } from "@/services/api/weatherService";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const { user, isLoading } = useRequireAuth("user");
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(true);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>("");

  useEffect(() => {
    if (!isLoading && user) {
      checkLocation();
    }
  }, [isLoading, user]);

  const checkLocation = async () => {
    try {
      setIsCheckingLocation(true);
      const profile = await weatherService.getProfile();
      if (profile && profile.latitude !== null && profile.latitude !== undefined && 
          profile.longitude !== null && profile.longitude !== undefined) {
        setHasLocation(true);
      } else {
        setHasLocation(false);
      }
    } catch (err) {
      console.error("Error checking location:", err);
      setError("Failed to check location status");
      setHasLocation(false);
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const handleLocationSubmit = async (latitude: number, longitude: number, name: string) => {
    try {
      setIsUpdatingLocation(true);
      setError(null);
      setSuccess(null);
      await weatherService.updateLocation({ latitude, longitude });
      setLocationName(name);
      setHasLocation(true);
      setSuccess("Location updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating location:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to update location";
      setError(errorMessage);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  if (isLoading || isCheckingLocation) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
          <p className="text-white/60 font-light">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-light tracking-tight mb-2">
              Settings
            </h1>
            <p className="text-white/60 font-light text-sm">
              Manage your account settings and preferences
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 border border-red-500/20 bg-red-500/10 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm text-red-400 font-light">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 border border-green-500/20 bg-green-500/10 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <p className="text-sm text-green-400 font-light">{success}</p>
            </div>
          )}

          {/* Location Settings */}
          <div className="border border-white/10 rounded-lg p-8 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm">
            <h2 className="text-2xl font-light mb-4">Location Settings</h2>
            <p className="text-white/60 font-light text-sm mb-6">
              {hasLocation
                ? `Current location: ${locationName || "Location set"}. Update your location below.`
                : "Set your location to enable weather features and accurate sensor mapping."}
            </p>
            <LocationInput
              onLocationSubmit={handleLocationSubmit}
              isLoading={isUpdatingLocation}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

