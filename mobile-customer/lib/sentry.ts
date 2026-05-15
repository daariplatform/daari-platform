import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Initialize Sentry crash + error reporting. Imported (for side-effect)
 * at the top of app/_layout.tsx so it boots before any RN code runs.
 *
 * SENTRY_DSN is read from EAS-injected env (EXPO_PUBLIC_SENTRY_DSN). Leave
 * it unset in dev and demo profiles to keep the SDK in no-op mode.
 *
 * We deliberately do NOT capture screenshots / breadcrumbs containing the
 * raw request body — auth payloads (phone + password) and customer PII
 * (location, address) would otherwise leak. The default `sendDefaultPii`
 * setting (false) is enough to stop that.
 */
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
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
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'http' && crumb.data) {
        delete (crumb.data as Record<string, unknown>).authorization;
        delete (crumb.data as Record<string, unknown>).Authorization;
      }
      return crumb;
    },
  });
}

export { Sentry };
