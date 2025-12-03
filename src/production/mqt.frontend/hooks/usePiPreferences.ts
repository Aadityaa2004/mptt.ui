import { useState, useEffect, useCallback } from "react";
import { deviceLocationService } from "@/services/api/deviceLocationService";
import { tailwindToHex, hexToTailwind, getMostCommonColor } from "@/lib/colorUtils";

export interface PiPreference {
  pi_id: string;
  gradient: string; // Gradient string format: "from-blue-500 to-purple-500"
}

const STORAGE_KEY = "pi_marker_preferences";

// Default gradient combinations (no blue - blue is reserved for current location marker)
const DEFAULT_GRADIENTS = [
  "from-orange-500 to-red-500",
  "from-green-500 to-emerald-500",
  "from-purple-500 to-pink-500",
  "from-red-500 to-orange-500",
  "from-yellow-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-purple-500",
  "from-teal-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-green-500",
];

export function usePiPreferences() {
  const [preferences, setPreferences] = useState<Record<string, PiPreference>>({});
  const [isLoadingFromBackend, setIsLoadingFromBackend] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate and clean preferences (ensure no null/undefined gradients)
        const cleaned: Record<string, PiPreference> = {};
        Object.entries(parsed).forEach(([pi_id, pref]: [string, any]) => {
          if (pref && typeof pref === 'object') {
            // Handle migration from old format (color/shape) to new format (gradient)
            let gradient = pref.gradient;
            if (!gradient && pref.color) {
              // Migrate old single color to gradient
              gradient = `from-${pref.color} to-${pref.color.replace("500", "600")}`;
            }
            cleaned[pi_id] = {
              pi_id: pi_id,
              gradient: gradient || DEFAULT_GRADIENTS[0],
            };
          }
        });
        setPreferences(cleaned);
      }
    } catch (error) {
      console.error("Error loading PI preferences:", error);
      // Clear corrupted localStorage data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore errors when clearing
      }
    }
  }, []);

  // Load colors from backend device locations
  const loadColorsFromBackend = useCallback(async () => {
    try {
      setIsLoadingFromBackend(true);
      const locations = await deviceLocationService.getAllLocations();
      
      // Group locations by PI and get most common color for each PI
      const piColorMap: Record<string, string[]> = {};
      const piSet = new Set<string>(); // Track all PIs found in locations
      
      locations.forEach(location => {
        piSet.add(location.pi_id);
        if (location.color) {
          if (!piColorMap[location.pi_id]) {
            piColorMap[location.pi_id] = [];
          }
          piColorMap[location.pi_id].push(location.color);
        }
      });

      // Update preferences with colors from backend
      setPreferences(currentPreferences => {
        const updated = { ...currentPreferences };
        let hasChanges = false;

        // Process PIs that have colors in backend
        Object.entries(piColorMap).forEach(([pi_id, colors]) => {
          const mostCommonHex = getMostCommonColor(colors);
          if (mostCommonHex) {
            const tailwindColor = hexToTailwind(mostCommonHex);
            const currentPref = updated[pi_id];
            // Create gradient from single color
            const gradient = `from-${tailwindColor} to-${tailwindColor.replace("500", "600")}`;
            
            // Only update if gradient changed or preference doesn't exist
            if (!currentPref || currentPref.gradient !== gradient) {
              hasChanges = true;
              updated[pi_id] = {
                pi_id,
                gradient: gradient,
              };
            }
          }
        });

        // Ensure all PIs have preferences (assign defaults for PIs without colors)
        piSet.forEach((pi_id, index) => {
          if (!updated[pi_id]) {
            hasChanges = true;
            const gradientIndex = index % DEFAULT_GRADIENTS.length;
            updated[pi_id] = {
              pi_id,
              gradient: DEFAULT_GRADIENTS[gradientIndex],
            };
          } else if (!updated[pi_id].gradient) {
            // If preference exists but has no gradient, assign default
            hasChanges = true;
            const gradientIndex = index % DEFAULT_GRADIENTS.length;
            updated[pi_id] = {
              ...updated[pi_id],
              gradient: DEFAULT_GRADIENTS[gradientIndex],
            };
          }
        });

        if (hasChanges) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch (error) {
            console.error("Error saving preferences to localStorage:", error);
          }
        }

        return updated;
      });
    } catch (error) {
      console.error("Error loading colors from backend:", error);
      // Don't throw - fall back to localStorage preferences
    } finally {
      setIsLoadingFromBackend(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: Record<string, PiPreference>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.error("Error saving PI preferences:", error);
    }
  }, []);

  // Get preference for a specific PI, with auto-assignment if not exists
  const getPreference = useCallback(
    (pi_id: string, index: number = 0): PiPreference => {
      const existing = preferences[pi_id];
      
      // If preference exists and has valid gradient, return it
      if (existing?.gradient) {
        return existing;
      }

      // Auto-assign based on index (for new PIs or invalid preferences)
      const gradientIndex = index % DEFAULT_GRADIENTS.length;
      
      const defaultPreference: PiPreference = {
        pi_id,
        gradient: DEFAULT_GRADIENTS[gradientIndex],
      };

      // If preference exists but is missing gradient, merge with defaults
      if (existing) {
        return {
          ...defaultPreference,
          ...existing,
          gradient: existing.gradient || defaultPreference.gradient,
        };
      }

      return defaultPreference;
    },
    [preferences]
  );

  // Update preference for a specific PI
  const updatePreference = useCallback(
    async (pi_id: string, updates: Partial<Omit<PiPreference, "pi_id">>) => {
      const current = preferences[pi_id] || getPreference(pi_id);
      
      // Ensure gradient is always valid (use defaults if null/undefined)
      const safeUpdates: Partial<Omit<PiPreference, "pi_id">> = {
        ...updates,
        gradient: updates.gradient || current.gradient || DEFAULT_GRADIENTS[0],
      };
      
      const updated = { ...preferences, [pi_id]: { ...current, ...safeUpdates } };
      
      // Save to localStorage immediately
      savePreferences(updated);

      // If gradient is being updated, sync primary color to backend
      if (safeUpdates.gradient) {
        try {
          // Extract primary color from gradient (from-{color})
          const primaryColor = safeUpdates.gradient.match(/from-([a-z]+-\d+)/)?.[1];
          if (primaryColor) {
            const hexColor = tailwindToHex(primaryColor);
            await deviceLocationService.updatePiColor(pi_id, hexColor);
          }
        } catch (error) {
          console.error(`Error syncing color to backend for PI ${pi_id}:`, error);
          // Don't throw - localStorage is already updated, backend sync can retry later
        }
      }
    },
    [preferences, getPreference, savePreferences]
  );

  // Initialize preferences for multiple PIs
  const initializePreferences = useCallback(
    (pi_ids: string[]) => {
      setPreferences((currentPreferences) => {
        const newPreferences: Record<string, PiPreference> = { ...currentPreferences };
        let hasChanges = false;
        
        pi_ids.forEach((pi_id, index) => {
          if (!newPreferences[pi_id]) {
            hasChanges = true;
            const gradientIndex = index % DEFAULT_GRADIENTS.length;
            newPreferences[pi_id] = {
              pi_id,
              gradient: DEFAULT_GRADIENTS[gradientIndex],
            };
          }
        });
        
        // Only save to localStorage if there are changes
        if (hasChanges) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
          } catch (error) {
            console.error("Error saving PI preferences:", error);
          }
        }
        
        return newPreferences;
      });
    },
    [] // No dependencies needed since we use functional update
  );

  // Reset all preferences
  const resetPreferences = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences({});
  }, []);

  return {
    preferences,
    getPreference,
    updatePreference,
    initializePreferences,
    resetPreferences,
    loadColorsFromBackend,
    isLoadingFromBackend,
  };
}

