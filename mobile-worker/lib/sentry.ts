import Constants from 'expo-constants';

/**
 * Initialize Sentry crash + error reporting. Imported (for side-effect)
 * at the top of app/_layout.tsx so it boots before any RN code runs.
 *
 * SENTRY_DSN is read from EAS-injected env (EXPO_PUBLIC_SENTRY_DSN). Leave
 * it unset in dev and demo profiles to keep the SDK in no-op mode.
 *
 * In Expo Go the native `@sentry/react-native` module isn't bundled, so
 * we lazy-require it and fall back to a no-op shim. This lets the same
 * codebase boot in Expo Go (for quick on-device testing) AND in dev /
 * EAS builds (where the native module IS present and crash reporting
 * actually runs).
 */

// Lazy-resolve the native Sentry module. If we're in Expo Go, this throws
// and we substitute a no-op shim.
function loadSentry(): any {
  try {
    // Using require so the import is evaluated at runtime, not parse
    // time — Metro will still bundle it, but the import side-effects
    // only run when we actually try to use it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@sentry/react-native');
  } catch (e) {
    console.warn('[sentry] native module not available (Expo Go?) — using no-op shim');
    return {
      init: () => {},
      wrap: <T,>(c: T) => c,
      captureException: () => {},
      captureMessage: () => {},
      addBreadcrumb: () => {},
    };
  }
}

const _Sentry = loadSentry();

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    _Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ? 'demo' : 'production',
      // 10% trace sample rate keeps us well inside Sentry's free tier given
      // the audience size we expect at launch.
      tracesSampleRate: 0.1,
      release: Constants.expoConfig?.version ?? '0.1.0',
      // Don't include device IDs or IPs.
      sendDefaultPii: false,
      // Strip authorization headers and tokens from breadcrumbs before
      // they ever leave the device.
      beforeBreadcrumb(crumb: any) {
        if (crumb.category === 'http' && crumb.data) {
          delete crumb.data.authorization;
          delete crumb.data.Authorization;
        }
        return crumb;
      },
    });
  } catch (e) {
    console.warn('[sentry] init failed:', e);
  }
}

export const Sentry = _Sentry;
