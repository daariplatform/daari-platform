# Backend e2e tests

Round-1 harness for the maa-platform NestJS backend. Six suites, all under
`test/*.e2e-spec.ts`. No production code is modified — these tests boot the
real `AppModule` and hit the HTTP layer with `supertest`.

## One-time setup

The suite needs a dedicated Postgres database. **Never** point it at the dev
DB — `truncateAll()` wipes every table between runs.

```bash
# 1. Create the test database (PostGIS required — Prisma schema declares it).
createdb daari_test
psql -d daari_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 2. Apply the Prisma schema.
DATABASE_URL="postgresql://$USER@localhost:5432/daari_test" \
  npx prisma db push --skip-generate

# 3. Tell Jest where to find it (write a .env.test in backend/).
cat > .env.test <<'EOF'
DATABASE_URL_TEST=postgresql://YOUR_USER@localhost:5432/daari_test
JWT_SECRET=test-secret-not-for-production
REDIS_HOST=disabled
SENTRY_DSN=
ZOHO_SMTP_PASS=
EOF
```

If you don't have PostGIS handy on macOS: `brew install postgis`.

## Running

```bash
npm test                   # all e2e suites
npm test -- auth.e2e        # one suite
npm test -- --testNamePattern="tenant"   # one describe
```

If `DATABASE_URL_TEST` is not set, every DB-bound suite skips with a clear
label rather than corrupting your dev DB.

## What's covered (round 1)

| Suite | What it pins down |
| --- | --- |
| `health.e2e-spec.ts` | `/health` and `/ready` respond 200 |
| `auth.e2e-spec.ts` | login returns JWT, wrong password = 401 |
| `tenant-isolation.e2e-spec.ts` | **critical**: T1 token can never read T2 data |
| `pagination.e2e-spec.ts` | page boundaries don't overlap, max pageSize enforced |
| `orders.e2e-spec.ts` | PENDING → EN_ROUTE → COMPLETED lifecycle |
| `uploads.e2e-spec.ts` | 5 MB cap + MIME allowlist on proof photos |

## What's intentionally NOT covered yet

- **Throttler rate limits** — counter persists across tests in the same Jest
  worker; verifying would need either a Throttler-storage reset hook or
  per-suite app rebuild (expensive).
- **WaterStock decrement on completion** — the current OrdersService doesn't
  touch WaterStock on completion, so a test would be wrong. Flag it for the
  next round once business logic stabilises.
- **Refresh-token rotation, OTP flows, customer self-signup** — not in the
  round-1 scope. Add when the auth surface stabilises.
