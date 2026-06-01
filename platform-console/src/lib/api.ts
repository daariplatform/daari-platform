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
const REFRESH_KEY = 'maa_refresh';

export function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
