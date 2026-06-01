import * as Location from 'expo-location';
import { api } from './api';

/**
 * FOREGROUND-ONLY driver tracking.
 *
 * We deliberately do NOT use background location (TaskManager /
 * startLocationUpdatesAsync / ACCESS_BACKGROUND_LOCATION). Background
 * location triggers Google Play's special "background location" review
 * (declaration form + demo video, frequent rejections) and Apple "Always"
 * scrutiny — heavy friction for what is really a while-on-shift need.
 *
 * The driver keeps the app open during the route, so a foreground watcher
 * that pings the backend every ~30s is sufficient: the dashboard sees the
 * live position, and tracking stops the moment the shift ends or the app
 * is closed. If true background tracking is ever required, it can be added
 * later in a dedicated EAS build with the proper store declarations.
 */

let fgInterval: ReturnType<typeof setInterval> | null = null;

async function pingOnce(accuracy: Location.Accuracy = Location.Accuracy.Balanced) {
  const fix = await Location.getCurrentPositionAsync({ accuracy });
  await api.post('/drivers/me/location', {
    lng: fix.coords.longitude,
    lat: fix.coords.latitude,
  });
  return fix;
}

function startForegroundWatcher() {
  if (fgInterval) return;
  const tick = async () => {
    try {
      await pingOnce();
    } catch (e: any) {
      console.warn('[location] fg tick failed:', e?.message ?? e);
    }
  };
  fgInterval = setInterval(tick, 30_000);
}

/**
 * Start while-on-shift tracking. Requests foreground location only, marks
 * the driver AVAILABLE, sends an immediate ping (so the dashboard marker
 * appears at once), then polls every 30s while the app is open.
 */
export async function startShiftTracking(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    console.warn('[location] foreground permission denied');
    return false;
  }

  try {
    await api.post('/drivers/me/status', { status: 'AVAILABLE' });
  } catch (e: any) {
    console.warn('[location] could not set AVAILABLE:', e?.message ?? e);
  }

  // Immediate one-shot ping so the marker shows now, not in 30s.
  try {
    await pingOnce();
  } catch (e: any) {
    console.warn('[location] immediate ping failed (no fix?):', e?.message ?? e);
  }

  startForegroundWatcher();
  return true;
}

export async function stopShiftTracking() {
  if (fgInterval) {
    clearInterval(fgInterval);
    fgInterval = null;
  }
  try {
    await api.post('/drivers/me/status', { status: 'OFFLINE' });
  } catch {
    // best effort
  }
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

/** Haversine distance in metres — used for the GPS arrival check. */
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
