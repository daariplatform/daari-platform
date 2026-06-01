import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { RefillOrderKind, RefillOrderStatus } from '@prisma/client';
import { advanceByCadence } from './scheduled-orders.service';

/**
 * Materialises recurring auto-refill orders. Runs every 5 minutes (we don't
 * need second-level precision — a refill that fires a few minutes late is
 * fine). For each ScheduledOrder that is active and due (`nextRunAt <= now`):
 *
 *   1. Skip if the customer already has an active refill (PENDING / ASSIGNED
 *      / EN_ROUTE) — never stack a second auto-order on top of an open one.
 *   2. Create a real RefillOrder via OrdersService.create (so it reuses the
 *      same pricing snapshot, promo, and auto-assign logic as manual orders).
 *   3. Stamp lastRunAt = now and advance nextRunAt by the cadence.
 *
 * Each schedule is processed independently and defensively — a failure on
 * one (e.g. plan-limit reached, no tank) is logged and skipped so it doesn't
 * abort the rest of the batch. nextRunAt is still advanced on a skip so the
 * job doesn't hammer the same due row every 5 minutes.
 */
@Injectable()
export class ScheduledOrdersProcessor {
  private readonly log = new Logger(ScheduledOrdersProcessor.name);

  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDueSchedules() {
    const now = new Date();
    const due = await this.prisma.scheduledOrder.findMany({
      where: { active: true, nextRunAt: { lte: now } },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        cadence: true,
        nextRunAt: true,
      },
    });
    if (due.length === 0) return;

    this.log.log(`[scheduled-orders] processing ${due.length} due schedule(s)`);

    for (const sched of due) {
      try {
        const activeRefill = await this.prisma.refillOrder.findFirst({
          where: {
            tenantId: sched.tenantId,
            customerId: sched.customerId,
            kind: RefillOrderKind.REFILL,
            status: {
              in: [
                RefillOrderStatus.PENDING,
                RefillOrderStatus.ASSIGNED,
                RefillOrderStatus.EN_ROUTE,
              ],
            },
          },
          select: { id: true },
        });

        if (!activeRefill) {
          await this.orders.create(sched.tenantId, {
            customerId: sched.customerId,
            kind: RefillOrderKind.REFILL,
          });
        } else {
          this.log.debug(
            `[scheduled-orders] skip ${sched.id} — customer ${sched.customerId} has active refill`,
          );
        }
      } catch (err) {
        // Plan limit reached, no tank assigned, duplicate-active race, etc.
        // Log and move on; nextRunAt is still advanced below so we don't
        // retry the same row every 5 minutes.
        this.log.warn(
          `[scheduled-orders] schedule ${sched.id} failed: ${(err as Error).message}`,
        );
      }

      // Advance regardless of whether an order was created — a skip is a
      // legitimate "this cycle is handled" outcome, and advancing prevents a
      // hot loop on the same due row.
      await this.prisma.scheduledOrder
        .update({
          where: { id: sched.id },
          data: {
            lastRunAt: now,
            nextRunAt: advanceByCadence(now, sched.cadence),
          },
        })
        .catch((err) =>
          this.log.warn(
            `[scheduled-orders] advance ${sched.id} failed: ${(err as Error).message}`,
          ),
        );
    }
  }
}
