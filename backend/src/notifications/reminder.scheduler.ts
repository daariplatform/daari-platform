import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from './notifications.service';

/**
 * Daily reminder run.
 *
 * Two windows, both per-tenant:
 *   - dueForReminder  (lastRefill > 25 days, < 35 days)  → friendly nudge
 *   - atRisk          (lastRefill > 35 days)             → reclaim warning
 *
 * Customer status is recomputed in `refreshHealthStatuses` before we send,
 * so dashboard counts and message kinds stay consistent.
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly log = new Logger(ReminderSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private customers: CustomersService,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDaily() {
    this.log.log('Reminder scheduler tick');
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        await this.runForTenant(tenant.id, tenant.name);
      } catch (e) {
        this.log.error(`Tenant ${tenant.id} failed: ${(e as Error).message}`);
      }
    }
  }

  async runForTenant(tenantId: string, tenantName: string) {
    const { dueForReminder, atRisk } = await this.customers.refreshHealthStatuses(tenantId);

    // A customer stays dueForReminder / atRisk for the whole window (up to ~10
    // days each), so a naive daily send re-messages the same person every day —
    // burning paid WhatsApp/SMS credits. Suppress a repeat of the same kind to
    // the same recipient within a cooldown (default 7 days). One query per kind
    // builds the "already contacted" set (matches the dedup pattern in
    // subscription-reminder.scheduler).
    const cutoff = new Date(Date.now() - reminderCooldownDays() * 86_400_000);
    const recentLogs = await this.prisma.notificationLog.findMany({
      where: {
        tenantId,
        kind: { in: [NotificationKind.REFILL_REMINDER, NotificationKind.REFILL_WARNING] },
        createdAt: { gte: cutoff },
      },
      select: { recipient: true, kind: true },
    });
    const recentReminder = new Set(
      recentLogs.filter((l) => l.kind === NotificationKind.REFILL_REMINDER).map((l) => l.recipient),
    );
    const recentWarning = new Set(
      recentLogs.filter((l) => l.kind === NotificationKind.REFILL_WARNING).map((l) => l.recipient),
    );

    let reminders = 0;
    for (const c of dueForReminder) {
      const recipient = c.whatsapp ?? c.phone;
      if (recentReminder.has(recipient)) continue;
      const body = `مرحباً ${c.fullName}، خزان مياه ${tenantName} لم يُعبأ منذ فترة. اطلب تعبئة بالرد على هذه الرسالة أو عبر التطبيق.`;
      await this.notifications.send({
        tenantId,
        recipient,
        body,
        kind: NotificationKind.REFILL_REMINDER,
      });
      reminders++;
    }

    let warnings = 0;
    for (const c of atRisk) {
      const recipient = c.whatsapp ?? c.phone;
      if (recentWarning.has(recipient)) continue;
      const body = `تنبيه: عميلنا العزيز ${c.fullName}، لم تتم تعبئة خزان ${tenantName} منذ أكثر من شهر. الرجاء طلب تعبئة قبل ${reclaimWindowDays()} أيام لتجنب سحب الخزان.`;
      await this.notifications.send({
        tenantId,
        recipient,
        body,
        kind: NotificationKind.REFILL_WARNING,
      });
      warnings++;
    }

    this.log.log(
      `Tenant ${tenantId}: ${reminders}/${dueForReminder.length} reminders + ${warnings}/${atRisk.length} warnings sent (rest within cooldown)`,
    );
  }
}

function reclaimWindowDays() {
  const total = Number(process.env.TANK_RECLAIM_DAYS ?? 45);
  const warn = Number(process.env.REMINDER_WARNING_DAYS ?? 35);
  return Math.max(total - warn, 1);
}

// How long to wait before re-sending the same reminder/warning kind to the same
// recipient. Prevents daily spam while a customer sits in the same health band.
function reminderCooldownDays() {
  return Math.max(Number(process.env.REMINDER_COOLDOWN_DAYS ?? 7), 1);
}
