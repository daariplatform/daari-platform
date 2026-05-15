import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverStatus, RefillOrderStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

interface CreateDriverInput {
  fullName: string;
  phone: string;
  /**
   * Optional. Omit to auto-generate. The plain value is returned ONCE
   * in the response so the plant admin can hand it to the driver.
   */
  password?: string;
  vehiclePlate?: string;
  baseSalaryIqd?: number;
  commissionPerRefillIqd?: number;
}

// Same alphabet/length as customers — see CustomersService for rationale.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateDriverInput) {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new ConflictException('A user with this phone already exists');
    }

    const plainPassword = input.password ?? generatePassword();
    const passwordHash = await argon2.hash(plainPassword);

    const driver = await this.prisma.$transaction(async (tx) => {
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

    // tempPassword is returned ONLY in this response so the dashboard
    // can display it to the plant admin to hand to the driver.
    return { ...driver, tempPassword: plainPassword };
  }

  /**
   * Plant admin resets a driver's password. Returns the new plain value
   * ONCE, and revokes existing refresh tokens so any active worker-app
   * session signs out immediately.
   */
  async resetPassword(tenantId: string, driverId: string, newPassword?: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const plainPassword = newPassword ?? generatePassword();
    const passwordHash = await argon2.hash(plainPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: driver.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: driver.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true, tempPassword: plainPassword };
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
