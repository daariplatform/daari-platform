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
 * When the refresh token is dead (refresh 401s), we clear tokens — but the
 * app's auth-store `user` was still set, so the router kept the user on the
 * tabs with a dead session and every query 401'd, leaving screens stuck on
 * skeletons forever. The auth-store registers a handler here so the API layer
 * can trigger a real logout (→ router redirects to the login screen) without
 * api.ts importing the store (avoids a require cycle).
 */
let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(fn: () => void) {
  onAuthFailure = fn;
}

/**
 * On a 401 we try a single refresh-token round-trip, then replay the
 * original request. Concurrent 401s coalesce on the same refresh promise
 * so we don't fire N refresh calls in parallel.
 */
let refreshInflight: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: refresh,
    });
    await setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    await clearTokens();
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
      // Single-flight refresh. EVERY concurrent 401 must await the SAME
      // refresh promise, and `refreshInflight` is cleared ONLY in `.finally`
      // (i.e. AFTER the rotated refresh token is persisted by setTokens).
      // The refresh token is one-time-use server-side, so if a second request
      // fired its own refresh with the already-consumed token it would 401 and
      // force a spurious logout — which is exactly the "placing an order logs
      // me out" bug: the home screen fires several queries at once, the access
      // token has expired (15-min TTL), and the racing refreshes killed the
      // session. Clearing in `.finally` makes the window atomic.
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
      // Refresh failed → session is dead. Trigger a logout so the router
      // sends the user to the login screen instead of leaving them on a
      // tab whose queries 401 forever (the infinite-skeleton bug).
      onAuthFailure?.();
    }
    return Promise.reject(error);
  },
);
