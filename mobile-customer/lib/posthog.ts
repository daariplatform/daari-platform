/**
 * PostHog wiring — analytics + session replay + feature flags + experiments,
 * all from the existing PhiBit org-wide PostHog account (see global CLAUDE.md
 * "Existing third-party SaaS accounts" — do NOT create a separate account).
 *
 * Pattern:
 *   - Initialize once at app boot via <PostHogProvider> in app/_layout.tsx.
 *   - Always register `app: 'daari-customer'` super property so events from
 *     all PhiBit apps can be filtered per-app in the same PostHog project.
 *   - Call `identifyUser()` after login, `resetUser()` after logout.
 *   - Use `track()` for explicit events; auto-capture of route changes is
 *     wired by useScreenTracking() (mounted in _layout.tsx).
 *
 * Env vars (set in .env / EAS secrets, never committed):
 *   - EXPO_PUBLIC_POSTHOG_KEY  — PostHog Project API key (phc_...)
 *   - EXPO_PUBLIC_POSTHOG_HOST — defaults to https://us.i.posthog.com
 *
 * When EXPO_PUBLIC_POSTHOG_KEY is unset the SDK still imports but never
 * sends — convenient for dev / Expo Go without spamming PostHog.
 */

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useSegments, usePathname } from 'expo-router';

export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/** The "app" super-property — lets us segment events per PhiBit app in one PostHog project. */
export const APP_ID = 'daari-customer';

/**
 * Options object passed to <PostHogProvider apiKey=... options={...}>. The
 * provider itself is mounted in app/_layout.tsx so the SDK has the React
 * tree it needs for autocapture + session replay.
 */
export const POSTHOG_OPTIONS = {
  host: POSTHOG_HOST,
  // Only build profiles for users we've actually identified — keeps the
  // anonymous-visitor count low (PostHog charges per identified profile).
  enableSessionReplay: false,
  captureAppLifecycleEvents: true,
  defaultOptIn: true,
};

/**
 * Auto-track route changes as `screen_view` events. Mount once at the
 * root (inside the PostHog provider) — it has no UI of its own.
 */
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

/**
 * Convenience wrapper around PostHog's identify+register. Call after a
 * successful login so the user's events are attached to a stable ID.
 */
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
    // ignore — SDK not configured
  }
}

/** Wipes the current identity. Call from logout(). */
export function resetUser(ph: ReturnType<typeof usePostHog>) {
  if (!ph) return;
  try {
    ph.reset();
  } catch {
    // ignore
  }
}

/** Thin wrapper that adds the `app` super-property if PostHog isn't initialized yet. */
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
