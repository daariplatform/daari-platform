# PROJECTS.md entry — Daari Water

On a **shared VPS** (e.g. the multi-tenant Phi-Bit box that also runs other
production projects), `vps-bootstrap.sh` and `deploy.sh` refuse to touch the
server unless `/root/PROJECTS.md` lists this project. This is a safety
convention so we never clobber another project's dirs / services / nginx vhosts.

On a **fresh dedicated server** you don't need this — there is no
`/root/PROJECTS.md`, so both scripts treat the box as dedicated and skip the
check automatically (or pass `SKIP_REGISTRY_CHECK=1`).

## What to append to `/root/PROJECTS.md` (shared server only)

Append this single line (create the file if it doesn't exist):

```
daari-water | Daari Water SaaS | dirs: /var/www/daari-water-* | services: daari-water-api, daari-water-dashboard | db: daari_water (postgres) | nginx: api.phi-bit.com, daari-admin.phi-bit.com
```

One-liner to add it on the server:

```bash
echo 'daari-water | Daari Water SaaS | dirs: /var/www/daari-water-* | services: daari-water-api, daari-water-dashboard | db: daari_water (postgres) | nginx: api.phi-bit.com, daari-admin.phi-bit.com' >> /root/PROJECTS.md
```

Then re-run `bash deploy/vps-bootstrap.sh`.
