import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, NotificationKind, NotificationStatus } from '@prisma/client';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

/**
 * Map a NotificationKind enum to the coarse `type` the mobile-customer
 * notifications screen uses for its icon + color (order|payment|system|promo).
 */
function kindToInboxType(
  kind: NotificationKind,
): 'order' | 'payment' | 'system' | 'promo' {
  switch (kind) {
    case 'ORDER_COMPLETED':
    case 'DRIVER_EN_ROUTE':
    case 'REFILL_REMINDER':
    case 'REFILL_WARNING':
    case 'TANK_RECLAIM_NOTICE':
      return 'order';
    case 'SUBSCRIPTION_REMINDER_14D':
    case 'SUBSCRIPTION_REMINDER_7D':
    case 'SUBSCRIPTION_EXPIRING_3D':
    case 'SUBSCRIPTION_EXPIRED':
      return 'system';
    default:
      return 'system';
  }
}

interface SendInput {
  tenantId: string;
  recipient: string;
  body: string;
  kind: NotificationKind;
  channel?: NotificationChannel;
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppProvider,
    private sms: SmsProvider,
  ) {}

  /**
   * Try WhatsApp first (cheaper, richer), fall back to SMS if it fails.
   * Each attempt is logged in NotificationLog so the dashboard can
   * show which messages reached the customer.
   */
  async send(
    input: SendInput,
  ): Promise<{ ok: boolean; id: string; error?: string }> {
    const channel = input.channel ?? NotificationChannel.WHATSAPP;
    const log = await this.prisma.notificationLog.create({
      data: {
        tenantId: input.tenantId,
        channel,
        kind: input.kind,
        recipient: input.recipient,
        body: input.body,
        status: NotificationStatus.QUEUED,
      },
    });

    try {
      const providerId =
        channel === NotificationChannel.WHATSAPP
          ? await this.whatsapp.send(input.recipient, input.body)
          : await this.sms.send(input.recipient, input.body);

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), providerId },
      });
      return { ok: true, id: log.id };
    } catch (err) {
      const errorMsg = (err as Error).message;
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.FAILED, errorMsg },
      });

      if (channel === NotificationChannel.WHATSAPP) {
        this.log.warn(`WhatsApp failed for ${input.recipient}, falling back to SMS`);
        return this.send({ ...input, channel: NotificationChannel.SMS });
      }
      return { ok: false, id: log.id, error: errorMsg };
    }
  }

  recentForTenant(tenantId: string, limit = 100) {
    return this.prisma.notificationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Paginated inbox for the mobile-admin "Notifications" tab. We surface
   * every NotificationLog row scoped to the caller's tenant (low-stock
   * alerts, new leads, near-limit warnings, system messages, plus the
   * outbound WhatsApp/SMS the plant already sees on web).
   *
   * Filters:
   *  - unreadOnly=true → only rows with readAt IS NULL
   */
  async inbox(
    tenantId: string,
    page = 1,
    pageSize = 50,
    unreadOnly = false,
  ): Promise<PaginatedResult<any>> {
    const where = {
      tenantId,
      ...(unreadOnly && { readAt: null }),
    };
    const skip = (page - 1) * pageSize;
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.count({ where: { tenantId, readAt: null } }),
    ]);
    return {
      ...paginated(items, total, { page, pageSize }),
      unreadCount,
    } as PaginatedResult<any> & { unreadCount: number };
  }

  /**
   * Mark a single inbox row as read. Returns the updated row.
   * Idempotent — already-read rows stay with their original readAt.
   */
  async markRead(tenantId: string, id: string) {
    const row = await this.prisma.notificationLog.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('الإشعار غير موجود');
    if (row.readAt) return row;
    return this.prisma.notificationLog.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark every unread inbox row for the tenant as read. Returns the count
   * of rows that were just flipped (excludes rows already read).
   */
  async markAllRead(tenantId: string) {
    const res = await this.prisma.notificationLog.updateMany({
      where: { tenantId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: res.count };
  }

  // ─── Customer inbox ─────────────────────────────────────────────────
  //
  // Customer-scoped variant of the inbox. Filters NotificationLog by the
  // `recipient` column matching the user's phone number (NotificationLog
  // is shared infrastructure that captures any WhatsApp/SMS/push message
  // sent to a phone, regardless of which app surface displays it later).
  // We deliberately don't scope by tenantId here because a single
  // customer can in theory subscribe to multiple plants — the recipient
  // phone is the identity key.

  /**
   * Look up the caller's phone via User → then return paginated inbox of
   * messages addressed to that phone. Same shape as the plant inbox so
   * the mobile client can share rendering logic with the admin app.
   */
  async inboxForCustomer(
    userId: string,
    page = 1,
    pageSize = 50,
    unreadOnly = false,
  ): Promise<PaginatedResult<unknown> & { unreadCount: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const where = {
      recipient: user.phone,
      ...(unreadOnly && { readAt: null }),
    };
    const skip = (page - 1) * pageSize;
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.count({
        where: { recipient: user.phone, readAt: null },
      }),
    ]);
    // Map the raw NotificationLog rows to the shape mobile-customer's
    // notifications screen expects: `read` (boolean from readAt) and `type`
    // (one of order|payment|system|promo, derived from the kind enum).
    // Previously the screen received `readAt`/`kind` and rendered every row
    // as unread with a missing type icon.
    const mapped = items.map((r) => ({
      id: r.id,
      title: r.title ?? '',
      body: r.body,
      read: r.readAt != null,
      createdAt: r.createdAt,
      type: kindToInboxType(r.kind),
    }));
    return {
      ...paginated(mapped, total, { page, pageSize }),
      unreadCount,
    } as PaginatedResult<unknown> & { unreadCount: number };
  }

  /**
   * Mark one inbox row as read FOR THE CALLING CUSTOMER. We verify that
   * the row's `recipient` matches the user's phone — otherwise customer
   * A could mark customer B's notifications as read.
   */
  async markReadForCustomer(userId: string, notificationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const row = await this.prisma.notificationLog.findFirst({
      where: { id: notificationId, recipient: user.phone },
    });
    if (!row) throw new NotFoundException('الإشعار غير موجود');
    if (row.readAt) return row;
    return this.prisma.notificationLog.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /** Customer counterpart of markAllRead — scoped by phone, not tenant. */
  async markAllReadForCustomer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const res = await this.prisma.notificationLog.updateMany({
      where: { recipient: user.phone, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: res.count };
  }

  /**
   * Insert a "system message" into the tenant inbox without sending an
   * external WhatsApp/SMS. Other modules call this to surface things like
   * "Stock dropped below threshold" or "New customer lead". Always
   * channel=PUSH, status=SENT (it's not really an outbound message).
   */
  async createInboxMessage(
    tenantId: string,
    kind: NotificationKind,
    title: string,
    body: string,
  ) {
    return this.prisma.notificationLog.create({
      data: {
        tenantId,
        kind,
        channel: NotificationChannel.PUSH,
        recipient: 'inbox',
        title,
        body,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }
}
