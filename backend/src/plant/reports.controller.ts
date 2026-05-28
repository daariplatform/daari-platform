import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { RefillOrderStatus, UserRole } from '@prisma/client';
import { join } from 'node:path';
import { mkdirSync, createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

// ── DTOs ──────────────────────────────────────────────────────────────────────
// Declared above the controller so reflection-based metadata in the
// @Body(dto) decorator resolves at module load time. Putting them after
// the class causes "Cannot access 'X' before initialization" in CJS output.

class ExportReportDto {
  @IsIn(['pdf', 'xlsx'])
  type!: 'pdf' | 'xlsx';

  @IsIn(['revenue', 'top-customers', 'top-drivers', 'cohort'])
  report!: 'revenue' | 'top-customers' | 'top-drivers' | 'cohort';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

interface ExportPayload {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * PlantReportsController — analytical endpoints powering the mobile-admin
 * "Reports" tab (sparkline + top-X leaderboards + peak-hour heatmap +
 * cohort retention + driver heatmap + tank utilisation + PDF/Excel export).
 *
 * Every query is scoped by the caller's tenantId. The mobile UI hits these
 * once per page-load and again on pull-to-refresh; nothing is realtime.
 *
 * All endpoints accept optional `from` / `to` ISO date params. Defaults
 * preserve the original behaviour so existing callers keep working.
 */
@ApiBearerAuth()
@ApiTags('plant-reports')
@UseGuards(RolesGuard)
@Controller('plant/reports')
export class PlantReportsController {
  constructor(private prisma: PrismaService) {}

  /**
   * Daily revenue + order count for a window (default: last 7 days
   * inclusive of today). Returns the array in chronological order so a
   * sparkline can plot it directly. Days with no orders are still emitted
   * with zeros so the mobile UI doesn't have to backfill gaps.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('revenue-7d')
  async revenue7d(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tenantId = user.tenantId!;
    const { windowStart, windowEnd } = parseRange(from, to, /* defaultDays */ 7);

    // Build day buckets at midnight, end-exclusive — handles short or long
    // windows. Caps at 366 to keep payloads sane.
    const days: { date: string; start: Date; end: Date }[] = [];
    const dayMs = 86_400_000;
    const numDays = Math.min(
      Math.ceil((windowEnd.getTime() - windowStart.getTime()) / dayMs),
      366,
    );
    for (let i = 0; i < numDays; i++) {
      const start = new Date(windowStart);
      start.setDate(start.getDate() + i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      days.push({ date: start.toISOString().slice(0, 10), start, end });
    }

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: days[0].start, lt: days[days.length - 1].end },
      },
      select: { completedAt: true, paidAmountIqd: true },
    });

    return days.map((d) => {
      const inDay = orders.filter(
        (o) => o.completedAt! >= d.start && o.completedAt! < d.end,
      );
      const revenueIqd = inDay.reduce((s, o) => s + (o.paidAmountIqd ?? 0), 0);
      return { date: d.date, revenueIqd, orders: inDay.length };
    });
  }

  /**
   * Top customers ranked by total spending. Default window = current
   * month, default limit 5. Used by the mobile-admin "Top Customers"
   * leaderboard tile.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('top-customers')
  async topCustomers(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tenantId = user.tenantId!;
    const n = Math.min(parseInt(limit ?? '5', 10) || 5, 50);
    const windowStart = from ? new Date(from) : startOfMonth();
    const windowEnd = to ? new Date(to) : new Date();

    const grouped = await this.prisma.refillOrder.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: windowStart, lte: windowEnd },
        customerId: { not: null },
      },
      _sum: { paidAmountIqd: true },
      _count: { _all: true },
      orderBy: { _sum: { paidAmountIqd: 'desc' } },
      take: n,
    });

    const customerIds = grouped.map((g) => g.customerId!).filter(Boolean);
    if (customerIds.length === 0) return [];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, tenantId },
      select: { id: true, fullName: true, phone: true, district: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      customerId: g.customerId!,
      fullName: byId.get(g.customerId!)?.fullName ?? '—',
      phone: byId.get(g.customerId!)?.phone ?? null,
      district: byId.get(g.customerId!)?.district ?? null,
      spentIqd: g._sum.paidAmountIqd ?? 0,
      orderCount: g._count._all,
    }));
  }

  /**
   * Top drivers ranked by completed orders. Default window = current
   * month. Used by the mobile-admin "Top Drivers" leaderboard tile.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('top-drivers')
  async topDrivers(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tenantId = user.tenantId!;
    const n = Math.min(parseInt(limit ?? '5', 10) || 5, 50);
    const windowStart = from ? new Date(from) : startOfMonth();
    const windowEnd = to ? new Date(to) : new Date();

    const grouped = await this.prisma.refillOrder.groupBy({
      by: ['driverId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: windowStart, lte: windowEnd },
        driverId: { not: null },
      },
      _count: { _all: true },
      _sum: { paidAmountIqd: true, bonusIqd: true },
      orderBy: { _count: { driverId: 'desc' } },
      take: n,
    });

    const driverIds = grouped.map((g) => g.driverId!).filter(Boolean);
    if (driverIds.length === 0) return [];

    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds }, tenantId },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    const byId = new Map(drivers.map((d) => [d.id, d]));

    return grouped.map((g) => ({
      driverId: g.driverId!,
      fullName: byId.get(g.driverId!)?.user.fullName ?? '—',
      phone: byId.get(g.driverId!)?.user.phone ?? null,
      vehiclePlate: byId.get(g.driverId!)?.vehiclePlate ?? null,
      completedOrders: g._count._all,
      revenueIqd: g._sum.paidAmountIqd ?? 0,
      bonusIqd: g._sum.bonusIqd ?? 0,
    }));
  }

  /**
   * "نظرة سريعة" tiles for the mobile-admin home screen — unchanged
   * behaviour (intentionally not date-range-able; this is a snapshot
   * widget). Accepts no params.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('insights')
  async insights(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;
    const monthStart = startOfMonth();

    const bestDriverGroup = await this.prisma.refillOrder.groupBy({
      by: ['driverId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: monthStart },
        driverId: { not: null },
      },
      _count: { driverId: true },
      orderBy: { _count: { driverId: 'desc' } },
      take: 1,
    });
    let bestDriver: { id: string; fullName: string; completedOrders: number } | null = null;
    if (bestDriverGroup.length > 0 && bestDriverGroup[0].driverId) {
      const d = await this.prisma.driver.findFirst({
        where: { id: bestDriverGroup[0].driverId, tenantId },
        include: { user: { select: { fullName: true } } },
      });
      bestDriver = {
        id: bestDriverGroup[0].driverId,
        fullName: d?.user.fullName ?? '—',
        completedOrders: bestDriverGroup[0]._count.driverId,
      };
    }

    const topCustomerGroup = await this.prisma.refillOrder.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: monthStart },
        customerId: { not: null },
      },
      _sum: { paidAmountIqd: true },
      orderBy: { _sum: { paidAmountIqd: 'desc' } },
      take: 1,
    });
    let topCustomer: { id: string; fullName: string; totalSpendIqd: number } | null = null;
    if (topCustomerGroup.length > 0 && topCustomerGroup[0].customerId) {
      const c = await this.prisma.customer.findFirst({
        where: { id: topCustomerGroup[0].customerId, tenantId },
        select: { id: true, fullName: true },
      });
      if (c) {
        topCustomer = {
          id: c.id,
          fullName: c.fullName,
          totalSpendIqd: topCustomerGroup[0]._sum.paidAmountIqd ?? 0,
        };
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ordersToday = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: todayStart },
      },
      select: { completedAt: true },
    });
    let peakHourToday: number | null = null;
    if (ordersToday.length > 0) {
      const buckets = Array(24).fill(0);
      for (const o of ordersToday) buckets[o.completedAt!.getHours()]++;
      let maxIdx = 0;
      for (let i = 1; i < 24; i++) if (buckets[i] > buckets[maxIdx]) maxIdx = i;
      if (buckets[maxIdx] >= 2) peakHourToday = maxIdx;
    }

    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 7);
    const prior7Start = new Date(now);
    prior7Start.setDate(prior7Start.getDate() - 14);

    const [thisWeek, lastWeek] = await Promise.all([
      this.prisma.refillOrder.aggregate({
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: last7Start, lt: now },
        },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.refillOrder.aggregate({
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: prior7Start, lt: last7Start },
        },
        _sum: { paidAmountIqd: true },
      }),
    ]);
    const thisRev = thisWeek._sum.paidAmountIqd ?? 0;
    const lastRev = lastWeek._sum.paidAmountIqd ?? 0;
    let growthVsLastWeekPct = 0;
    if (lastRev > 0) {
      growthVsLastWeekPct = Math.round(((thisRev - lastRev) / lastRev) * 100);
    } else if (thisRev > 0) {
      growthVsLastWeekPct = 100;
    }

    return { bestDriver, topCustomer, peakHourToday, growthVsLastWeekPct };
  }

  /**
   * Order-count distribution by hour-of-day across a window (default last
   * 30 days). Used by the mobile-admin "Peak Hours" heatmap. Returns 24
   * buckets — even if a slot saw zero orders — so the heatmap renders
   * against a fixed grid. Hour is in local server time (Asia/Baghdad).
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('peak-hours')
  async peakHours(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tenantId = user.tenantId!;
    const { windowStart, windowEnd } = parseRange(from, to, /* defaultDays */ 30);

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: windowStart, lt: windowEnd },
      },
      select: { completedAt: true },
    });

    const buckets: number[] = Array(24).fill(0);
    for (const o of orders) {
      const h = o.completedAt!.getHours();
      buckets[h]++;
    }
    return buckets.map((orderCount, hour) => ({ hour, orderCount }));
  }

  /**
   * Cohort retention by registration month.
   *
   * For each of the last 12 calendar months, group customers by the month
   * they were `registeredAt` into a cohort, then for each subsequent
   * month compute the share of that cohort that placed ≥1 COMPLETED order
   * in that month.
   *
   * Output shape mirrors a classic retention triangle:
   *   { cohortMonth: "2026-01", size: 42, retention: [100, 71, 55, 33, …] }
   * `retention[0]` is the cohort's "month-0" retention (the month they
   * registered) — always 100 for cohorts where at least one customer
   * placed an order in their signup month.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('cohort')
  async cohort(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.computeCohorts(user.tenantId!, from, to);
  }

  private async computeCohorts(tenantId: string, from?: string, to?: string) {
    // Cohort window: caller-supplied from/to, else last 12 months ending
    // at the start of this month + spanning back 11 prior months.
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const cohortsFrom = from ? new Date(from) : defaultFrom;
    const cohortsTo = to ? new Date(to) : defaultTo;

    const cohortMonths: { key: string; start: Date; end: Date }[] = [];
    let cursor = new Date(cohortsFrom.getFullYear(), cohortsFrom.getMonth(), 1);
    while (cursor < cohortsTo && cohortMonths.length < 12) {
      const start = new Date(cursor);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      cohortMonths.push({
        key: start.toISOString().slice(0, 7), // "YYYY-MM"
        start,
        end,
      });
      cursor = end;
    }

    // Pull all customers registered in the cohort window in one go.
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        registeredAt: { gte: cohortsFrom, lt: cohortsTo },
      },
      select: { id: true, registeredAt: true },
    });

    if (customers.length === 0) {
      return { cohorts: cohortMonths.map((m) => ({ cohortMonth: m.key, size: 0, retention: [] })) };
    }

    // Build cohort buckets keyed by month.
    const byCohort = new Map<string, Set<string>>();
    for (const c of customers) {
      const k = c.registeredAt.toISOString().slice(0, 7);
      if (!byCohort.has(k)) byCohort.set(k, new Set());
      byCohort.get(k)!.add(c.id);
    }

    // For activity, pull every completed order in [first cohort start, now]
    // whose customer is in any cohort. Keep only (customerId, completedAt).
    const allCustomerIds = customers.map((c) => c.id);
    const activity = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        customerId: { in: allCustomerIds },
        completedAt: { gte: cohortMonths[0]?.start ?? cohortsFrom },
      },
      select: { customerId: true, completedAt: true },
    });

    // Pre-index activity by month-key for O(1) lookup.
    const activityByMonth = new Map<string, Set<string>>();
    for (const a of activity) {
      if (!a.completedAt || !a.customerId) continue;
      const k = a.completedAt.toISOString().slice(0, 7);
      if (!activityByMonth.has(k)) activityByMonth.set(k, new Set());
      activityByMonth.get(k)!.add(a.customerId);
    }

    const cohortResults = cohortMonths.map((cm) => {
      const cohortSet = byCohort.get(cm.key) ?? new Set<string>();
      const size = cohortSet.size;
      const retention: number[] = [];
      // Compute up to (cohortMonths.length - idx) buckets going forward.
      const idx = cohortMonths.findIndex((m) => m.key === cm.key);
      const horizon = cohortMonths.length - idx;
      for (let i = 0; i < horizon; i++) {
        const target = cohortMonths[idx + i].key;
        const active = activityByMonth.get(target);
        if (!active || size === 0) {
          retention.push(0);
          continue;
        }
        let hit = 0;
        for (const id of cohortSet) if (active.has(id)) hit++;
        retention.push(size === 0 ? 0 : Math.round((hit / size) * 1000) / 10);
      }
      return { cohortMonth: cm.key, size, retention };
    });

    return { cohorts: cohortResults };
  }

  /**
   * Driver delivery heatmap. For each driver, return the districts they
   * served in the last 30 days (or supplied window) with completed-order
   * counts and revenue. Used by the mobile-admin "Where did each driver
   * work?" view — the UI plots each row as a stacked bar.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('driver-heatmap')
  async driverHeatmap(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tenantId = user.tenantId!;
    const { windowStart, windowEnd } = parseRange(from, to, 30);

    // Pull every completed order with its driver + customer.district. We
    // bucket in memory — Postgres can't groupBy a related column with the
    // Prisma client API without a raw query, and this dataset stays small
    // (~thousands of rows / 30d for a single plant).
    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: windowStart, lt: windowEnd },
        driverId: { not: null },
      },
      select: {
        driverId: true,
        paidAmountIqd: true,
        customer: { select: { district: true } },
      },
    });

    // Resolve driver names in one round-trip.
    const driverIds = Array.from(new Set(orders.map((o) => o.driverId!).filter(Boolean)));
    const drivers = driverIds.length
      ? await this.prisma.driver.findMany({
          where: { id: { in: driverIds }, tenantId },
          include: { user: { select: { fullName: true } } },
        })
      : [];
    const driverById = new Map(drivers.map((d) => [d.id, d]));

    // driverId → districtName → { orderCount, revenueIqd }
    const acc = new Map<string, Map<string, { orderCount: number; revenueIqd: number }>>();
    for (const o of orders) {
      const dId = o.driverId!;
      const district = o.customer?.district ?? 'غير محدد';
      if (!acc.has(dId)) acc.set(dId, new Map());
      const inner = acc.get(dId)!;
      if (!inner.has(district)) inner.set(district, { orderCount: 0, revenueIqd: 0 });
      const cell = inner.get(district)!;
      cell.orderCount += 1;
      cell.revenueIqd += o.paidAmountIqd ?? 0;
    }

    const result = Array.from(acc.entries()).map(([driverId, districts]) => ({
      driverId,
      fullName: driverById.get(driverId)?.user.fullName ?? '—',
      districts: Array.from(districts.entries())
        .map(([district, v]) => ({ district, orderCount: v.orderCount, revenueIqd: v.revenueIqd }))
        .sort((a, b) => b.orderCount - a.orderCount),
    }));
    return { drivers: result };
  }

  /**
   * Tank utilisation — answers "which tanks earn their keep?". For each
   * tank we compute days-since-install, days-since-last-refill, refills
   * in last 30 days, and bucket as active / light / idle.
   *
   * The plant uses this to decide which tanks to reclaim (idle = customer
   * isn't refilling = candidate for non-compliance reclaim) and which
   * routes to prioritise (active = high-frequency = milk run).
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('tank-utilization')
  async tankUtilization(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;
    const now = new Date();
    const since30d = new Date(now);
    since30d.setDate(since30d.getDate() - 30);

    const tanks = await this.prisma.tank.findMany({
      where: { tenantId },
      select: {
        id: true,
        qrCode: true,
        serialNumber: true,
        capacity: true,
        status: true,
        installedAt: true,
        lastRefillAt: true,
        customerId: true,
      },
    });

    if (tanks.length === 0) {
      return {
        tanks: [],
        activeCount: 0,
        lightCount: 0,
        idleCount: 0,
        avgRefillsPerActiveTank: 0,
      };
    }

    // Refill counts per tank over the last 30 days (in one groupBy).
    const refillCounts = await this.prisma.refillOrder.groupBy({
      by: ['tankId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: since30d },
        tankId: { in: tanks.map((t) => t.id) },
      },
      _count: { _all: true },
    });
    const refillsByTank = new Map(
      refillCounts.map((r) => [r.tankId!, r._count._all] as const),
    );

    let activeCount = 0;
    let lightCount = 0;
    let idleCount = 0;
    let totalActiveRefills = 0;

    const out = tanks.map((t) => {
      const refills30d = refillsByTank.get(t.id) ?? 0;
      let bucket: 'active' | 'light' | 'idle';
      if (refills30d > 2) {
        bucket = 'active';
        activeCount++;
        totalActiveRefills += refills30d;
      } else if (refills30d >= 1) {
        bucket = 'light';
        lightCount++;
      } else {
        bucket = 'idle';
        idleCount++;
      }
      return {
        tankId: t.id,
        qrCode: t.qrCode,
        serialNumber: t.serialNumber,
        capacity: t.capacity,
        status: t.status,
        customerId: t.customerId,
        daysSinceInstall:
          t.installedAt ? Math.floor((now.getTime() - t.installedAt.getTime()) / 86_400_000) : null,
        daysSinceLastRefill:
          t.lastRefillAt ? Math.floor((now.getTime() - t.lastRefillAt.getTime()) / 86_400_000) : null,
        refills30d,
        bucket,
      };
    });

    const avgRefillsPerActiveTank =
      activeCount > 0 ? Math.round((totalActiveRefills / activeCount) * 10) / 10 : 0;

    return {
      tanks: out,
      activeCount,
      lightCount,
      idleCount,
      avgRefillsPerActiveTank,
    };
  }

  /**
   * Generate a downloadable PDF/Excel of a chosen report. The file lands
   * in /var/uploads/reports/<tenantId>/<uuid>.<ext> (nginx-served) and we
   * return a public URL plus a 24h expiry. The uuid filename is the
   * "token" — unguessable, so anyone who has the URL can download, but
   * URLs are returned only to authenticated callers.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('export')
  async exportReport(@CurrentUser() user: AuthUser, @Body() dto: ExportReportDto) {
    const tenantId = user.tenantId!;

    // Validate inputs up front so we fail fast before any DB work.
    if (!['pdf', 'xlsx'].includes(dto.type)) {
      throw new BadRequestException('type must be "pdf" or "xlsx"');
    }
    if (!['revenue', 'top-customers', 'top-drivers', 'cohort'].includes(dto.report)) {
      throw new BadRequestException(
        'report must be one of: revenue, top-customers, top-drivers, cohort',
      );
    }

    const data = await this.gatherReportData(tenantId, dto.report, dto.from, dto.to);

    // Write to disk under a per-tenant directory. nginx alias serves
    // /uploads/ from /var/uploads/ (UPLOADS_DIR env, default /var/uploads).
    const uploadsDir = process.env.UPLOADS_DIR ?? '/var/uploads';
    const reportsRoot = join(uploadsDir, 'reports', tenantId);
    try {
      mkdirSync(reportsRoot, { recursive: true });
    } catch {
      // Falls through; the writeStream will reject and we surface 500.
    }
    const ext = dto.type;
    const fileId = randomUUID();
    const fullPath = join(reportsRoot, `${fileId}.${ext}`);

    if (dto.type === 'pdf') {
      await renderPdf(fullPath, dto.report, data);
    } else {
      await renderXlsx(fullPath, dto.report, data);
    }

    const appUrl = process.env.APP_URL ?? '';
    const url = `${appUrl}/uploads/reports/${tenantId}/${fileId}.${ext}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { url, expiresAt };
  }

  /** Helper: load the dataset for a given report key in the chosen window. */
  private async gatherReportData(
    tenantId: string,
    report: ExportReportDto['report'],
    from?: string,
    to?: string,
  ): Promise<ExportPayload> {
    if (report === 'revenue') {
      const { windowStart, windowEnd } = parseRange(from, to, 30);
      const days: { date: string; start: Date; end: Date }[] = [];
      const numDays = Math.min(
        Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 86_400_000),
        366,
      );
      for (let i = 0; i < numDays; i++) {
        const start = new Date(windowStart);
        start.setDate(start.getDate() + i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        days.push({ date: start.toISOString().slice(0, 10), start, end });
      }
      const orders = await this.prisma.refillOrder.findMany({
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: days[0].start, lt: days[days.length - 1].end },
        },
        select: { completedAt: true, paidAmountIqd: true },
      });
      const rows = days.map((d) => {
        const inDay = orders.filter(
          (o) => o.completedAt! >= d.start && o.completedAt! < d.end,
        );
        return {
          date: d.date,
          revenueIqd: inDay.reduce((s, o) => s + (o.paidAmountIqd ?? 0), 0),
          orders: inDay.length,
        };
      });
      return { title: 'Daily Revenue', columns: ['Date', 'Revenue (IQD)', 'Orders'], rows: rows.map((r) => [r.date, r.revenueIqd, r.orders]) };
    }

    if (report === 'top-customers') {
      const windowStart = from ? new Date(from) : startOfMonth();
      const windowEnd = to ? new Date(to) : new Date();
      const grouped = await this.prisma.refillOrder.groupBy({
        by: ['customerId'],
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: windowStart, lte: windowEnd },
          customerId: { not: null },
        },
        _sum: { paidAmountIqd: true },
        _count: { _all: true },
        orderBy: { _sum: { paidAmountIqd: 'desc' } },
        take: 100,
      });
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: grouped.map((g) => g.customerId!).filter(Boolean) }, tenantId },
        select: { id: true, fullName: true, phone: true, district: true },
      });
      const byId = new Map(customers.map((c) => [c.id, c]));
      const rows = grouped.map((g) => [
        byId.get(g.customerId!)?.fullName ?? '—',
        byId.get(g.customerId!)?.phone ?? '',
        byId.get(g.customerId!)?.district ?? '',
        g._sum.paidAmountIqd ?? 0,
        g._count._all,
      ]);
      return {
        title: 'Top Customers',
        columns: ['Name', 'Phone', 'District', 'Spend (IQD)', 'Orders'],
        rows,
      };
    }

    if (report === 'top-drivers') {
      const windowStart = from ? new Date(from) : startOfMonth();
      const windowEnd = to ? new Date(to) : new Date();
      const grouped = await this.prisma.refillOrder.groupBy({
        by: ['driverId'],
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: windowStart, lte: windowEnd },
          driverId: { not: null },
        },
        _count: { _all: true },
        _sum: { paidAmountIqd: true, bonusIqd: true },
        orderBy: { _count: { driverId: 'desc' } },
        take: 100,
      });
      const drivers = await this.prisma.driver.findMany({
        where: { id: { in: grouped.map((g) => g.driverId!).filter(Boolean) }, tenantId },
        include: { user: { select: { fullName: true, phone: true } } },
      });
      const byId = new Map(drivers.map((d) => [d.id, d]));
      const rows = grouped.map((g) => [
        byId.get(g.driverId!)?.user.fullName ?? '—',
        byId.get(g.driverId!)?.user.phone ?? '',
        byId.get(g.driverId!)?.vehiclePlate ?? '',
        g._count._all,
        g._sum.paidAmountIqd ?? 0,
        g._sum.bonusIqd ?? 0,
      ]);
      return {
        title: 'Top Drivers',
        columns: ['Name', 'Phone', 'Plate', 'Completed Orders', 'Revenue (IQD)', 'Bonus (IQD)'],
        rows,
      };
    }

    // cohort
    const cohortResult = await this.computeCohorts(tenantId, from, to);
    const rows = cohortResult.cohorts.map((c) => [
      c.cohortMonth,
      c.size,
      ...c.retention.map((v) => `${v}%`),
    ]);
    return {
      title: 'Cohort Retention',
      columns: ['Cohort', 'Size', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11'],
      rows,
    };
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse `from`/`to` query strings and return a [windowStart, windowEnd) pair.
 * If both are missing, the window is `defaultDays` ending now (inclusive of
 * today). If only one is given, the other is filled in: `from` => now,
 * `to` => now - defaultDays.
 *
 * windowEnd is always end-exclusive so callers can use `lt`/`<` against it.
 */
function parseRange(
  from: string | undefined,
  to: string | undefined,
  defaultDays: number,
): { windowStart: Date; windowEnd: Date } {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (!from && !to) {
    const start = new Date(tomorrowStart);
    start.setDate(start.getDate() - defaultDays);
    return { windowStart: start, windowEnd: tomorrowStart };
  }

  const windowStart = from
    ? new Date(from)
    : (() => {
        const d = to ? new Date(to) : tomorrowStart;
        d.setDate(d.getDate() - defaultDays);
        return d;
      })();
  const windowEnd = to ? new Date(to) : tomorrowStart;

  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
    throw new BadRequestException('Invalid from/to date');
  }
  if (windowEnd < windowStart) {
    throw new BadRequestException('to must be >= from');
  }
  return { windowStart, windowEnd };
}

// Lazy-loaded so the module doesn't depend on pdfkit being installed when
// running the tiny mobile-only build of the API in the future. Top-level
// import would otherwise force-pull a 4 MB dependency.
async function renderPdf(path: string, report: string, data: ExportPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = (await import('pdfkit')).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const stream = createWriteStream(path);
    stream.on('finish', () => resolve());
    stream.on('error', (e) => reject(e));
    doc.pipe(stream);

    // Header
    doc.fontSize(18).text(data.title, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('gray').text(`Report: ${report}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.fillColor('black').moveDown(0.8);

    // Column header row — bold, separator line below.
    const colWidth = (doc.page.width - 72) / data.columns.length;
    doc.fontSize(11).font('Helvetica-Bold');
    data.columns.forEach((c, i) => {
      doc.text(c, 36 + i * colWidth, doc.y, { width: colWidth, continued: i < data.columns.length - 1 });
    });
    doc.font('Helvetica').moveDown(0.5);
    doc.moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).stroke();
    doc.moveDown(0.3);

    // Data rows. pdfkit doesn't natively render Arabic right-to-left, but
    // numeric values + romanised names render fine — Arabic glyphs in
    // names may appear reversed in some PDF viewers. Excel handles the
    // text direction better; recommend xlsx for Arabic-heavy reports.
    doc.fontSize(10);
    for (const row of data.rows) {
      const startY = doc.y;
      row.forEach((v, i) => {
        doc.text(String(v ?? ''), 36 + i * colWidth, startY, { width: colWidth });
      });
      doc.moveDown(0.2);
      if (doc.y > doc.page.height - 60) doc.addPage();
    }

    doc.end();
  });
}

async function renderXlsx(path: string, report: string, data: ExportPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Daari Water Platform';
  wb.created = new Date();
  const ws = wb.addWorksheet(report);
  ws.columns = data.columns.map((c) => ({ header: c, key: c, width: Math.max(c.length + 4, 14) }));
  ws.getRow(1).font = { bold: true };
  for (const row of data.rows) {
    ws.addRow(row);
  }
  await wb.xlsx.writeFile(path);
}
