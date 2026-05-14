import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationKind,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Daily run that nudges plant owners as their monthly subscription nears
 * expiry. We use four windows so the reminder cadence escalates:
 *
 *   - 14 days out → gentle FYI ("your renewal is coming up")
 *   - 7 days out  → action prompt
 *   - 3 days out  → final warning, link to renew
 *   - day after expiry → account suspended message, link to reactivate
 *
 * Each tenant gets at most one message per window per cycle. To avoid
 * spamming on every cron tick, we check NotificationLog for an existing
 * record of that (tenant, kind, current subscription) tuple.
 */
@Injectable()
export class SubscriptionReminderScheduler {
  private readonly log = new Logger(SubscriptionReminderScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async runDaily() {
    this.log.log('Subscription reminder tick');

    const active = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
      },
      include: {
        tenant: {
          select: { id: true, name: true, ownerName: true, ownerPhone: true, status: true },
        },
      },
    });

    for (const sub of active) {
      const daysLeft = Math.ceil(
        (sub.endsAt.getTime() - Date.now()) / 86_400_000,
      );

      let kind: NotificationKind | null = null;
      let body: string | null = null;

      if (daysLeft === 14) {
        kind = NotificationKind.SUBSCRIPTION_REMINDER_14D;
        body = `تذكير ودّي: اشتراك ${sub.tenant.name} في منصة ماء ينتهي بعد ١٤ يوم. السعر للتجديد: ${fmt(sub.priceIqd)}. لا حاجة لإجراء الآن — هذا للعلم.`;
      } else if (daysLeft === 7) {
        kind = NotificationKind.SUBSCRIPTION_REMINDER_7D;
        body = `تذكير: اشتراك ${sub.tenant.name} ينتهي بعد ٧ أيام. جدّد الآن لتجنّب توقف الخدمة. مبلغ التجديد: ${fmt(sub.priceIqd)}.`;
      } else if (daysLeft === 3) {
        kind = NotificationKind.SUBSCRIPTION_EXPIRING_3D;
        body = `⚠️ تنبيه هام: اشتراك ${sub.tenant.name} ينتهي بعد ٣ أيام. عند الانتهاء سيتم تعليق الحساب تلقائياً. جدّد الآن من اللوحة.`;
      } else if (daysLeft === -1) {
        kind = NotificationKind.SUBSCRIPTION_EXPIRED;
        body = `انتهى اشتراك ${sub.tenant.name} أمس. تم تعليق الحساب. لإعادة التفعيل، جدّد الاشتراك من لوحة المعمل.`;
        // Side effect: actually suspend the tenant if not already.
        if (sub.tenant.status !== TenantStatus.SUSPENDED) {
          await this.prisma.tenant.update({
            where: { id: sub.tenant.id },
            data: { status: TenantStatus.SUSPENDED },
          });
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          });
        }
      }

      if (!kind || !body) continue;

      // Don't double-send: skip if a message of this kind already exists for
      // this tenant since the subscription started.
      const alreadySent = await this.prisma.notificationLog.findFirst({
        where: {
          tenantId: sub.tenantId,
          kind,
          createdAt: { gte: sub.startsAt },
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      await this.notifications.send({
        tenantId: sub.tenantId,
        recipient: sub.tenant.ownerPhone,
        body,
        kind,
      });

      this.log.log(`Sent ${kind} to ${sub.tenant.ownerPhone} (${sub.tenant.name})`);
    }
  }
}

function fmt(iqd: number) {
  return new Intl.NumberFormat('en-US').format(iqd) + ' د.ع';
}
