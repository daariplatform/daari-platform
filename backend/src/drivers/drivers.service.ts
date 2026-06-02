import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverStatus, RefillOrderStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';
import { hashPassword } from '../common/crypto';

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
  /** Optional override — defaults to now() if omitted. */
  joinDate?: Date;
}

interface UpdateDriverInput {
  fullName?: string;
  vehiclePlate?: string;
  baseSalaryIqd?: number;
  commissionPerRefillIqd?: number;
  status?: DriverStatus;
  /** Toggles User.isActive — false suspends driver login without deletion. */
  isActive?: boolean;
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
    const passwordHash = await hashPassword(plainPassword);

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
          ...(input.joinDate && { hiredAt: input.joinDate }),
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
    const passwordHash = await hashPassword(plainPassword);

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
    // Flatten the response — mobile-admin's DriverRow expects fullName/phone
    // at the top level + a derived isOnline (true when the driver app pinged
    // GPS in the last 30 min). Without this flatten, the admin driver list
    // renders "?" avatars because driver.fullName is undefined at the top
    // level (it lives under driver.user.fullName).
    const activeSince = Date.now() - 30 * 60 * 1000;
    const flattened = items.map((d: any) => ({
      ...d,
      fullName: d.user?.fullName ?? '',
      phone: d.user?.phone ?? '',
      isOnline: d.lastLocationAt
        ? new Date(d.lastLocationAt).getTime() >= activeSince
        : false,
    }));
    return paginated(flattened, total, { page, pageSize });
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
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      // ضمّ علاقة المستخدم كي يصل اسم السائق للتطبيق (DriverProfile.fromJson
      // يقرأ user.fullName)؛ كانت غائبة فيظهر الاسم فارغاً في كل تطبيق السائق.
      include: { user: { select: { fullName: true, phone: true } } },
    });
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

  /**
   * Partial update for a driver. The plant admin can change vehicle plate,
   * salary, commission, status, or activate/suspend the login without
   * deleting the row. Updates are scoped to the calling tenant.
   */
  async update(tenantId: string, driverId: string, input: UpdateDriverInput) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const driverData: Record<string, unknown> = {};
    if (input.vehiclePlate !== undefined) driverData.vehiclePlate = input.vehiclePlate;
    if (input.baseSalaryIqd !== undefined) driverData.baseSalaryIqd = input.baseSalaryIqd;
    if (input.commissionPerRefillIqd !== undefined) {
      driverData.commissionPerRefillIqd = input.commissionPerRefillIqd;
    }
    if (input.status !== undefined) driverData.status = input.status;

    const userData: Record<string, unknown> = {};
    if (input.fullName !== undefined) userData.fullName = input.fullName;
    if (input.isActive !== undefined) userData.isActive = input.isActive;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: driver.userId }, data: userData });
      }
      return tx.driver.update({
        where: { id: driverId },
        data: driverData,
        include: { user: { select: { fullName: true, phone: true, isActive: true } } },
      });
    });
  }

  /**
   * Soft-delete a driver. We never actually delete — completed RefillOrder
   * rows still reference the driverId for historical accounting. Instead:
   *
   *   1. Flip User.isActive = false so the driver app signs out and can't
   *      log back in.
   *   2. Revoke refresh tokens (force-kill any active session).
   *   3. Move DriverStatus to OFFLINE so the live map drops them.
   *
   * Returns { ok: true } so the mobile app can confirm without re-fetching.
   */
  async softDelete(tenantId: string, driverId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: driver.userId },
        data: { isActive: false },
      }),
      this.prisma.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.OFFLINE },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: driver.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /**
   * Performance summary for the driver detail page in mobile-admin. Use
   * the `period` shortcut (week | month) for the common cases — for an
   * arbitrary window, the dashboard-facing `performance()` method (which
   * takes explicit dates) is the right tool.
   *
   * Returns: completedOrders, revenue, bonus, avgCompletionMin,
   * customerRating. `customerRating` is currently a placeholder (we don't
   * have a ratings model yet — derived from disputeCount / completedCount).
   */
  async performanceByPeriod(
    tenantId: string,
    driverId: string,
    period: 'week' | 'month',
  ) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
      include: { user: { select: { fullName: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const now = new Date();
    const from = new Date(now);
    if (period === 'week') {
      from.setDate(from.getDate() - 7);
    } else {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    }

    // Pull every completed order in the window. We need per-order timings
    // (startedAt → completedAt) for avgCompletionMin so an aggregate is
    // not enough on its own.
    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        driverId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: from, lte: now },
      },
      select: {
        paidAmountIqd: true,
        bonusIqd: true,
        startedAt: true,
        completedAt: true,
        customerDisputedAt: true,
      },
    });

    const completedOrders = orders.length;
    const revenueIqd = orders.reduce((s, o) => s + (o.paidAmountIqd ?? 0), 0);
    const bonusIqd = orders.reduce((s, o) => s + (o.bonusIqd ?? 0), 0);

    // Average completion time = (completedAt - startedAt) across orders that
    // have both timestamps. Skip rows missing one (older data / cancelled).
    const durations = orders
      .filter((o) => o.startedAt && o.completedAt)
      .map((o) => o.completedAt!.getTime() - o.startedAt!.getTime());
    const avgCompletionMin =
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 60_000)
        : null;

    // Rating proxy: % of orders the customer didn't dispute, mapped to 1..5
    // stars. Kept for backward compat (mobile-admin binds `customerRating`).
    const disputed = orders.filter((o) => o.customerDisputedAt).length;
    const customerRating =
      completedOrders > 0
        ? Math.round(((completedOrders - disputed) / completedOrders) * 5 * 10) / 10
        : null;

    // Real star ratings left by customers on this driver's orders within the
    // window. Additive to the existing shape — `avgRating` is the genuine
    // average (1..5, rounded to 1 decimal) and `ratingCount` the sample size.
    // null avg when no ratings yet so the UI can show "—" instead of 0 stars.
    const ratingAgg = await this.prisma.rating.aggregate({
      where: {
        tenantId,
        driverId,
        createdAt: { gte: from, lte: now },
      },
      _avg: { stars: true },
      _count: { _all: true },
    });
    const ratingCount = ratingAgg._count._all;
    const avgRating =
      ratingCount > 0 && ratingAgg._avg.stars != null
        ? Math.round(ratingAgg._avg.stars * 10) / 10
        : null;

    return {
      driverId,
      driverName: driver.user.fullName,
      // تطبيق السائق يقرأ fullName؛ نُبقي driverName للوحة المعمل.
      fullName: driver.user.fullName,
      period,
      from,
      to: now,
      completedOrders,
      revenueIqd,
      bonusIqd,
      avgCompletionMin,
      customerRating,
      avgRating,
      ratingCount,
    };
  }

  /**
   * Daily earnings series for the driver detail / worker earnings screen.
   * Returns one row per calendar day in the window (week = last 7 days,
   * month = since the 1st), each with the day's completed-order count,
   * commission, and bonus. Commission is the driver's per-refill rate ×
   * REFILL completions that day; bonus is the sum of per-order bonusIqd
   * snapshots. Days with no completed orders still appear (zeros) so the
   * client can render a continuous chart.
   */
  async earningsByPeriod(driverId: string, period: 'week' | 'month') {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { commissionPerRefillIqd: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    if (period === 'week') {
      from.setDate(from.getDate() - 6); // today + previous 6 days = 7 days
    } else {
      from.setDate(1);
    }

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        driverId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: from, lte: now },
      },
      select: { completedAt: true, bonusIqd: true, kind: true },
    });

    // Bucket per local calendar day (YYYY-MM-DD).
    const buckets = new Map<
      string,
      { completedOrders: number; refillCount: number; bonusIqd: number }
    >();
    const dayKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Seed every day in the window so the series is continuous.
    for (let d = new Date(from); d <= now; d.setDate(d.getDate() + 1)) {
      buckets.set(dayKey(d), { completedOrders: 0, refillCount: 0, bonusIqd: 0 });
    }

    for (const o of orders) {
      if (!o.completedAt) continue;
      const key = dayKey(o.completedAt);
      const b = buckets.get(key);
      if (!b) continue;
      b.completedOrders += 1;
      if (o.kind === 'REFILL') b.refillCount += 1;
      b.bonusIqd += o.bonusIqd ?? 0;
    }

    const rate = driver.commissionPerRefillIqd ?? 0;
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, b]) => ({
        date,
        completedOrders: b.completedOrders,
        commissionIqd: rate * b.refillCount,
        bonusIqd: b.bonusIqd,
      }));
  }

  /**
   * Today's shift summary for the worker app. Completed-order count, cash
   * collected (sum of paidAmountIqd), and a per-kind breakdown for the three
   * field operations (refills, deliveries, reclaims).
   */
  async shiftSummary(driverId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        driverId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: start, lt: end },
      },
      select: { paidAmountIqd: true, kind: true },
    });

    const byKind = { REFILL: 0, TANK_DELIVERY: 0, TANK_RECLAIM: 0 };
    let collectedCashIqd = 0;
    for (const o of orders) {
      collectedCashIqd += o.paidAmountIqd ?? 0;
      if (o.kind === 'REFILL') byKind.REFILL += 1;
      else if (o.kind === 'TANK_DELIVERY') byKind.TANK_DELIVERY += 1;
      else if (o.kind === 'TANK_RECLAIM') byKind.TANK_RECLAIM += 1;
    }

    return {
      completedOrders: orders.length,
      collectedCashIqd,
      byKind,
    };
  }

  /**
   * Driver updates the tank count currently loaded on their van (full /
   * empty). Used by the worker app's van-inventory screen for end-of-shift
   * reconciliation. Scoped to the driver's own row (id resolved from JWT by
   * the controller).
   */
  async updateVanInventory(
    driverId: string,
    tanksFullOnVan: number,
    tanksEmptyOnVan: number,
  ) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { tanksFullOnVan, tanksEmptyOnVan },
      select: {
        id: true,
        tanksFullOnVan: true,
        tanksEmptyOnVan: true,
      },
    });
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
