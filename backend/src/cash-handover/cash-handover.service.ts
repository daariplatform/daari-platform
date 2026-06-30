import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CashHandoverStatus,
  Prisma,
  RefillOrderStatus,
} from '@prisma/client';

interface CreateHandoverInput {
  amountIqd: number;
  note?: string;
  clientRequestId?: string;
}

@Injectable()
export class CashHandoverService {
  constructor(private prisma: PrismaService) {}

  // ── Driver side ─────────────────────────────────────────────────────────

  /** Driver records cash handed to the plant. Created PENDING until the plant confirms. */
  async createForDriver(
    tenantId: string,
    driverId: string,
    input: CreateHandoverInput,
  ) {
    // Idempotency: a retried / double-tapped handover must not record twice.
    // When a clientRequestId is supplied we return the row already created for
    // it; the @@unique([tenantId, clientRequestId]) also guards a race.
    const clientRequestId = input.clientRequestId?.trim() || null;
    if (clientRequestId) {
      const existing = await this.prisma.cashHandover.findFirst({
        where: { tenantId, clientRequestId },
      });
      if (existing) return existing;
    }
    try {
      return await this.prisma.cashHandover.create({
        data: {
          tenantId,
          driverId,
          amountIqd: input.amountIqd,
          note: input.note,
          clientRequestId,
          status: CashHandoverStatus.PENDING,
        },
      });
    } catch (e) {
      if (
        clientRequestId &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.prisma.cashHandover.findFirst({
          where: { tenantId, clientRequestId },
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  /** A driver's own handovers, newest first. */
  listForDriver(driverId: string) {
    return this.prisma.cashHandover.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Today's cash reconciliation for a driver:
   *  - collectedTodayIqd: sum of paidAmountIqd on the driver's COMPLETED
   *    orders completed today (what they took in)
   *  - handedOverTodayIqd: sum of handovers the driver logged today
   *  - pendingIqd: sum of all the driver's handovers still PENDING confirmation
   */
  async summaryForDriver(driverId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [collectedAgg, handedTodayAgg, pendingAgg] = await this.prisma.$transaction([
      this.prisma.refillOrder.aggregate({
        where: {
          driverId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: start, lt: end },
        },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.cashHandover.aggregate({
        where: { driverId, createdAt: { gte: start, lt: end } },
        _sum: { amountIqd: true },
      }),
      this.prisma.cashHandover.aggregate({
        where: { driverId, status: CashHandoverStatus.PENDING },
        _sum: { amountIqd: true },
      }),
    ]);

    return {
      collectedTodayIqd: collectedAgg._sum.paidAmountIqd ?? 0,
      handedOverTodayIqd: handedTodayAgg._sum.amountIqd ?? 0,
      pendingIqd: pendingAgg._sum.amountIqd ?? 0,
    };
  }

  // ── Plant side ──────────────────────────────────────────────────────────

  /** Tenant handovers with driver name, optionally filtered by status. Newest first. */
  async listForTenant(tenantId: string, status?: CashHandoverStatus) {
    const where: Prisma.CashHandoverWhereInput = {
      tenantId,
      ...(status && { status }),
    };
    const rows = await this.prisma.cashHandover.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { id: true, user: { select: { fullName: true } } } },
      },
    });
    return rows.map((h) => ({
      id: h.id,
      driverId: h.driverId,
      driverName: h.driver?.user?.fullName ?? null,
      amountIqd: h.amountIqd,
      note: h.note,
      status: h.status,
      createdAt: h.createdAt,
      confirmedAt: h.confirmedAt,
    }));
  }

  /** Plant confirms receipt of a handover. Tenant-scoped; idempotent on already-confirmed. */
  async confirm(tenantId: string, handoverId: string) {
    const handover = await this.prisma.cashHandover.findFirst({
      where: { id: handoverId, tenantId },
    });
    if (!handover) throw new NotFoundException('Cash handover not found');
    if (handover.status === CashHandoverStatus.CONFIRMED) {
      // Idempotent — return the existing row so a double-tap doesn't error.
      return handover;
    }
    return this.prisma.cashHandover.update({
      where: { id: handoverId },
      data: { status: CashHandoverStatus.CONFIRMED, confirmedAt: new Date() },
    });
  }
}
