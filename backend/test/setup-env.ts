/**
 * Loaded by Jest before any test code (via `setupFiles` in jest.config.ts).
 *
 * Responsibilities:
 *   1. Point Prisma at the test DB (via DATABASE_URL_TEST → DATABASE_URL).
 *   2. Disable Redis / BullMQ / Sentry so tests don't need those services.
 *   3. Provide a deterministic JWT secret so token signing works.
 *   4. Try to load `.env.test` if present (lets a dev override any of the above).
 *
 * Tests THEMSELVES check whether DATABASE_URL is reachable and skip the suite
 * with a clear message if not (see test/setup.ts → createTestApp).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// 1. Optional .env.test — minimal parser, no extra dep.
const envTestPath = path.resolve(__dirname, '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  for (const line of fs.readFileSync(envTestPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue; // existing env wins
    process.env[key] = raw.replace(/^['"]|['"]$/g, '');
  }
}

// 2. Promote DATABASE_URL_TEST → DATABASE_URL so PrismaClient picks it up.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// 3. Disable infra Nest expects but tests don't need.
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'disabled';
process.env.SENTRY_DSN = process.env.SENTRY_DSN ?? '';
process.env.ZOHO_SMTP_PASS = process.env.ZOHO_SMTP_PASS ?? '';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-not-for-production-use-only';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.NODE_ENV = 'test';

// uploads.controller.ts freezes UPLOADS_DIR at import time, so it must be set
// here (jest setupFiles run before any app module loads) — a beforeAll override
// in the spec is too late. Point proof uploads at a writable temp dir.
process.env.UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(os.tmpdir(), 'daari-test-uploads');

// Silence noisy console output during tests; uncomment for debugging.
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'warn').mockImplementation(() => {});
