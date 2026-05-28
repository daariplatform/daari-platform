# UptimeRobot — Daari Water Monitors

Per Ahmed's global CLAUDE.md, there is **already an UptimeRobot account
under `info@phi-bit.com`**. Log in there — do NOT sign up for a new one.

Free tier: 50 monitors, 5-minute interval. We use 5 of those for Daari.

---

## The 5 monitors to create

Log in → **+ Add New Monitor** → create each row below.

| # | Monitor name | Type | Target | Interval | Notes |
|---|---|---|---|---|---|
| 1 | `Daari API · health` | HTTPS keyword | `https://api.phi-bit.com/api/v1/health` | 5 min | Keyword type: `exists`, keyword: `"status":"ok"` — catches the case where the server responds 200 but with garbage body (e.g. nginx serving a stale static page). |
| 2 | `Daari API · ready` | HTTPS keyword | `https://api.phi-bit.com/api/v1/ready` | 5 min | Keyword type: `exists`, keyword: `"db":"ok"` — confirms Postgres is reachable too, not just the Node process. |
| 3 | `Daari Admin Dashboard` | HTTPS | `https://daari-admin.phi-bit.com` | 5 min | Plain HTTPS check. Next.js returns 200 on `/` even when logged out (login page). |
| 4 | `Daari Customer · API root` | HTTPS keyword | `https://api.phi-bit.com/api/v1/health` | 5 min | (Same URL as #1 but distinct monitor name so the Customer app status page reads cleanly. Optional — drop if you want to use only 4 slots.) |
| 5 | `VPS SSH · 45.84.138.119:22` | Port | host `45.84.138.119`, port `22` | 5 min | Tests the SSH port is reachable, which is a proxy for "the whole VPS isn't down". UptimeRobot does support port checks on the free tier. |

If you'd rather stay at exactly **4 monitors**, drop #4 — it's redundant with #1.

---

## Alert contacts

Open **My Settings → Alert Contacts** and confirm Ahmed has these (add if missing):

- **Email** → `info@phi-bit.com` (free, instant)
- **Email** → `a7medal3ni@gmail.com` (backup, free)
- **WhatsApp** → requires UptimeRobot Pro ($7/mo). If sticking to free tier,
  use a **Telegram bot** as the secondary channel instead — UptimeRobot
  supports Telegram on the free tier and Ahmed can `/start` the bot on his
  phone in 30s.

Attach **all 5 contacts** to **every monitor** (or at least the email + Telegram
pair) so a single alert reaches both inboxes.

---

## Alert thresholds

UptimeRobot defaults: send an alert after the monitor has been "down" for one
check interval (5 min). Keep the default — anything tighter generates noise
from transient network blips between UptimeRobot's probes and the VPS.

If false-positives start showing up:
- Settings → Monitor → **Down Alert After N Failed Attempts** → set to `2`.
  That means the monitor must be down for 10 minutes before paging, at the
  cost of detecting real outages 5 min later.

---

## Public status page (optional, 2 min)

If Ahmed wants a public status page (`status.phi-bit.com` or
`stats.uptimerobot.com/<slug>`):

1. My Settings → **Public Status Pages** → **+ Add Status Page**.
2. Pick the 5 monitors above. Title: `Daari Water Platform`.
3. Custom domain `status.phi-bit.com` → UptimeRobot gives you a CNAME to add
   in Cloudflare. (Ahmed has Cloudflare access for `phi-bit.com`.)

This is purely cosmetic / a trust signal for plant owners — skip if not needed.

---

## Verifying the monitors actually catch outages

After creating them, simulate a downtime:

```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119 \
  'systemctl stop daari-water-api'
# wait 5-10 min — Sentry + UptimeRobot should both fire
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119 \
  'systemctl start daari-water-api'
```

If UptimeRobot didn't alert within 10 min, the alert contact wasn't attached
to that specific monitor — go re-attach.

---

## Cost

**$0** — fully inside the UptimeRobot free tier. The only paid upgrade Ahmed
might want later is WhatsApp alerting ($7/mo) once there are real plants
running on the platform and a 5-min email/Telegram delay isn't acceptable.
