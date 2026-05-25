import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TankCapacity, TankStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

interface CreateTankInput {
  serialNumber: string;
  capacity: TankCapacity;
  qrCode?: string;
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

  list(tenantId: string, status?: TankStatus) {
    return this.prisma.tank.findMany({
      where: { tenantId, ...(status && { status }) },
      include: { customer: { select: { id: true, fullName: true, phone: true, district: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  inventory(tenantId: string) {
    return this.prisma.tank.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
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

  async reclaim(tenantId: string, tankId: string) {
    const tank = await this.prisma.tank.findFirst({ where: { id: tankId, tenantId } });
    if (!tank) throw new NotFoundException('Tank not found');
    return this.prisma.tank.update({
      where: { id: tankId },
      data: {
        customerId: null,
        status: TankStatus.RECLAIMED,
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
