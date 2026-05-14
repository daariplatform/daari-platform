import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, NotificationKind, NotificationStatus } from '@prisma/client';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';

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
  async send(input: SendInput) {
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
}
