import Constants from 'expo-constants';

/**
 * The single source of truth for the backend URL. Resolution order:
 *   1. `EXPO_PUBLIC_API_URL` env var (set when running `expo start`).
 *   2. `app.json`'s `extra.apiBaseUrl` (baked into production EAS builds).
 *
 * Production safety: if NEITHER source is set AND we're not in dev, we
 * throw at module-load time rather than silently falling back to
 * `localhost`. Previously a release build with a misconfigured
 * `app.json` would happily point users at their own phone — a network
 * black hole that's almost impossible to debug from a crash report.
 *
 * The dev fallback only kicks in when `__DEV__` is true (Expo's flag for
 * `expo start` vs an EAS build).
 */
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const APP_URL = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

function resolveApiBaseUrl(): string {
  if (ENV_URL) return ENV_URL;
  if (APP_URL) return APP_URL;
  if (__DEV__) return 'http://localhost:3000/api/v1';
  // Production build with no config — fail loud rather than silently
  // talk to localhost on the user's phone.
  throw new Error(
    '[config] EXPO_PUBLIC_API_URL or extra.apiBaseUrl must be set in production builds.',
  );
}

export const API_BASE_URL: string = resolveApiBaseUrl();
