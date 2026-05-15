# Daari Water — `/root/PROJECTS.md` entry

Append this block to `/root/PROJECTS.md` on the VPS **before** running the
bootstrap script. It claims the slug, ports, paths, and database name so
no other project on this multi-tenant VPS can accidentally collide with
us.

```markdown
### 5. Daari Water (water-plant SaaS edition of داري)

- **Path**: /var/www/daari-water-api  +  /var/www/daari-water-dashboard
- **User**: daari-water (separate Linux user, NOT the existing `daari`
  user — that one belongs to Dar Al-Safari)
- **Ports**:
  - 3004 — API (NestJS, daari-water-api.service)
  - 3005 — Dashboard (Next.js, daari-water-dashboard.service)
- **Process manager**: systemd
- **Nginx vhosts**:
  - /etc/nginx/sites-enabled/daari-water-api    → api.phi-bit.com
  - /etc/nginx/sites-enabled/daari-water-dashboard → daari-admin.phi-bit.com
- **SSL**:
  - /etc/letsencrypt/live/api.phi-bit.com/
  - /etc/letsencrypt/live/daari-admin.phi-bit.com/
- **Tech**: NestJS 10 + Next.js 14 + Postgres 16 (shared system instance,
  role `daari_water`, database `daari_water`) + Redis (shared) + PostGIS
- **DB credentials**: /root/daari-water-db-credentials.txt
  (NEVER touch from another project — also never commit to git)
- **Mac mirror**: ~/Downloads/maa-platform
- **GitHub**: https://github.com/a7medal3ni/daari-platform
- **Deploy**: ./deploy/deploy.sh both (from Mac)
- **Backup**: /usr/local/sbin/daari-water-backup-db.sh (cron 03:00 UTC)
- **Status**: 🟡 STAGING · first deploy in progress
```

Also update the **Port allocation** section by changing:

```diff
 - **3000** — RESERVED Daari
-- **3001** — available
+- **3001** — RESERVED Dr.Cars API (drcars-api.service, listening already)
 - **3002** — available
 - **3003** — RESERVED PhiBit
-- **3004-3010** — available for new projects (claim before use)
+- **3004** — RESERVED Daari Water API (daari-water-api.service)
+- **3005** — RESERVED Daari Water Dashboard (daari-water-dashboard.service)
+- **3006-3010** — available for new projects (claim before use)
```

(The 3001 fix is just bringing the registry up to date — it was already
in use by drcars-api but registry said "available". Worth catching.)
