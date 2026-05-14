import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverStatus, RefillOrderStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

interface CreateDriverInput {
  fullName: string;
  phone: string;
  password: string;
  vehiclePlate?: string;
  baseSalaryIqd?: number;
  commissionPerRefillIqd?: number;
}

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateDriverInput) {
    const passwordHash = await argon2.hash(input.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: input.phone,
          passwordHash,
          fullName: input.fullName,
          role: UserRole.DRIVER,
          tenantId,
        },
      });
      return tx.driver.create({
        data: {
          tenantId,
          userId: user.id,
          vehiclePlate: input.vehiclePlate,
          baseSalaryIqd: input.baseSalaryIqd ?? 0,
          commissionPerRefillIqd: input.commissionPerRefillIqd ?? 0,
        },
        include: { user: { select: { fullName: true, phone: true } } },
      });
    });
  }

  list(tenantId: string) {
    return this.prisma.driver.findMany({
      where: { tenantId },
      include: { user: { select: { fullName: true, phone: true, isActive: true } } },
      orderBy: { hiredAt: 'desc' },
    });
  }

  /**
   * Driver app calls this every ~30s to update their location.
   * We update the denormalized current* fields on Driver and append a history row.
   */
  async pingLocation(driverId: string, lng: number, lat: number) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.driver.update({
        where: { id: driverId },
        data: { currentLng: lng, currentLat: lat, lastLocationAt: now },
      }),
      this.prisma.driverLocation.create({
        data: { driverId, lng, lat, recordedAt: now },
      }),
    ]);
  }

  async setStatus(driverId: string, status: DriverStatus) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
    });
  }

  async getMyDriverProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  /**
   * Performance breakdown for a driver in a given month — used for the
   * driver detail screen and salary calculation.
   */
  async performance(tenantId: string, driverId: string, periodStart: Date, periodEnd: Date) {
    const orders = await this.prisma.refillOrder.groupBy({
      by: ['kind', 'status'],
      where: {
        tenantId,
        driverId,
        completedAt: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
      _sum: { paidAmountIqd: true },
    });

    const completedRefills = orders
      .filter((r) => r.status === RefillOrderStatus.COMPLETED && r.kind === 'REFILL')
      .reduce((s, r) => s + r._count._all, 0);

    const collected = orders
      .filter((r) => r.status === RefillOrderStatus.COMPLETED)
      .reduce((s, r) => s + (r._sum.paidAmountIqd ?? 0), 0);

    return { completedRefills, collectedIqd: collected, breakdown: orders };
  }
}
