# Daari Water — Production Monitoring

This doc is the single source of truth for what Ahmed has to set in dashboards
and what is wired in code. Per global CLAUDE.md, every external service below
already has an account under Ahmed's PhiBit org — **do not create a new org or
sign up for a competing service.**

Companion docs:
- `docs/UPTIMEROBOT.md` — the 5 monitors to create in the existing UptimeRobot account.
- `deploy/setup-observability.md` — the original DSN-paste runbook (still valid).

---

## 1. Sentry — error tracking

### What is wired

| App | File | Reads DSN from |
|---|---|---|
| Backend (NestJS) | `backend/src/instrument.ts` + `backend/src/main.ts` | `process.env.SENTRY_DSN` |
| Dashboard (Next.js) | (sentry wizard generated) | `NEXT_PUBLIC_SENTRY_DSN` |
| Mobile admin (Expo) | `mobile-admin/lib/sentry.ts` | `process.env.EXPO_PUBLIC_SENTRY_DSN` |
| Mobile customer (Expo) | `mobile-customer/lib/sentry.ts` | `process.env.EXPO_PUBLIC_SENTRY_DSN` |
| Mobile worker (Expo) | `mobile-worker/lib/sentry.ts` | `process.env.EXPO_PUBLIC_SENTRY_DSN` |

Each Expo app already lazy-loads `@sentry/react-native` so it boots in Expo Go
without crashing when the native module isn't present — DSN simply has to be
non-empty for crash reporting to activate.

### Dependencies (already installed)

- Backend: `@sentry/nestjs` `@sentry/profiling-node`
- Mobile admin / customer / worker: `@sentry/react-native`

### What Ahmed must do (one-time, ~10 min)

1. Open https://sentry.io → switch to the PhiBit org (already exists).
2. Settings → Projects → **+ Create Project**. Create five projects:
   - `daari-backend` (platform: Node / NestJS)
   - `daari-dashboard` (platform: Next.js)
   - `daari-admin` (platform: React Native)
   - `daari-customer` (platform: React Native)
   - `daari-worker` (platform: React Native)
3. Each project's setup screen shows a DSN like
   `https://abc...@o123.ingest.sentry.io/456`. Copy it.

### Where to paste each DSN

**Backend** — on the VPS, NOT in git:
```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119
nano /var/www/daari-water-api/.env
# Add the line:
#   SENTRY_DSN=https://...@o123.ingest.sentry.io/456
systemctl restart daari-water-api
journalctl -u daari-water-api -n 30 --no-pager | grep -i sentry
```

**Dashboard** — locally in `dashboard/.env.production` (gitignored), then
redeploy:
```bash
echo 'NEXT_PUBLIC_SENTRY_DSN=https://...@o123.ingest.sentry.io/456' \
  >> dashboard/.env.production
```

**Mobile (admin / customer / worker)** — locally in each app's `.env`
(gitignored) before the next EAS build:
```bash
echo 'EXPO_PUBLIC_SENTRY_DSN=https://...@o123.ingest.sentry.io/456' \
  >> mobile-admin/.env
# Repeat for mobile-customer and mobile-worker (each gets its OWN DSN
# from its OWN Sentry project — do not reuse one DSN across all three).
```

### Verify

After restarting the backend, trigger a test exception:
```bash
curl -s 'https://api.phi-bit.com/api/v1/__sentry-test'
# Returns 404 (route doesn't exist) but Sentry should pick up nothing.
# Better: temporarily add a /api/v1/debug-sentry route that throws, hit it,
# then remove. Within 30s the event appears in Sentry → daari-backend.
```

### TODO (future): source-map upload via Sentry CLI

Right now the dashboard and mobile apps ship minified JS — Sentry stack
traces will show `main.abc123.js:1:12345` instead of real filenames. Once
launched, automate sourcemap upload from CI:

```bash
# Dashboard (Next.js)
npx @sentry/wizard@latest -i nextjs   # writes sentry.client.config + .properties
# Then `next build` automatically uploads when SENTRY_AUTH_TOKEN is set.

# Mobile (EAS already uploads if you wire the auth token in eas.json)
SENTRY_AUTH_TOKEN=...  # personal token from https://sentry.io/settings/account/api/auth-tokens/
eas build --profile production --platform android
```

---

## 2. Slack alerts for production errors

**Recommended path: use Sentry's native Slack integration.** Don't roll your
own `beforeSend` hook — Sentry handles deduplication, severity routing, and
release health for free. We've left a `SLACK_WEBHOOK_URL` env var in the
template only as an emergency fallback if Ahmed ever needs to bypass Sentry.

### Setup (5 min, done once)

1. In Slack: pick the channel for alerts (e.g. `#daari-alerts`). If it
   doesn't exist, create it (private is fine).
2. In Sentry: open the `daari-backend` project → Settings → Integrations →
   **Slack** → **Add Workspace**. Pick the PhiBit Slack workspace.
3. Once installed, go back to project Settings → Alerts → **New Alert Rule**:
   - Trigger: *Any new issue* OR *Issue is seen by 5+ users in 1h* (your choice)
   - Action: **Send notification to Slack workspace** → channel `#daari-alerts`
4. Repeat the alert-rule step (NOT the integration install — that's
   workspace-wide) for `daari-dashboard`, `daari-admin`, `daari-customer`,
   `daari-worker`.

### Fallback (NOT recommended): direct webhook in beforeSend

Only do this if Sentry's Slack integration is unavailable for some reason.
In `backend/src/instrument.ts`, after the existing `Sentry.init(...)`:

```ts
beforeSend(event) {
  if (process.env.SLACK_WEBHOOK_URL && event.level === 'fatal') {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ text: `🚨 ${event.message}` }),
    }).catch(() => { /* never block the error path */ });
  }
  return event;
},
```

To create the webhook in Slack: https://api.slack.com/messaging/webhooks →
**Create New App** → From scratch → name `Daari Alerts` → enable Incoming
Webhooks → Add New Webhook to Workspace → pick `#daari-alerts` → copy URL
→ paste into `SLACK_WEBHOOK_URL=` in `/var/www/daari-water-api/.env`.

---

## 3. Structured JSON logging

### What is wired

`backend/src/app.module.ts` now imports `LoggerModule.forRoot(...)` from
`nestjs-pino`. `backend/src/main.ts` calls `app.useLogger(app.get(Logger))`
with `bufferLogs: true` so even Nest's bootstrap messages come out as JSON.

- In production (default): single-line JSON per log entry. Examples:
  ```json
  {"level":30,"time":1716800000000,"pid":12345,"msg":"GET /api/v1/customers/me","req":{"method":"GET","url":"/api/v1/customers/me"},"res":{"statusCode":200}}
  ```
- In dev (`NODE_ENV=development`): pretty-printed via `pino-pretty`.
- `/health` and `/ready` are excluded from request auto-logging — UptimeRobot
  hits them every 5 min and would otherwise dominate the log volume.
- `Authorization`, `Cookie`, `x-api-key`, and `Set-Cookie` headers are
  redacted at the logger level — tokens never reach disk.

### Env vars

```bash
NODE_ENV=production
LOG_LEVEL=info          # trace | debug | info | warn | error | fatal
```

### How to read logs on the VPS

```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119

# Native journald (JSON entries, plus systemd metadata wrapper):
journalctl -u daari-water-api -o json --since "1 hour ago" | jq '.MESSAGE | fromjson?'

# Or read directly from the StandardOutput file the systemd unit writes to:
tail -F /var/log/daari-water/api.log | jq .

# Filter to warnings + above:
tail -F /var/log/daari-water/api.log | jq 'select(.level >= 40)'
```

### Verification step (after first deploy with this change)

```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119 \
  'journalctl -u daari-water-api --since "5 minutes ago" -n 5 --no-pager' \
  | head -20
```
If the lines start with `{` and parse cleanly through `jq`, the rollout
worked. If they still look like `[Nest] 12345  - LOG ...`, the build on the
server is older than this change — redeploy.

---

## 4. Log rotation (logrotate)

`/var/log/daari-water/api.log` and `api.err.log` previously grew unbounded.
A logrotate config has been created at `/etc/logrotate.d/daari-water` on
the VPS — see `deploy/logrotate/daari-water` in this repo for the source
of truth (sync via `rsync` if you re-provision the box).

Behavior:
- Rotate **daily** at 06:25 (logrotate's default cron slot on Ubuntu).
- Keep **14 days** of history.
- **gzip** files after one day (so yesterday's log is plain text, easy to
  grep without `zcat`; older ones are compressed).
- **copytruncate** — copies the file then truncates the original in place,
  so the systemd `StandardOutput=append:` handle keeps writing to the same
  inode without needing a service restart.
- `missingok notifempty` — skip silently if a log file is empty/absent.

Dry-run on the VPS to confirm:
```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119 \
  'logrotate -d /etc/logrotate.d/daari-water'
```

---

## 5. UptimeRobot

See `docs/UPTIMEROBOT.md` — separate checklist of the 5 monitors Ahmed
needs to create in his existing UptimeRobot account.

---

## TL;DR — what Ahmed has to do manually

| # | Action | Time | Where |
|---|---|---|---|
| 1 | Create 5 projects in existing Sentry org | 5 min | sentry.io |
| 2 | Paste each DSN into the right env file (1 backend + 1 dashboard + 3 mobile) | 5 min | VPS + local .env |
| 3 | Restart `daari-water-api` so it picks up `SENTRY_DSN` and the new JSON logger | 30s | VPS |
| 4 | Redeploy dashboard with `NEXT_PUBLIC_SENTRY_DSN` set | 5 min | local |
| 5 | Add Sentry → Slack integration in PhiBit Sentry org | 2 min | sentry.io |
| 6 | Create 5 alert rules (one per Sentry project) → channel `#daari-alerts` | 5 min | sentry.io |
| 7 | Create 5 monitors in existing UptimeRobot account (see UPTIMEROBOT.md) | 5 min | uptimerobot.com |
| 8 | Verify journalctl shows JSON lines | 30s | VPS |

Total wall-clock: ~30 minutes.
