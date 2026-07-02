'use client';

import axios from 'axios';

// Next.js inlines NEXT_PUBLIC_* env vars at build time, so this string
// has to be set when `next build` runs (during the deploy script on the
// laptop), NOT just on the production server. See dashboard/.env.production
// in the repo for the production value. The localhost fallback is only for
// `next dev` against a local backend.
//
// We accept both NEXT_PUBLIC_API_BASE_URL (the canonical name in the
// runbook + .env templates) and NEXT_PUBLIC_API_URL (legacy) so that
// either flavor "just works" without a rebuild surprise.
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
});

const ACCESS_KEY = 'maa_access';
// Legacy key. The refresh token used to be stored here but was never read (the
// web apps have no /auth/refresh flow), so a long-lived refresh token sitting in
// localStorage was a pure XSS-exfiltration liability. We no longer write it;
// clearTokens() still removes it to purge any value left by an older build.
const REFRESH_KEY = 'maa_refresh';

export function setTokens(access: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, access);
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  // Best-effort: purge Cache Storage so a logged-out (or the next) user on
  // this browser can't be served the previous session's cached responses.
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    // Don't hijack the 401 from a failed login attempt — redirecting to
    // /login there triggers a full reload that wipes the "wrong credentials"
    // error before the user can read it. Only bounce authenticated-session 401s.
    const url: string = err.config?.url ?? '';
    const isLoginAttempt = url.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginAttempt) {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
