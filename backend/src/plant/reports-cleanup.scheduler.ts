import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { join } from 'node:path';
import { readdir, stat, rm } from 'node:fs/promises';

/**
 * Deletes generated report files (xlsx/pdf under `UPLOADS_DIR/reports/`) once
 * they pass the advertised expiry.
 *
 * The export endpoint returns a 24-hour `expiresAt`, but nothing enforced it —
 * the PII-bearing files (customer names / phones / districts, protected only by
 * an unguessable UUID path) lingered on disk indefinitely. This hourly sweep
 * bounds the exposure window to the retention period.
 *
 * NOTE (M-S4, partial): the files are still served by nginx WITHOUT
 * authentication. Moving `/uploads/reports/` behind an authenticated NestJS
 * route is a separate product decision; this scheduler is the retention/cleanup
 * half of the fix and touches only the reports subtree (never `proof/`, which
 * holds permanent delivery-proof photos).
 */
@Injectable()
export class ReportsCleanupScheduler {
  private readonly log = new Logger(ReportsCleanupScheduler.name);

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    const uploadsDir = process.env.UPLOADS_DIR ?? '/var/uploads';
    const reportsRoot = join(uploadsDir, 'reports');
    const maxAgeMs =
      Number(process.env.REPORT_RETENTION_HOURS ?? 24) * 3_600_000;
    const cutoff = Date.now() - maxAgeMs;

    let tenantDirs: string[];
    try {
      tenantDirs = await readdir(reportsRoot);
    } catch {
      return; // reports dir doesn't exist yet — nothing to clean
    }

    let deleted = 0;
    for (const tenant of tenantDirs) {
      const dir = join(reportsRoot, tenant);
      let files: string[];
      try {
        files = await readdir(dir);
      } catch {
        continue;
      }
      for (const file of files) {
        const full = join(dir, file);
        try {
          const s = await stat(full);
          if (s.isFile() && s.mtimeMs < cutoff) {
            await rm(full);
            deleted++;
          }
        } catch {
          // best effort — skip anything we can't stat/remove
        }
      }
    }
    if (deleted > 0) {
      this.log.log(`Deleted ${deleted} expired report file(s)`);
    }
  }
}
