import * as Location from 'expo-location';
import { Platform, Linking } from 'react-native';
import { supabase } from './supabase';

/**
 * Request location permissions from user
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission denied');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Get current GPS coordinates
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Update courier location in database
 */
export async function updateCourierLocation(
  orderId: string,
  latitude: number,
  longitude: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        courier_latitude: latitude,
        courier_longitude: longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating courier location:', error);
    return false;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated time of arrival (ETA) in minutes
 * Assumes average speed of 20 km/h for campus delivery
 */
export function calculateETA(distanceKm: number): number {
  const averageSpeedKmh = 20; // Campus delivery speed
  const timeHours = distanceKm / averageSpeedKmh;
  const timeMinutes = Math.ceil(timeHours * 60);
  return Math.max(1, timeMinutes); // Minimum 1 minute
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Start location tracking with interval updates
 * Returns a cleanup function to stop tracking
 */
export function startLocationTracking(
  orderId: string,
  intervalMs: number = 10000 // Update every 10 seconds
): () => void {
  let intervalId: NodeJS.Timeout;

  const updateLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      await updateCourierLocation(orderId, location.latitude, location.longitude);
    }
  };

  // Initial update
  updateLocation();

  // Set up interval
  intervalId = setInterval(updateLocation, intervalMs);

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Open device's native maps app for navigation
 */
export async function openMapsNavigation(latitude: number, longitude: number, label?: string) {
  const scheme = Platform.select({
    ios: 'maps:',
    android: 'geo:',
  });
  
  const url = Platform.select({
    ios: `${scheme}?daddr=${latitude},${longitude}&dirflg=d`,
    android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${label || 'Delivery Location'})`,
  });

  if (url) {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to Google Maps web
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    }
  }
}
