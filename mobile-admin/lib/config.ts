import Constants from 'expo-constants';

/**
 * The single source of truth for the backend URL. In dev (Expo Go) we
 * pick up `apiBaseUrl` from app.json's `extra`. For local testing you
 * can override via the EXPO_PUBLIC_API_URL env var when running `expo start`.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ||
  'http://localhost:3004/api/v1';
