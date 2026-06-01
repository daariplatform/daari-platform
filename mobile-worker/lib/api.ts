import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';
import type { AuthResponse } from './types';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12_000,
});

// Attach access token to every outgoing request.
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/**
 * On a 401 we try a single refresh-token round-trip, then replay the
 * original request. Concurrent 401s coalesce on the same refresh promise
 * so we don't fire N refresh calls in parallel.
 */
let refreshInflight: Promise<string | null> | null = null;

// Session-expired callback. Registered by the auth store after first
// mount so that api.ts can drop the user back to the login screen when
// refresh fails — we used to clear tokens but leave the zustand `user`
// in place, which caused silent 401-storms on every screen the user
// had already navigated into.
let onSessionExpired: (() => Promise<void> | void) | null = null;
export function registerSessionExpiredHandler(fn: () => Promise<void> | void) {
  onSessionExpired = fn;
}

async function refreshAccess(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) {
    if (onSessionExpired) await onSessionExpired();
    return null;
  }
  try {
    const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: refresh,
    });
    await setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    await clearTokens();
    if (onSessionExpired) await onSessionExpired();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError & { config?: any }) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      // Single-flight refresh: all concurrent 401s share ONE refresh promise,
      // cleared only in `.finally` (after the rotated, one-time-use refresh
      // token is persisted). Prevents a racing second refresh from spending an
      // already-consumed token → 401 → spurious logout.
      refreshInflight =
        refreshInflight ??
        refreshAccess().finally(() => {
          refreshInflight = null;
        });
      const newToken = await refreshInflight;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);
