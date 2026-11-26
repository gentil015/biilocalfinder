import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { SelectedLocation } from '@/src/types/api';

export function useCurrentLocation(autoRequest = false) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<SelectedLocation | null> => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission is required to find nearby professionals.');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let label = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      let city: string | undefined;
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (address) {
          const street = [address.streetNumber, address.street].filter(Boolean).join(' ');
          label = [street, address.city ?? address.subregion, address.region].filter(Boolean).join(', ') || label;
          city = address.city ?? address.subregion ?? undefined;
        }
      } catch {
        // Keep the coordinates-only label when reverse geocoding fails.
      }
      const next: SelectedLocation = {
        label,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city,
      };
      setLocation(next);
      return next;
    } catch {
      setError('Could not get your location. You can still search by city or service.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRequest) void refresh();
  }, [autoRequest, refresh]);

  return { location, loading, error, refresh };
}
