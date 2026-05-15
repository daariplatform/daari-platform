# 🚀 Daari — Launch Runbook v2 (post-prep)

Step-by-step guide to take Daari from "code ready" to "live on Play Store",
in the order the steps actually need to happen. Each section says **why**
it's needed and **how long** it takes.

This supersedes the older `LAUNCH_RUNBOOK.md` which assumed an OTP-based
auth model.

---

## Phase 0 — Pre-flight checks (already done)

In this branch:

- [x] OTP auth replaced with phone + password (plant provisions accounts)
- [x] `POST /customers` and `POST /drivers` return `tempPassword`
- [x] Reset-password endpoints for plant admin
- [x] Self-service `POST /auth/change-password`
- [x] Rate limiting on `/auth/login` (5 attempts / 15 min)
- [x] Sentry SDK wired in backend + both mobile apps (no-op until DSN set)
- [x] Dashboard "Add Customer" + "Add Driver" with one-shot credential reveal
- [x] Real app icons + splash + Play Store feature graphics
- [x] Legal pages at `/legal/privacy` and `/legal/terms` on the dashboard
- [x] Nightly Postgres backup cron + S3 mirror
- [x] systemd units + nginx vhosts + `deploy.sh` + `vps-bootstrap.sh`

What's left is everything that needs you to log into external accounts.

---

## Phase 1 — VPS (Day 1, ~3 hours)

### 1.1 — Update the multi-tenant registry FIRST

```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119
vim /root/PROJECTS.md
```

Add these lines:

```
- daari (api)        port 3001  /var/www/daari-api         systemd: daari-api         nginx: daari-api
- daari (dashboard)  port 3002  /var/www/daari-dashboard   systemd: daari-dashboard   nginx: daari-dashboard
```

Before saving, double-check nothing else uses 3001 or 3002:

```bash
ss -tlnp | grep -E '300[12]'
```

### 1.2 — Clone the repo on the VPS + bootstrap

```bash
cd /root
git clone https://github.com/a7medal3ni/daari-platform.git
bash /root/daari-platform/deploy/vps-bootstrap.sh
```

The bootstrap script prints a generated Postgres password — **save it**.

### 1.3 — Fill in production env files

```bash
cp /root/daari-platform/backend/.env.production.example /var/www/daari-api/.env
vim /var/www/daari-api/.env
```

Required values:

- `DATABASE_URL` — paste the Postgres password from step 1.2
- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `SENTRY_DSN` — leave blank for now, fill in Phase 3.1
- `CORS_ORIGINS=https://daari-admin.phi-bit.com`

For the dashboard:

```bash
cat > /var/www/daari-dashboard/.env <<EOF
NEXT_PUBLIC_API_BASE_URL=https://api.maa-iq.com/api/v1
EOF
```

### 1.4 — DNS

In Cloudflare, add A records:

```
api.maa-iq.com           A    45.84.138.119   (proxy: OFF for the cert step)
daari-admin.phi-bit.com  A    45.84.138.119   (proxy: OFF for the cert step)
```

Wait until `dig +short api.maa-iq.com` returns `45.84.138.119`.

### 1.5 — Deploy from laptop

```bash
cd ~/Downloads/maa-platform
./deploy/deploy.sh both
```

### 1.6 — Let's Encrypt (on VPS)

```bash
certbot --nginx -d api.maa-iq.com -d daari-admin.phi-bit.com
```

### 1.7 — Smoke test

```bash
curl -i https://api.maa-iq.com/api/v1/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"phone":"07700000000","password":"wrong"}'
# Expect 401 (not 502 or timeout)

curl -i https://daari-admin.phi-bit.com/legal/privacy
# Expect 200 with HTML
```

---

## Phase 2 — Seed the first tenant (Day 1, 30 min)

The platform is multi-tenant. You need at least one plant in the DB.

For now, use `prisma db seed` with the existing seed file:

```bash
ssh -i ~/.ssh/phibit_deploy root@45.84.138.119
cd /var/www/daari-api
sudo -u daari -- npx prisma db seed
```

This creates a demo tenant + an OWNER user. Use those credentials to log
into the dashboard at https://daari-admin.phi-bit.com. From there, create
real customers and drivers via the UI.

---

## Phase 3 — External accounts (Day 2, ~4 hours)

### 3.1 — Sentry (15 min)

1. https://sentry.io → sign up
2. Create three projects:
   - `daari-backend` (Node.js)
   - `daari-customer` (React Native)
   - `daari-worker` (React Native)
3. Copy each DSN
4. On VPS: `vim /var/www/daari-api/.env` → `SENTRY_DSN=<backend dsn>`
5. For the mobile apps, set the EAS env:
   ```bash
   cd mobile-customer
   npx eas-cli env:create production --name EXPO_PUBLIC_SENTRY_DSN --value <customer dsn>
   ```
6. Restart backend (`systemctl restart daari-api`), rebuild apps.

### 3.2 — WhatsApp Business Cloud API (2 hours, mostly waiting)

1. https://business.facebook.com → create a Business account
2. Add Phi-Bit as a business asset
3. WhatsApp → API Setup → get permanent token, phone number ID
4. Verify a dedicated phone number (not Ahmed's personal SIM)
5. Submit message templates for approval (Meta reviews in ~24h):
   - `refill_reminder_25_days`
   - `refill_warning_35_days`
6. Drop credentials into `/var/www/daari-api/.env`

**Alternative if Meta is slow:** Twilio WhatsApp (~$0.005/msg, faster setup).

### 3.3 — Firebase Cloud Messaging (30 min)

1. https://console.firebase.google.com → project `daari-platform`
2. Add Android apps for both bundles:
   - `com.phibit.daari.customer`
   - `com.phibit.daari.worker`
3. Download `google-services.json` to each mobile-* folder
4. Service account → generate private key → save to
   `/var/www/daari-api/google-service-account.json` (chmod 600)

### 3.4 — DigitalOcean Spaces (15 min)

1. https://cloud.digitalocean.com/spaces → create `daari-proofs` (Frankfurt)
2. Another: `daari-backups` (30-day lifecycle)
3. Generate Spaces access key
4. Fill `S3_*` vars in backend `.env`

---

## Phase 4 — Mobile apps for production (Day 3, ~2 hours)

### 4.1 — Production keystore (verify it exists)

```bash
cd mobile-customer
npx eas-cli credentials --platform android
# Confirm production keystore exists. Download a backup copy.
# Losing it = losing the ability to ship updates forever.
```

### 4.2 — Production build (.aab, not .apk)

```bash
cd mobile-customer
npx eas-cli build --platform android --profile production

cd ../mobile-worker
npx eas-cli build --platform android --profile production
```

`EXPO_PUBLIC_DEMO_MODE=false` in production profile means the apps hit
the real backend. Verify it's live first (Phase 1.7).

### 4.3 — Play Console listing

For each app (customer first, worker second):

1. https://play.google.com/console → create app
2. Upload `.aab` to **Internal Testing** track first
3. **App content** section:
   - Privacy policy URL: `https://daari-admin.phi-bit.com/legal/privacy`
   - Content rating: complete questionnaire (~5 min)
   - Target audience: 18+
   - Data safety: see 4.4 below
4. **Store listing**:
   - Short description (80 char): "خدمات منزلك بضغطة زر — مياه، غاز، تنظيف"
   - Full description: paste from `legal/PLAY_STORE_LISTING_CUSTOMER.md`
   - Icon: `store-assets/play-store-icon-customer.png`
   - Feature graphic: `store-assets/feature-graphic-customer.png`
   - **Screenshots: capture 4-8 from BlueStacks** (still missing — do this!)

### 4.4 — Data Safety form

For each app, declare:

| Data type | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| Name | Yes | No | No | App functionality |
| Phone number | Yes | No | No | Account management |
| Address | Yes | No | No | App functionality |
| Approximate location | Yes | No | No | App functionality |
| Precise location | Yes (worker only) | No | No | App functionality |
| Photos (worker only) | Yes | No | No | App functionality |
| App crash logs | Yes | No | No | Analytics |

Security practices:
- Data encrypted in transit ✅
- You can request deletion ✅ (via support@phi-bit.com)

### 4.5 — Closed Testing → Production

1. Submit to Closed Testing first (you + 5-10 pilot plant staff)
2. Wait 2-3 days for Google review
3. After approval, monitor for 1 week
4. Promote to Production track

---

## Phase 5 — Pilot launch (Week 2)

1. **Pick ONE water plant** in Baghdad as the pilot
2. Sit with the owner for 30 min — walk through:
   - Creating their first 5 customers from the dashboard
   - Showing customers how to log in with the password they gave them
   - Adding 1 driver, downloading the worker app
3. Watch for 48h. Be ready to hot-fix.
4. After 1 week with no critical bugs, open to 2-3 more plants.

---

## What Ahmed needs to do himself (can't be automated)

| # | Task | Why |
|---|---|---|
| 1 | Sign up at https://sentry.io | Catch crashes in production |
| 2 | Get WhatsApp Business API access (Meta or Twilio) | Reminder messages |
| 3 | Firebase project for FCM | Push notifications |
| 4 | DigitalOcean Spaces buckets | Proof photo + backup storage |
| 5 | Add DNS A records for `api.maa-iq.com` + `daari-admin.phi-bit.com` | Public access |
| 6 | Run the VPS bootstrap (it'll install Postgres+Redis+nginx) | Needs server root |
| 7 | Capture 4-8 screenshots per app from BlueStacks | Play Store requires them |

Everything else (deploy, build, configure) is automated by scripts in
this repo. Estimated total wall time once external accounts are ready:
**2 days of focused work**.
