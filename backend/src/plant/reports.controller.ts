import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RefillOrderStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * PlantReportsController — analytical endpoints powering the mobile-admin
 * "Reports" tab (sparkline + top-X leaderboards + peak-hour heatmap).
 *
 * Every query is scoped by the caller's tenantId. The mobile UI hits these
 * once per page-load and again on pull-to-refresh; nothing is realtime.
 */
@ApiBearerAuth()
@ApiTags('plant-reports')
@UseGuards(RolesGuard)
@Controller('plant/reports')
export class PlantReportsController {
  constructor(private prisma: PrismaService) {}

  /**
   * Daily revenue + order count for the past 7 days (inclusive of today).
   * Returns the array in chronological order so a sparkline can plot it
   * directly. Days with no orders are still emitted with zeros so the
   * mobile UI doesn't have to backfill gaps.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('revenue-7d')
  async revenue7d(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;

    // Last 7 calendar days (today included). Build the day buckets up front
    // so empty days appear with revenueIqd=0 instead of being missing.
    const days: { date: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      days.push({
        date: start.toISOString().slice(0, 10),
        start,
        end,
      });
    }
    const windowStart = days[0].start;
    const windowEnd = days[days.length - 1].end;

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: windowStart, lt: windowEnd },
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
   * Top customers this month, ranked by total spending. Used by the
   * mobile-admin "Top Customers" leaderboard tile. Default limit 5.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('top-customers')
  async topCustomers(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const tenantId = user.tenantId!;
    const n = Math.min(parseInt(limit ?? '5', 10) || 5, 50);
    const monthStart = startOfMonth();

    const grouped = await this.prisma.refillOrder.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: monthStart },
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
   * Top drivers this month, ranked by completed orders. Used by the
   * mobile-admin "Top Drivers" leaderboard tile.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('top-drivers')
  async topDrivers(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const tenantId = user.tenantId!;
    const n = Math.min(parseInt(limit ?? '5', 10) || 5, 50);
    const monthStart = startOfMonth();

    const grouped = await this.prisma.refillOrder.groupBy({
      by: ['driverId'],
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: monthStart },
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
   * Order-count distribution by hour-of-day across the last 30 days. Used
   * by the mobile-admin "Peak Hours" heatmap. Returns 24 buckets — even
   * if a slot saw zero orders — so the heatmap renders against a fixed
   * grid. Hour is in local server time (Asia/Baghdad on prod VPS).
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('peak-hours')
  async peakHours(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: since },
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
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
