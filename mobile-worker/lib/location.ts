import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';

const LOCATION_TASK = 'maa-driver-location';

/**
 * Background-location task. Reports the driver's coords to the backend
 * roughly every 30s while a shift is active. Stops cleanly when the
 * driver toggles off-duty (or logs out) so we're not burning battery
 * for nothing.
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const { locations } = (data ?? {}) as { locations: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  try {
    await api.post('/drivers/me/location', {
      lng: latest.coords.longitude,
      lat: latest.coords.latitude,
    });
  } catch {
    // Swallow — next tick will retry. Don't crash the background task.
  }
});

export async function startShiftTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'وردية عمل ماء نشطة',
      notificationBody: 'نسجّل موقعك أثناء جولة التعبئات.',
      notificationColor: '#0891b2',
    },
  });
  return true;
}

export async function stopShiftTracking() {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}

/** One-shot fix for the arrival check / walk-in registration. */
export async function getCurrentCoords() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status !== 'granted') return null;
  }
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lng: loc.coords.longitude, lat: loc.coords.latitude };
}

/** Haversine distance in metres — used for offline GPS arrival check. */
export function distanceMetres(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}
