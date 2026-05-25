import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverStatus, RefillOrderStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

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

  async list(
    tenantId: string,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<any>> {
    const where = { tenantId };
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        include: { user: { select: { fullName: true, phone: true, isActive: true } } },
        orderBy: { hiredAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.driver.count({ where }),
    ]);
    return paginated(items, total, { page, pageSize });
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

  /**
   * Live locations of all drivers in the tenant. Returns last known
   * position + an `inactive` flag (true if no location update in 30+
   * minutes while shift should be running). Dashboard polls this every
   * ~15s for the live map.
   */
  async liveLocations(tenantId: string) {
    const INACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    const drivers = await this.prisma.driver.findMany({
      where: { tenantId },
      select: {
        id: true,
        status: true,
        currentLng: true,
        currentLat: true,
        lastLocationAt: true,
        vehiclePlate: true,
        user: { select: { fullName: true, phone: true } },
      },
    });
    return drivers.map((d) => {
      const ageMs = d.lastLocationAt ? now - d.lastLocationAt.getTime() : null;
      return {
        id: d.id,
        fullName: d.user.fullName,
        phone: d.user.phone,
        vehiclePlate: d.vehiclePlate,
        status: d.status,
        currentLng: d.currentLng,
        currentLat: d.currentLat,
        lastLocationAt: d.lastLocationAt,
        lastSeenMinutesAgo: ageMs != null ? Math.floor(ageMs / 60_000) : null,
        // علم inactive: السائق في وردية لكن ما رسل موقع لأكثر من ٣٠ دقيقة
        inactive:
          d.status !== 'OFFLINE' &&
          d.status !== 'ON_BREAK' &&
          (ageMs == null || ageMs > INACTIVE_THRESHOLD_MS),
      };
    });
  }

  /**
   * Full GPS trail for a driver on a specific date (YYYY-MM-DD). Returns
   * ordered list of {lng, lat, recordedAt} for the dashboard to draw a
   * polyline on the map. Default = today.
   */
  async routeForDate(tenantId: string, driverId: string, dateStr?: string) {
    const day = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // أمن: تأكد إن السائق فعلاً ضمن tenant المتصل
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
      select: { id: true },
    });
    if (!driver) return { points: [], totalKm: 0 };

    const points = await this.prisma.driverLocation.findMany({
      where: {
        driverId,
        recordedAt: { gte: start, lt: end },
      },
      orderBy: { recordedAt: 'asc' },
      select: { lng: true, lat: true, recordedAt: true },
    });

    // مسافة الـ route التراكمية بالكيلومترات (Haversine بين كل نقطتين)
    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      totalKm += haversineKm(
        points[i - 1].lat,
        points[i - 1].lng,
        points[i].lat,
        points[i].lng,
      );
    }

    return { points, totalKm: Math.round(totalKm * 10) / 10 };
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
