# maa-platform — VPS Deployment Plan

**Goal:** Deploy `maa-platform/backend` (NestJS) + `dashboard` (Next.js) as a NEW service on the existing VPS (`45.84.138.119`). Keep daari-water-api and other projects untouched.

## Slug & Port Allocation

Per `/root/PROJECTS.md` registry on VPS, ports 3006-3009 are available. Reserve:

| Service | Port | Domain | systemd unit |
|---|---|---|---|
| `maa-api` (NestJS backend) | **3006** | `maa-api.phi-bit.com` | `maa-api.service` |
| `maa-dashboard` (Next.js admin) | **3007** | `maa-admin.phi-bit.com` | `maa-dashboard.service` |
| `maa-uploads` (nginx static) | — | `maa-api.phi-bit.com/uploads/` | nginx alias to `/var/maa-uploads/` |

Linux user: `maa-platform` (isolated from `daari`, `daari-water`, `drcars`, etc.).

## Database

- Postgres database: `maa_platform`
- Role: `maa_platform` with own password
- Reuses existing Postgres instance on VPS (no new install)
- Migrations: `prisma migrate deploy` after first deploy

## DNS (Cloudflare — phi-bit.com)

Two new A records pointing to `45.84.138.119`:
- `maa-api.phi-bit.com`
- `maa-admin.phi-bit.com`

## nginx vhosts

Two new files in `/etc/nginx/sites-available/`:
- `maa-api` → proxy `127.0.0.1:3006`, with `location /uploads/ { alias /var/maa-uploads/; }`
- `maa-dashboard` → proxy `127.0.0.1:3007`

Both with SSL via certbot --nginx.

## systemd units

Mirror `daari-water-api.service` template:
- `maa-api.service` — Node + NestJS dist, `User=maa-platform`, `ReadWritePaths=/var/www/maa-platform-api /var/maa-uploads /var/log/maa-platform`, `MemoryMax=1.5G`
- `maa-dashboard.service` — Node + Next.js, similar hardening

## Env vars

`/var/www/maa-platform-api/.env`:
- `DATABASE_URL=postgresql://maa_platform:<pass>@localhost:5432/maa_platform`
- `JWT_SECRET=<32 chars random>`
- `JWT_REFRESH_SECRET=<another 32 chars>`
- `PORT=3006`
- `APP_URL=https://maa-api.phi-bit.com`
- `UPLOADS_DIR=/var/maa-uploads`
- `SENTRY_DSN=<from existing Sentry org, new project "maa-platform-api">`

`/var/www/maa-platform-dashboard/.env.production`:
- `NEXT_PUBLIC_API_BASE_URL=https://maa-api.phi-bit.com/api/v1`
- `PORT=3007`

## Mobile app update

After backend is live:
1. Update `mobile-customer/app.json` → `extra.apiBaseUrl = "https://maa-api.phi-bit.com/api/v1"`
2. Update `mobile-customer/.env.production` similar
3. Rebuild iOS + Android (Debug for dev, Release for Play Store)

## Step-by-step execution

1. **DNS** — add 2 A records on Cloudflare *(must do via owner browser session)*
2. **Postgres** — create DB + role on VPS:
   ```bash
   ssh root@VPS 'sudo -u postgres psql -c "CREATE USER maa_platform WITH PASSWORD '"'"'<pass>'"'"';"'
   ssh root@VPS 'sudo -u postgres psql -c "CREATE DATABASE maa_platform OWNER maa_platform;"'
   ```
3. **Linux user** — create `maa-platform` user on VPS
4. **Build backend locally** — `cd backend && npm run build`
5. **rsync to VPS** — `/var/www/maa-platform-api/`
6. **Prisma migrate** — `cd /var/www/maa-platform-api && npx prisma migrate deploy && npx prisma db seed`
7. **systemd unit** — create + enable + start `maa-api.service`
8. **Build dashboard locally** — `cd dashboard && npm run build`
9. **rsync to VPS** — `/var/www/maa-platform-dashboard/`
10. **systemd unit** — `maa-dashboard.service`
11. **nginx** — two vhosts, certbot SSL, reload
12. **Update PROJECTS.md** on VPS — add `maa-platform` section
13. **Smoke test** — curl `/health`, login flow on dashboard, test order from mobile
14. **Update mobile app** — `apiBaseUrl` → rebuild → reinstall on simulator
15. **Update memory** — note that maa-platform is now deployed

## Risk & rollback

- New service — won't impact existing daari/drcars/doctorhub
- nginx config tested with `nginx -t` before reload
- systemd unit can be stopped instantly: `systemctl stop maa-api`
- Database is fresh, no migration of existing data needed
- Mobile app rebuild can be reverted by pointing apiBaseUrl back to old URL

## Estimated time

- DNS: 5 min (manual)
- DB + user + rsync + migrate: 10 min
- systemd + nginx + SSL: 15 min
- Smoke test + mobile rebuild: 20 min
- Memory + PROJECTS.md updates: 5 min
- **Total: ~1 hour** assuming no surprises

## What I need from you

1. Confirm: proceed with deployment now?
2. DNS records on Cloudflare — I cannot edit DNS, you'll need to add them via the dashboard
3. Confirm port allocation 3006 + 3007 is fine (per PROJECTS.md they're available)
