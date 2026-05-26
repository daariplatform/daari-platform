import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TankCapacity, TankReclaimReason, TankStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

interface CreateTankInput {
  serialNumber: string;
  capacity: TankCapacity;
  qrCode?: string;
}

interface ReclaimTankInput {
  reason: TankReclaimReason;
  notes?: string;
  reclaimedByDriverId?: string;
}

@Injectable()
export class TanksService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateTankInput) {
    // Prefer the operator-supplied code so printed stickers can stay short
    // and human-readable (T-1001, T-1002 …). Fall back to a long unique
    // code only when nothing was provided.
    const qrCode =
      input.qrCode?.trim() ||
      `MAA-${tenantId.slice(0, 6)}-${randomUUID().slice(0, 8)}`.toUpperCase();

    // Per-tenant uniqueness guard. The schema already enforces this
    // (@@unique([tenantId, qrCode]) and @@unique([tenantId, serialNumber]))
    // but checking up front gives a friendly Arabic message instead of a
    // raw Prisma P2002 error bubbling to the mobile app.
    const dupe = await this.prisma.tank.findFirst({
      where: {
        tenantId,
        OR: [{ qrCode }, { serialNumber: input.serialNumber }],
      },
      select: { id: true, qrCode: true, serialNumber: true },
    });
    if (dupe) {
      if (dupe.qrCode === qrCode) {
        throw new ConflictException(`رمز QR ${qrCode} مستخدم بالفعل في معملك`);
      }
      throw new ConflictException(
        `رقم تسلسلي ${input.serialNumber} مستخدم بالفعل في معملك`,
      );
    }

    return this.prisma.tank.create({
      data: {
        tenantId,
        serialNumber: input.serialNumber,
        qrCode,
        capacity: input.capacity,
        status: TankStatus.IN_PLANT,
      },
    });
  }

  async list(
    tenantId: string,
    status?: TankStatus,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.TankWhereInput = { tenantId, ...(status && { status }) };
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tank.findMany({
        where,
        include: { customer: { select: { id: true, fullName: true, phone: true, district: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.tank.count({ where }),
    ]);
    return paginated(items, total, { page, pageSize });
  }

  /**
   * Inventory summary used by the mobile-admin "Tanks" tile + the dashboard
   * inventory page. Returns counts keyed by friendly status names so the UI
   * doesn't have to reshape a Prisma `groupBy` payload.
   *
   * Always returns all five buckets — even zeros — so the mobile tile can
   * render skeletons against a stable shape.
   */
  async inventory(tenantId: string) {
    const rows = await this.prisma.tank.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    const counts: Record<TankStatus, number> = {
      IN_PLANT: 0,
      ASSIGNED: 0,
      AT_RISK: 0,
      RECLAIMED: 0,
      DAMAGED: 0,
    };
    for (const r of rows) counts[r.status] = r._count._all;
    return {
      inPlant: counts.IN_PLANT,
      assigned: counts.ASSIGNED,
      atRisk: counts.AT_RISK,
      reclaimed: counts.RECLAIMED,
      damaged: counts.DAMAGED,
      total:
        counts.IN_PLANT +
        counts.ASSIGNED +
        counts.AT_RISK +
        counts.RECLAIMED +
        counts.DAMAGED,
    };
  }

  async assignToCustomer(tenantId: string, tankId: string, customerId: string) {
    const tank = await this.prisma.tank.findFirst({ where: { id: tankId, tenantId } });
    if (!tank) throw new NotFoundException('Tank not found');
    if (tank.status !== TankStatus.IN_PLANT) {
      throw new BadRequestException(`Tank is ${tank.status}, must be IN_PLANT to assign`);
    }
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.tank.update({
      where: { id: tankId },
      data: {
        customerId,
        status: TankStatus.ASSIGNED,
        installedAt: new Date(),
      },
    });
  }

  async reclaim(tenantId: string, tankId: string, input: ReclaimTankInput) {
    const tank = await this.prisma.tank.findFirst({ where: { id: tankId, tenantId } });
    if (!tank) throw new NotFoundException('Tank not found');
    if (tank.status === TankStatus.RECLAIMED) {
      throw new BadRequestException('الخزان مُستَرجَع مسبقاً');
    }

    // TANK_DAMAGED → final state DAMAGED (don't recycle into IN_PLANT).
    // Everything else lands in RECLAIMED and the plant decides next steps.
    const nextStatus =
      input.reason === TankReclaimReason.TANK_DAMAGED
        ? TankStatus.DAMAGED
        : TankStatus.RECLAIMED;

    return this.prisma.tank.update({
      where: { id: tankId },
      data: {
        customerId: null,
        status: nextStatus,
        reclaimedAt: new Date(),
        reclaimReason: input.reason,
        reclaimNotes: input.notes,
        reclaimedByDriverId: input.reclaimedByDriverId,
      },
    });
  }

  /**
   * Look up a tank by its QR code, scoped to the caller's plant.
   *
   * Since QR codes are now per-tenant unique (two plants can legitimately
   * issue T-1001 to different customers), we scope the lookup to the
   * caller's tenant from the start. We deliberately do NOT tell the driver
   * "this tank belongs to another plant" — that would leak existence of
   * cross-tenant data. Just "not in your plant" is the right UX.
   *
   * Two failure modes left:
   *  - QR not in this plant  → unknown to you
   *  - QR in this plant but unassigned → no customer to refill
   */
  async findByQr(tenantId: string, qrCode: string) {
    const tank = await this.prisma.tank.findFirst({
      where: { tenantId, qrCode },
      include: { customer: true },
    });
    if (!tank) {
      throw new NotFoundException(
        `لا يوجد خزان بهذا الرقم (${qrCode}) في معملك`,
      );
    }
    if (!tank.customerId) {
      throw new BadRequestException('Tank exists but is not assigned to a customer');
    }
    return tank;
  }
}
