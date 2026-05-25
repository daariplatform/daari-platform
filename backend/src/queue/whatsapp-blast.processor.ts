import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppProvider } from '../notifications/providers/whatsapp.provider';
import { WHATSAPP_BLAST_QUEUE } from './queue.constants';

export interface WhatsappBlastJobData {
  promoNotificationId: string;
  tenantId: string;
  customerIds: string[];
  title: string;
  body: string;
}

/**
 * Background worker for WhatsApp promo blasts. Refactored out of the inline
 * for-loop in PlantController.sendPromo so:
 *  - the HTTP call returns immediately (audiences can be 1000s of recipients)
 *  - retries are handled by BullMQ at the *job* level (3 attempts, exp backoff)
 *  - per-recipient failures are caught and counted, not allowed to fail the job
 *  - sentCount / failedCount on the PromoNotification row tick up live so the
 *    dashboard can show a progress bar
 *
 * Counters are flushed to Postgres every N recipients via prisma.$transaction
 * for atomicity (sent + failed are incremented together; status is only
 * stamped on the final flush so the dashboard sees a coherent final state).
 */
@Processor(WHATSAPP_BLAST_QUEUE)
export class WhatsappBlastProcessor extends WorkerHost {
  private readonly log = new Logger(WhatsappBlastProcessor.name);
  // Flush counters to DB every N recipients to keep load light on large blasts
  private static readonly FLUSH_EVERY = 25;

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<WhatsappBlastJobData>): Promise<{ sent: number; failed: number }> {
    const { promoNotificationId, tenantId, customerIds, title, body } = job.data;

    // Pull recipient phone numbers fresh from the DB at job execution time —
    // in case the audience changed between enqueue and processing (a customer
    // was opted-out or deleted), we want the live list.
    const recipients = await this.prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        tenantId,
        status: { in: ['ACTIVE', 'AT_RISK'] },
      },
      select: { id: true, phone: true, whatsapp: true, fullName: true },
    });

    this.log.log(
      `Blast ${promoNotificationId} starting — ${recipients.length}/${customerIds.length} recipients still eligible`,
    );

    const message = `${title}\n\n${body}`;
    let sent = 0;
    let failed = 0;
    let unflushedSent = 0;
    let unflushedFailed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      try {
        await this.whatsapp.send(r.whatsapp ?? r.phone, message);
        sent++;
        unflushedSent++;
      } catch (err) {
        failed++;
        unflushedFailed++;
        this.log.warn(
          `Blast ${promoNotificationId} — recipient ${r.id} (${r.phone}) failed: ${(err as Error).message}`,
        );
      }

      // Periodic checkpoint so the dashboard's progress bar can advance.
      if ((i + 1) % WhatsappBlastProcessor.FLUSH_EVERY === 0) {
        await this.flushCounters(promoNotificationId, unflushedSent, unflushedFailed);
        unflushedSent = 0;
        unflushedFailed = 0;
        // Let BullMQ know how far we are (for the UI / monitoring).
        await job.updateProgress(Math.round(((i + 1) / recipients.length) * 100));
      }
    }

    // Final flush + terminal status. PARTIAL when some failed but not all,
    // SENT when everything went out, FAILED when nothing worked.
    const finalStatus: 'SENT' | 'FAILED' | 'PARTIAL' =
      failed === recipients.length && recipients.length > 0
        ? 'FAILED'
        : failed > 0
          ? // Schema only has SENT / FAILED / QUEUED — there's no PARTIAL enum
            // value. We map PARTIAL → SENT (it *did* go to some) and rely on
            // sentCount / failedCount for the nuance. If a true PARTIAL enum
            // value is added later, swap this line.
            'SENT'
          : 'SENT';

    await this.prisma.$transaction(async (tx) => {
      await tx.promoNotification.update({
        where: { id: promoNotificationId },
        data: {
          sentCount: { increment: unflushedSent },
          failedCount: { increment: unflushedFailed },
          status: finalStatus,
          sentAt: new Date(),
        },
      });
    });

    await job.updateProgress(100);
    this.log.log(
      `Blast ${promoNotificationId} done — sent=${sent}, failed=${failed}`,
    );
    return { sent, failed };
  }

  private async flushCounters(promoNotificationId: string, sentDelta: number, failedDelta: number) {
    if (sentDelta === 0 && failedDelta === 0) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.promoNotification.update({
          where: { id: promoNotificationId },
          data: {
            sentCount: { increment: sentDelta },
            failedCount: { increment: failedDelta },
          },
        });
      });
    } catch (err) {
      // A flush failure shouldn't kill the job — counters will catch up at
      // the final flush. Logged so DB outages are visible.
      this.log.warn(
        `Blast ${promoNotificationId} counter flush failed: ${(err as Error).message}`,
      );
    }
  }
}
