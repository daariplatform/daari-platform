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
  if (error) {
    console.warn('[location] background task error:', error);
    return;
  }
  const { locations } = (data ?? {}) as { locations: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  try {
    await api.post('/drivers/me/location', {
      lng: latest.coords.longitude,
      lat: latest.coords.latitude,
    });
    console.log('[location] bg ping ok', latest.coords.latitude, latest.coords.longitude);
  } catch (e: any) {
    // Swallow — next tick will retry. Don't crash the background task.
    console.warn('[location] bg ping failed:', e?.message ?? e);
  }
});

/**
 * Starts continuous GPS tracking for the driver. Also:
 *  1. Sends an IMMEDIATE one-shot ping so the dashboard sees the driver
 *     within seconds of login (instead of waiting 30s+ for the first
 *     background callback).
 *  2. Bumps status to AVAILABLE so the dashboard's inactivity flag and
 *     "on shift" filter work without the driver manually toggling.
 */
export async function startShiftTracking(): Promise<boolean> {
  // 1. Foreground permission — required even for background mode.
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    console.warn('[location] foreground permission denied');
    return false;
  }

  // 2. Mark driver AVAILABLE on the server so the dashboard's "inactive"
  //    flag and "on shift" filter immediately recognise this driver.
  try {
    await api.post('/drivers/me/status', { status: 'AVAILABLE' });
    console.log('[location] status set to AVAILABLE');
  } catch (e: any) {
    console.warn('[location] could not set AVAILABLE:', e?.message ?? e);
  }

  // 3. Immediate one-shot location ping so the marker appears now, not
  //    in 30s. Don't block if the device returns no fix (simulator may).
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await api.post('/drivers/me/location', {
      lng: fix.coords.longitude,
      lat: fix.coords.latitude,
    });
    console.log('[location] immediate ping ok', fix.coords.latitude, fix.coords.longitude);
  } catch (e: any) {
    console.warn('[location] immediate ping failed (no fix?):', e?.message ?? e);
  }

  // 4. Always start the foreground polling — works in Expo Go + Simulator
  //    + standalone. This is the reliable path; background is bonus.
  startForegroundWatcher();

  // 5. Try background permission + real background updates. In Expo Go
  //    these APIs don't have the necessary entitlements and will throw;
  //    that's fine — the foreground watcher above already handles things
  //    while the app is open, and the user can switch to a dev/EAS build
  //    later for real background tracking.
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      console.warn('[location] background permission denied — fg-only mode');
      return true;
    }
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (!alreadyRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30_000,
        distanceInterval: 50,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: 'وردية عمل ماء نشطة',
          notificationBody: 'نسجّل موقعك أثناء جولة التعبئات.',
          notificationColor: '#0284c7',
        },
      });
      console.log('[location] background updates started');
    }
  } catch (e: any) {
    // Expo Go / unsupported environment — keep going with foreground only.
    console.warn('[location] background mode unavailable (Expo Go?):', e?.message ?? e);
  }

  return true;
}

// Foreground polling — every 30s explicitly fetch current position and
// POST to the backend. We prefer this over watchPositionAsync because:
//  - iOS Simulator's `simctl location set` doesn't reliably fire Core
//    Location change events to JS in our experience.
//  - setInterval+getCurrentPositionAsync gives deterministic, periodic
//    pings even if the GPS hasn't moved (so the dashboard "last seen"
//    keeps refreshing and the inactivity flag stays clear).
// On a real device + real driver in motion this is identical user-facing
// behavior; the device's location is already updating in the background.
let fgInterval: ReturnType<typeof setInterval> | null = null;

function startForegroundWatcher() {
  if (fgInterval) return;
  const tick = async () => {
    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await api.post('/drivers/me/location', {
        lng: fix.coords.longitude,
        lat: fix.coords.latitude,
      });
      console.log('[location] fg tick ok', fix.coords.latitude, fix.coords.longitude);
    } catch (e: any) {
      console.warn('[location] fg tick failed:', e?.message ?? e);
    }
  };
  fgInterval = setInterval(tick, 30_000);
}

export async function stopShiftTracking() {
  // Stop foreground polling
  if (fgInterval) {
    clearInterval(fgInterval);
    fgInterval = null;
  }
  // Stop background task if running
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  // Mark driver offline on the server
  try {
    await api.post('/drivers/me/status', { status: 'OFFLINE' });
  } catch {
    // ignore — best effort
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
