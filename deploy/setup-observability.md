# Observability Setup — Sentry + UptimeRobot

Run this once when ready. Total time: ~20 minutes.

## 1. Sentry DSNs (5 min)

Per global CLAUDE.md, Ahmed has an existing Sentry org. We only create new
*projects* inside it, never a new org.

1. Open https://sentry.io → switch to Ahmed's PhiBit org.
2. Settings → Projects → **+ Create Project**. Repeat for each:

| Project name | Platform | Suggested team |
|---|---|---|
| `daari-backend` | NestJS (Node) | default |
| `daari-dashboard` | Next.js | default |
| `daari-customer` | React Native | default |
| `daari-worker` | React Native | default |

Each gives a DSN (looks like `https://abc...@o123.ingest.sentry.io/456`).

### Wire the DSNs

**Backend** — on the VPS:
```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119
nano /etc/systemd/system/daari-water-api.service
# In [Service], add to Environment=:
#   Environment=SENTRY_DSN=https://...@o123.ingest.sentry.io/456
systemctl daemon-reload && systemctl restart daari-water-api
journalctl -u daari-water-api -n 20 | grep -i sentry
```

**Dashboard** — locally before deploy:
```bash
cd ~/Downloads/maa-platform/dashboard
# Edit .env.production:
#   NEXT_PUBLIC_SENTRY_DSN=https://...@o123.ingest.sentry.io/456
npm run build
# Then rsync + restart per existing deploy script
```

**Mobile customer + worker** — locally before EAS build:
```bash
cd ~/Downloads/maa-platform/mobile-customer
# Edit .env (create if missing):
#   EXPO_PUBLIC_SENTRY_DSN=https://...@o123.ingest.sentry.io/456
# Same for mobile-worker
```

### Verify it works

After backend restart, trigger a test exception:
```bash
curl -s https://api.phi-bit.com/api/v1/__sentry-test 2>/dev/null
# (only if you've added a debug endpoint — otherwise just wait for a real error)
```
Then check the Sentry project page — the event should appear within 30s.

---

## 2. UptimeRobot (10 min)

Free tier: 50 monitors, 5-minute interval. Plenty for this project.

1. Sign up / login at https://uptimerobot.com (use info@phi-bit.com).
2. **+ New Monitor** — repeat 4 times:

| Monitor name | Type | URL | Interval |
|---|---|---|---|
| Daari API health | HTTPS | `https://api.phi-bit.com/api/v1/health` | 5 min |
| Daari API ready | HTTPS | `https://api.phi-bit.com/api/v1/ready` | 5 min |
| Daari Dashboard | HTTPS | `https://daari-admin.phi-bit.com` | 5 min |
| Daari API root | Keyword | `https://api.phi-bit.com/api/v1/health` (keyword: `"status":"ok"`) | 5 min |

3. **Alert contacts** — add Ahmed's WhatsApp + email:
   - WhatsApp: requires Pro ($7/month) OR use a Telegram bot via free tier
   - Email to `info@phi-bit.com` is free

4. **Status page** (optional): Settings → Public Status Pages → New → add the 4 monitors → custom domain `status.phi-bit.com` (free with their subdomain too).

---

## 3. PostHog project key (5 min)

Per global CLAUDE.md, Ahmed has an existing PostHog org. Create projects:

1. Open https://posthog.com → switch to Ahmed's org.
2. Settings → Projects → **+ New Project**. Suggest a single project shared
   across dashboard + customer + worker (super property `app` is already
   wired in code to segment events).
3. Copy the **Project API Key** (looks like `phc_...`).
4. Wire it:

```bash
# Dashboard
cd ~/Downloads/maa-platform/dashboard
# Edit .env.production:
#   NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Mobile customer
cd ~/Downloads/maa-platform/mobile-customer
# Edit .env (or app.json EAS env):
#   EXPO_PUBLIC_POSTHOG_KEY=phc_...

# Mobile worker — same as customer
```

5. Verify: open the dashboard in a browser, login → within 60 seconds the
   `login_success` event should appear in PostHog → Activity → Live Events.

---

## Done

After these three are wired:
- 🚨 Sentry catches every backend / frontend exception
- 📊 PostHog tracks every login, signup, order, blast
- ⏱️ UptimeRobot pings every 5 min and alerts on downtime

The cost: **$0** if you stay on free tiers + 20 minutes of clicks.
