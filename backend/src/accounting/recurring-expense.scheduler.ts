import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AccountingService } from './accounting.service';

/**
 * Daily 06:00 Asia/Baghdad tick that converts every due RecurringExpense
 * into an actual Expense row and advances its nextDueAt by the cadence.
 *
 * The service-level `materialiseRecurring()` is idempotent up to the
 * cadence — if the scheduler missed several days (server outage) it
 * still creates only one Expense per recurring row and jumps nextDueAt
 * straight to the next future tick. Better than backfilling and
 * surprising the owner with a wall of duplicate expenses.
 *
 * Cron: `0 6 * * *` in Asia/Baghdad. The VPS already runs in +03 so the
 * Cron timezone is implicit; we set it explicitly here as belt + braces
 * (matches the convention in other schedulers).
 */
@Injectable()
export class RecurringExpenseScheduler {
  private readonly log = new Logger(RecurringExpenseScheduler.name);

  constructor(private accounting: AccountingService) {}

  @Cron('0 6 * * *', { timeZone: 'Asia/Baghdad' })
  async runDaily() {
    const start = Date.now();
    try {
      const { created } = await this.accounting.materialiseRecurring();
      this.log.log(`Materialised ${created} recurring expense(s) in ${Date.now() - start}ms`);
    } catch (e) {
      this.log.error(`Recurring expense materialise failed: ${(e as Error).message}`);
    }
  }
}
