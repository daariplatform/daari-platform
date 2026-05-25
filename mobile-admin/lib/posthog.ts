/**
 * PostHog wiring — analytics + session replay + feature flags + experiments,
 * all from the existing PhiBit org-wide PostHog account (see global CLAUDE.md
 * "Existing third-party SaaS accounts" — do NOT create a separate account).
 *
 * Pattern:
 *   - Initialize once at app boot via <PostHogProvider> in app/_layout.tsx.
 *   - Always register `app: 'daari-worker'` super property so events from
 *     all PhiBit apps can be filtered per-app in the same PostHog project.
 *   - Call `identifyUser()` after login, `resetUser()` after logout.
 *   - Use `track()` for explicit events; auto-capture of route changes is
 *     wired by useScreenTracking() (mounted in _layout.tsx).
 *
 * Env vars (set in .env / EAS secrets, never committed):
 *   - EXPO_PUBLIC_POSTHOG_KEY  — PostHog Project API key (phc_...)
 *   - EXPO_PUBLIC_POSTHOG_HOST — defaults to https://us.i.posthog.com
 */

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useSegments, usePathname } from 'expo-router';

export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export const APP_ID = 'daari-admin';

export const POSTHOG_OPTIONS = {
  host: POSTHOG_HOST,
  enableSessionReplay: false,
  captureAppLifecycleEvents: true,
  defaultOptIn: true,
};

export function useScreenTracking() {
  const ph = usePostHog();
  const segments = useSegments();
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!ph) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    try {
      ph.screen(pathname || '/', {
        segments: segments.join('/') || '/',
        app: APP_ID,
      });
    } catch {
      // SDK not configured — silently skip.
    }
  }, [ph, pathname, segments]);
}

export function identifyUser(
  ph: ReturnType<typeof usePostHog>,
  userId: string,
  props: { phone?: string; role?: string; tenantId?: string | null },
) {
  if (!ph) return;
  try {
    // PostHog's JsonType rejects `undefined` — strip empty fields so the
    // payload type-checks without ?? '' polluting the dashboard with empties.
    const cleaned: Record<string, string> = { app: APP_ID };
    if (props.phone) cleaned.phone = props.phone;
    if (props.role) cleaned.role = props.role;
    if (props.tenantId) cleaned.tenantId = props.tenantId;
    ph.identify(userId, cleaned);
    ph.register(props.role ? { app: APP_ID, role: props.role } : { app: APP_ID });
  } catch {
    // ignore
  }
}

export function resetUser(ph: ReturnType<typeof usePostHog>) {
  if (!ph) return;
  try {
    ph.reset();
  } catch {
    // ignore
  }
}

export function track(
  ph: ReturnType<typeof usePostHog>,
  event: string,
  props?: Record<string, unknown>,
) {
  if (!ph) return;
  try {
    ph.capture(event, { app: APP_ID, ...(props ?? {}) });
  } catch {
    // ignore
  }
}
