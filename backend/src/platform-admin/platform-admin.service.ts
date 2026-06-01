import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefillOrderStatus, SubscriptionPlan, TenantStatus } from '@prisma/client';

/**
 * Default monthly SaaS price per plan, in IQD. These are the platform's
 * (PhiBit / Ahmed's) subscription prices charged to each plant — used to
 * compute MRR. They are sensible placeholders; adjust to the real pricing
 * (ideally move to a `tenant.subscriptionPriceIqd` column or a settings row
 * later so it's editable from the console without a redeploy).
 */
const PLAN_PRICE_IQD: Record<SubscriptionPlan, number> = {
  STARTER: 0,
  PRO: 150_000,
  BUSINESS: 400_000,
  ENTERPRISE: 1_000_000,
};

const ONLINE_DRIVER_STATUSES = ['AVAILABLE', 'ON_ROUTE'] as const;

@Injectable()
export class PlatformAdminService {
  constructor(private prisma: PrismaService) {}

  /** Cross-tenant platform overview — KPIs + 6-month volume + plan mix. */
  async overview() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tenants, ordersToday, driversTotal, driversOnline, cancelled30, total30] =
      await Promise.all([
        this.prisma.tenant.findMany({ select: { status: true, plan: true } }),
        this.prisma.refillOrder.count({ where: { requestedAt: { gte: startToday } } }),
        this.prisma.driver.count(),
        this.prisma.driver.count({
          where: { status: { in: ONLINE_DRIVER_STATUSES as unknown as any } },
        }),
        this.prisma.refillOrder.count({
          where: { requestedAt: { gte: last30 }, status: RefillOrderStatus.CANCELLED },
        }),
        this.prisma.refillOrder.count({ where: { requestedAt: { gte: last30 } } }),
      ]);

    const plantsTotal = tenants.length;
    const plantsActive = tenants.filter((t) => t.status === 'ACTIVE').length;
    const plantsTrial = tenants.filter((t) => t.status === 'TRIAL').length;
    const plantsSuspended = tenants.filter((t) => t.status === 'SUSPENDED').length;

    const mrrIqd = tenants
      .filter((t) => t.status === 'ACTIVE' || t.status === 'TRIAL')
      .reduce((sum, t) => sum + (PLAN_PRICE_IQD[t.plan] ?? 0), 0);

    const cancelRate = total30 > 0 ? Math.round((cancelled30 / total30) * 1000) / 10 : 0;

    const plansBreakdown = (
      ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as SubscriptionPlan[]
    ).map((plan) => ({ plan, count: tenants.filter((t) => t.plan === plan).length }));

    // 6-month gross volume (sum of completed-order prices) — real platform throughput.
    const revenueByMonth: { month: string; gmvIqd: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const agg = await this.prisma.refillOrder.aggregate({
        where: { status: RefillOrderStatus.COMPLETED, completedAt: { gte: from, lt: to } },
        _sum: { priceIqd: true },
        _count: true,
      });
      revenueByMonth.push({
        month: from.toISOString().slice(0, 7),
        gmvIqd: agg._sum.priceIqd ?? 0,
        orders: typeof agg._count === 'number' ? agg._count : 0,
      });
    }

    return {
      plantsActive,
      plantsTotal,
      plantsTrial,
      plantsSuspended,
      mrrIqd,
      ordersToday,
      driversOnline,
      driversTotal,
      cancelRate,
      plansBreakdown,
      revenueByMonth,
      generatedAt: now.toISOString(),
    };
  }

  /** Every plant + its plan, status, wallet, and this-month orders/revenue. */
  async listPlants() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        promoWalletIqd: true,
        createdAt: true,
        _count: { select: { drivers: true, customers: true } },
      },
    });

    return Promise.all(
      tenants.map(async (t) => {
        const [ordersThisMonth, rev] = await Promise.all([
          this.prisma.refillOrder.count({
            where: { tenantId: t.id, requestedAt: { gte: monthStart } },
          }),
          this.prisma.refillOrder.aggregate({
            where: {
              tenantId: t.id,
              status: RefillOrderStatus.COMPLETED,
              completedAt: { gte: monthStart },
            },
            _sum: { priceIqd: true },
          }),
        ]);
        return {
          id: t.id,
          name: t.name,
          plan: t.plan,
          status: t.status,
          walletIqd: t.promoWalletIqd,
          planPriceIqd: PLAN_PRICE_IQD[t.plan] ?? 0,
          driversCount: t._count.drivers,
          customersCount: t._count.customers,
          ordersThisMonth,
          revenueThisMonthIqd: rev._sum.priceIqd ?? 0,
          createdAt: t.createdAt,
        };
      }),
    );
  }

  async setPlantStatus(tenantId: string, status: TenantStatus) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('المعمل غير موجود');
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
      select: { id: true, name: true, status: true },
    });
  }

  async setPlantPlan(tenantId: string, plan: SubscriptionPlan) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('المعمل غير موجود');
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
      select: { id: true, name: true, plan: true },
    });
  }

  /** Lightweight system health — real DB ping; API is implicitly up. */
  async health() {
    let db: 'ok' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      db = 'down';
    }
    return { api: 'ok' as const, db, generatedAt: new Date().toISOString() };
  }
}
