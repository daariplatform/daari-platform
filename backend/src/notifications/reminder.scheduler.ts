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

    for (const c of dueForReminder) {
      const body = `مرحباً ${c.fullName}، خزان مياه ${tenantName} لم يُعبأ منذ فترة. اطلب تعبئة بالرد على هذه الرسالة أو عبر التطبيق.`;
      await this.notifications.send({
        tenantId,
        recipient: c.whatsapp ?? c.phone,
        body,
        kind: NotificationKind.REFILL_REMINDER,
      });
    }

    for (const c of atRisk) {
      const body = `تنبيه: عميلنا العزيز ${c.fullName}، لم تتم تعبئة خزان ${tenantName} منذ أكثر من شهر. الرجاء طلب تعبئة قبل ${reclaimWindowDays()} أيام لتجنب سحب الخزان.`;
      await this.notifications.send({
        tenantId,
        recipient: c.whatsapp ?? c.phone,
        body,
        kind: NotificationKind.REFILL_WARNING,
      });
    }

    this.log.log(
      `Tenant ${tenantId}: ${dueForReminder.length} reminders + ${atRisk.length} warnings sent`,
    );
  }
}

function reclaimWindowDays() {
  const total = Number(process.env.TANK_RECLAIM_DAYS ?? 45);
  const warn = Number(process.env.REMINDER_WARNING_DAYS ?? 35);
  return Math.max(total - warn, 1);
}
