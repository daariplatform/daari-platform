/* eslint-disable */
/**
 * Production seed — platform admin ONLY.
 * -----------------------------------------------------------------------------
 * Why this exists (and why it's plain .cjs, not seed.ts):
 *   deploy.sh installs prod deps with `npm ci --omit=dev`, so `ts-node` and the
 *   `prisma` CLI (which powers `prisma db seed`) are NOT on the server — they're
 *   devDependencies. This script depends only on `@prisma/client` and `argon2`,
 *   both of which ARE production dependencies, so `node prisma/seed-prod.cjs`
 *   runs on a bare prod install.
 *
 * What it does:
 *   Idempotently upserts the single PLATFORM_ADMIN account from
 *   PLATFORM_ADMIN_PHONE / PLATFORM_ADMIN_PASSWORD. Without this row every
 *   /platform/* route is unreachable and no tenant can be created — the launch
 *   path is dead on a fresh database. It seeds NO demo data (that lives in
 *   seed.ts, gated behind NODE_ENV !== 'production').
 *
 * Idempotency / safety:
 *   - Re-running never resets an existing admin's password (update touches only
 *     the role). First run sets the password from env; change it in-app after.
 *   - Refuses to run without PLATFORM_ADMIN_PASSWORD, mirroring seed.ts, so we
 *     never ship a known default credential to a live platform.
 *
 * Env loading:
 *   The Prisma *client* (unlike the Prisma CLI) does not auto-load .env, and
 *   this script may be invoked directly by the deploy shell rather than by the
 *   NestJS app. So we parse the sibling .env ourselves for any keys not already
 *   present in the environment (DATABASE_URL, PLATFORM_ADMIN_*).
 */
const fs = require('node:fs');
const path = require('node:path');

// ── Load .env (only keys not already set) ────────────────────────────────────
// Located at the app root, one directory up from prisma/. Matches the path the
// systemd unit reads (EnvironmentFile=/var/www/daari-water-api/.env).
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch {
    return; // No .env file — rely on whatever is already in process.env.
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const withoutExport = trimmed.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');
    if (eq === -1) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!key || key in process.env) continue; // real env wins over the file
    let value = withoutExport.slice(eq + 1).trim();
    // Strip a single layer of matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const { PrismaClient, UserRole } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.PLATFORM_ADMIN_PHONE ?? '07752222558';
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'PLATFORM_ADMIN_PASSWORD must be set before seeding the platform admin ' +
        '(refusing to ship a known default credential to a live platform).',
    );
  }

  const passwordHash = await argon2.hash(password);
  const admin = await prisma.user.upsert({
    where: { phone },
    // On an existing row keep the current password (only guarantee the role) so
    // re-deploys never surprise-reset the owner's credentials.
    update: { role: UserRole.PLATFORM_ADMIN },
    create: {
      phone,
      passwordHash,
      fullName: 'مالك المنصّة',
      role: UserRole.PLATFORM_ADMIN,
      tenantId: null,
    },
  });

  console.log('Platform admin ready:', { phone: admin.phone, role: admin.role });
}

main()
  .catch((e) => {
    console.error('[seed-prod] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
