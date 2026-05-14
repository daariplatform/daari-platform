import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TankCapacity, TankStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

interface CreateTankInput {
  serialNumber: string;
  capacity: TankCapacity;
}

@Injectable()
export class TanksService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateTankInput) {
    const qrCode = `MAA-${tenantId.slice(0, 6)}-${randomUUID().slice(0, 8)}`.toUpperCase();
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
   * Three distinct failure modes — keep them distinct so the driver app
   * shows the correct error message instead of a generic "not found":
   *  - QR doesn't exist anywhere  → invalid QR
   *  - QR belongs to another plant → cross-tenant violation
   *  - QR exists in this plant but unassigned → no customer to refill
   */
  async findByQr(tenantId: string, qrCode: string) {
    const tankAnywhere = await this.prisma.tank.findUnique({
      where: { qrCode },
      include: { customer: true, tenant: { select: { id: true, name: true } } },
    });
    if (!tankAnywhere) {
      throw new NotFoundException('QR code does not match any tank');
    }
    if (tankAnywhere.tenantId !== tenantId) {
      throw new ForbiddenException(
        `This tank belongs to another plant (${tankAnywhere.tenant.name}). ` +
          `Per inter-plant agreement, you may not refill it.`,
      );
    }
    if (!tankAnywhere.customerId) {
      throw new BadRequestException('Tank exists but is not assigned to a customer');
    }
    return tankAnywhere;
  }
}
