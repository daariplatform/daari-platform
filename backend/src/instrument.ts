/**
 * Sentry SDK initialization. Imported as the FIRST line of main.ts so the
 * SDK has a chance to instrument Node before NestJS bootstraps.
 *
 * Activated only when SENTRY_DSN is set in the environment — leaving it
 * unset (default in dev) makes this a no-op. Production sets it via the
 * .env file deployed alongside the systemd unit.
 *
 * Sample rates kept low (10% traces, 10% profiles) to stay inside the
 * Sentry free tier — Iraqi water plants don't generate enough traffic to
 * notice the difference, and we can crank it up if we ever need to chase
 * a perf regression.
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.APP_VERSION ?? '0.1.0',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  });
}
