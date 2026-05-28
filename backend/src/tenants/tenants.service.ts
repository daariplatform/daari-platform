import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { SubscriptionPlan, SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';
import { hashPassword } from '../common/crypto';

interface RegisterTenantInput {
  plantName: string;
  city: string;
  ownerFullName: string;
  ownerPhone: string;
  ownerPassword: string;
  plan?: SubscriptionPlan;
}

interface BonusConfigInput {
  refillBonusIqd?: number;
  deliveryBonusIqd?: number;
  reclaimBonusIqd?: number;
  newCustomerBonusIqd?: number;
}

/** Monthly subscription price catalogue, in IQD. */
const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  STARTER: 25_000,
  PRO: 80_000,
  BUSINESS: 180_000,
  ENTERPRISE: 400_000,
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async register(input: RegisterTenantInput) {
    const passwordHash = await hashPassword(input.ownerPassword);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.plantName,
          ownerName: input.ownerFullName,
          ownerPhone: input.ownerPhone,
          city: input.city,
          // STARTER is the entry tier — used to be called BASIC in earlier
          // pricing decks; the enum was renamed but this line wasn't.
          plan: input.plan ?? SubscriptionPlan.STARTER,
          status: TenantStatus.TRIAL,
          trialEndsAt,
        },
      });

      const owner = await tx.user.create({
        data: {
          phone: input.ownerPhone,
          passwordHash,
          fullName: input.ownerFullName,
          role: UserRole.OWNER,
          tenantId: tenant.id,
        },
      });

      return { tenant, owner: { id: owner.id, phone: owner.phone } };
    });
  }

  async getDashboardStats(tenantId: string) {
    const [tankCount, customerCount, driverCount, todaysRefills, atRiskCustomers, activeDriverCount] =
      await Promise.all([
        this.prisma.tank.count({ where: { tenantId } }),
        this.prisma.customer.count({ where: { tenantId } }),
        this.prisma.driver.count({ where: { tenantId } }),
        this.prisma.refillOrder.count({
          where: {
            tenantId,
            status: 'COMPLETED',
            completedAt: { gte: startOfDay() },
          },
        }),
        this.prisma.customer.count({
          where: { tenantId, status: 'AT_RISK' },
        }),
        this.prisma.driver.count({
          where: { tenantId, status: { in: ['AVAILABLE', 'ON_ROUTE'] } },
        }),
      ]);

    // Revenue periods
    const [todayRev, weekRev, monthRev] = await Promise.all([
      this.prisma.refillOrder.aggregate({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: startOfDay() } },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.refillOrder.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.refillOrder.aggregate({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: startOfMonth() } },
        _sum: { paidAmountIqd: true },
      }),
    ]);

    // Revenue by day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentOrders = await this.prisma.refillOrder.findMany({
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: sevenDaysAgo } },
      select: { completedAt: true, paidAmountIqd: true },
    });
    const byDay = new Map<string, { revenueIqd: number; refills: number }>();
    for (const o of recentOrders) {
      if (!o.completedAt) continue;
      const key = o.completedAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { revenueIqd: 0, refills: 0 };
      cur.revenueIqd += o.paidAmountIqd;
      cur.refills += 1;
      byDay.set(key, cur);
    }
    const revenueByDay = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));

    // Top 5 customers by total refill spend (lifetime)
    const topCustomersAgg = await this.prisma.refillOrder.groupBy({
      by: ['customerId'],
      where: { tenantId, status: 'COMPLETED' },
      _sum: { paidAmountIqd: true },
      _count: true,
      orderBy: { _sum: { paidAmountIqd: 'desc' } },
      take: 5,
    });
    const customerIds = topCustomersAgg.map((c) => c.customerId).filter((id): id is string => !!id);
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, fullName: true, balanceIqd: true },
        })
      : [];
    const topCustomers = topCustomersAgg.map((agg) => {
      const c = customers.find((x) => x.id === agg.customerId);
      return {
        id: agg.customerId,
        fullName: c?.fullName ?? 'مجهول',
        totalRefills: agg._count,
        balanceIqd: c?.balanceIqd ?? 0,
      };
    });

    return {
      tankCount,
      customerCount,
      driverCount,
      todaysRefills,
      atRiskCustomers,
      todayRevenueIqd: todayRev._sum.paidAmountIqd ?? 0,
      weekRevenueIqd: weekRev._sum.paidAmountIqd ?? 0,
      monthRevenueIqd: monthRev._sum.paidAmountIqd ?? 0,
      revenueByDay,
      topCustomers,
      activeDrivers: Array.from({ length: activeDriverCount }, (_, i) => ({
        id: `${i}`,
        fullName: '',
        status: 'AVAILABLE',
        todayDeliveries: 0,
      })),
    };
  }

  /**
   * Plant settings — أسعار، ساعات عمل، نطاق توصيل.
   * يقرأ كل الحقول من جدول Tenant.
   */
  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');
    return {
      name: tenant.name,
      ownerName: tenant.ownerName,
      ownerPhone: tenant.ownerPhone,
      city: tenant.city,
      refillPriceIqd: (tenant as any).refillPriceIqd ?? 1000,
      deliveryFeeIqd: (tenant as any).deliveryFeeIqd ?? 0,
      freeDeliveryThresholdIqd: (tenant as any).freeDeliveryThresholdIqd ?? null,
      coverageKm: tenant.coverageKm ?? 7,
      workingHoursStart: (tenant as any).workingHoursStart ?? '08:00',
      workingHoursEnd: (tenant as any).workingHoursEnd ?? '22:00',
      refillBonusIqd: tenant.refillBonusIqd ?? 0,
      newCustomerBonusIqd: tenant.newCustomerBonusIqd ?? 0,
    };
  }

  /**
   * Pricing fields are locked AFTER the plant completes onboarding.
   * Business rule: if the plant can edit their own prices any time, the
   * paid Promo feature (1,000 IQD per discounted order goes to PhiBit)
   * has no value — they'd just lower their refill price and skip us.
   * So once the plant is past onboarding, the only way to give a
   * discount is to create a Promo campaign, which charges per order.
   *
   * The PLATFORM_ADMIN role (Ahmed at PhiBit) bypasses this — useful for
   * support / corrections, and so we can run mass-rate changes if we
   * ever migrate plans.
   */
  private static readonly PRICING_FIELDS = [
    'refillPriceIqd',
    'deliveryFeeIqd',
    'freeDeliveryThresholdIqd',
  ] as const;

  async updateSettings(
    tenantId: string,
    input: Record<string, unknown>,
    userRole?: string,
  ) {
    // Decide whether THIS request is allowed to touch the pricing
    // fields. PLATFORM_ADMIN always can. Otherwise we have to look at
    // onboarding state — during the wizard, the plant must be able to
    // set its initial price, but the moment they finish (or skip), the
    // lock kicks in.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        onboardingSkippedAt: true,
        refillPriceIqd: true,
        workingHoursStart: true,
        workingHoursEnd: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Mirror the heuristic in `plant/onboarding.controller.ts:82` so the
    // two endpoints agree on "is onboarding still in progress".
    const inOnboarding =
      !tenant.onboardingSkippedAt &&
      !(tenant.refillPriceIqd > 0 &&
        tenant.workingHoursStart?.trim() &&
        tenant.workingHoursEnd?.trim());

    const canEditPricing = userRole === 'PLATFORM_ADMIN' || inOnboarding;

    // If the caller tried to change a locked pricing field, refuse the
    // whole request with a clear Arabic message so the UI can surface
    // it. Silent dropping would leave the manager wondering why their
    // edit didn't take.
    const attemptedPricingFields = TenantsService.PRICING_FIELDS.filter(
      (f) => input[f] !== undefined,
    );
    if (!canEditPricing && attemptedPricingFields.length > 0) {
      throw new ForbiddenException(
        'تعديل الأسعار غير متاح من إعدادات المعمل بعد اكتمال التسجيل. ' +
          'لتطبيق سعر مخفّض مؤقّت، أنشئ "عرضاً" من قائمة العروض.',
      );
    }

    // Whitelist الحقول القابلة للتعديل من Settings page
    const allowed: Record<string, unknown> = {};
    const intFields = [
      'coverageKm',
      ...TenantsService.PRICING_FIELDS,
      'refillBonusIqd', 'newCustomerBonusIqd',
    ];
    const stringFields = [
      'name', 'ownerName', 'city',
      'workingHoursStart', 'workingHoursEnd',
    ];
    for (const f of intFields) {
      if (input[f] !== undefined && input[f] !== null && input[f] !== '') {
        allowed[f] = Number(input[f]);
      } else if (f === 'freeDeliveryThresholdIqd' && (input[f] === null || Number(input[f]) === 0)) {
        allowed[f] = null;
      }
    }
    for (const f of stringFields) {
      if (input[f] !== undefined && input[f] !== null) {
        allowed[f] = String(input[f]);
      }
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: allowed,
    });
    return this.getSettings(tenantId);
  }

  /**
   * Reports — analytics للـ admin بفترة (week/month/year).
   */
  async getReports(tenantId: string, range: 'week' | 'month' | 'year') {
    const since = new Date();
    if (range === 'week') since.setDate(since.getDate() - 7);
    else if (range === 'month') since.setMonth(since.getMonth() - 1);
    else since.setFullYear(since.getFullYear() - 1);

    const [revenueAgg, ordersCount, newCustomers, orders, statusAgg] = await Promise.all([
      this.prisma.refillOrder.aggregate({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.refillOrder.count({
        where: { tenantId, requestedAt: { gte: since } },
      }),
      this.prisma.customer.count({
        where: { tenantId, registeredAt: { gte: since } },
      }),
      this.prisma.refillOrder.findMany({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true, paidAmountIqd: true },
      }),
      this.prisma.refillOrder.groupBy({
        by: ['status'],
        where: { tenantId, requestedAt: { gte: since } },
        _count: true,
      }),
    ]);

    // refills by day
    const byDay = new Map<string, { refills: number; revenue: number }>();
    for (const o of orders) {
      if (!o.completedAt) continue;
      const key = o.completedAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { refills: 0, revenue: 0 };
      cur.refills += 1;
      cur.revenue += o.paidAmountIqd;
      byDay.set(key, cur);
    }
    const refillsByDay = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));

    // Top 10 customers
    const topAgg = await this.prisma.refillOrder.groupBy({
      by: ['customerId'],
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
      _sum: { paidAmountIqd: true },
      _count: true,
      orderBy: { _sum: { paidAmountIqd: 'desc' } },
      take: 10,
    });
    const ids = topAgg.map((c) => c.customerId).filter((id): id is string => !!id);
    const customerRows = ids.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true },
        })
      : [];
    const topCustomers = topAgg.map((agg) => {
      const c = customerRows.find((x) => x.id === agg.customerId);
      return {
        id: agg.customerId,
        name: c?.fullName ?? 'مجهول',
        refills: agg._count,
        revenue: agg._sum.paidAmountIqd ?? 0,
      };
    });

    return {
      range,
      totalRevenue: revenueAgg._sum.paidAmountIqd ?? 0,
      totalOrders: ordersCount,
      newCustomers,
      refillsByDay,
      topCustomers,
      ordersByStatus: statusAgg.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  findOne(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  /** All tenants the same owner-phone is registered against (multi-plant). */
  async listForOwner(ownerPhone: string) {
    return this.prisma.tenant.findMany({
      where: {
        OR: [
          { ownerPhone },
          { group: { ownerPhone } },
        ],
      },
      include: { group: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateBonuses(tenantId: string, input: BonusConfigInput) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: input,
    });
  }

  /**
   * Subscription state for the plant's own dashboard — drives the
   * expiry banner and the renew button.
   */
  async getSubscriptionStatus(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { endsAt: 'desc' },
    });
    if (!sub) return null;
    const daysLeft = Math.ceil((sub.endsAt.getTime() - Date.now()) / 86_400_000);
    return {
      plan: sub.plan,
      status: sub.status,
      priceIqd: sub.priceIqd,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      daysLeft,
      needsAttention: daysLeft <= 7,
    };
  }

  /**
   * Public lookup used during customer onboarding: returns the plant
   * whose coverage area contains the customer's GPS, falling back to
   * the closest plant if no exact match. The mobile app shows ONLY this
   * plant so the customer can't break inter-plant agreements.
   */
  async findNearestPlant(lng: number, lat: number) {
    const candidates = await this.prisma.tenant.findMany({
      where: {
        status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
        coverageLat: { not: null },
        coverageLng: { not: null },
      },
      select: {
        id: true, name: true, city: true,
        coverageLat: true, coverageLng: true, coverageKm: true,
      },
    });

    const ranked = candidates
      .map((c) => ({
        ...c,
        distanceKm: haversineKm(lat, lng, c.coverageLat!, c.coverageLng!),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // Prefer a plant whose coverage circle actually contains the customer.
    const inside = ranked.find((c) => c.distanceKm <= c.coverageKm);
    return inside ?? ranked[0] ?? null;
  }

  /**
   * Public discovery — returns up to N plants ordered by distance, plus
   * the consumer-facing fields they need to pick one (price, hours, etc).
   * Used by the customer mobile's "find a plant" Welcome flow.
   */
  async discoverPlants(lng: number, lat: number, maxDistanceKm = 30) {
    const candidates = await this.prisma.tenant.findMany({
      where: {
        status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
        coverageLat: { not: null },
        coverageLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        city: true,
        ownerPhone: true,
        coverageLat: true,
        coverageLng: true,
        coverageKm: true,
        refillPriceIqd: true,
        deliveryFeeIqd: true,
        workingHoursStart: true,
        workingHoursEnd: true,
      },
    });
    return candidates
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        contactPhone: c.ownerPhone,
        refillPriceIqd: c.refillPriceIqd ?? 1000,
        deliveryFeeIqd: c.deliveryFeeIqd ?? 0,
        workingHoursStart: c.workingHoursStart ?? '08:00',
        workingHoursEnd: c.workingHoursEnd ?? '22:00',
        coverageKm: c.coverageKm ?? 7,
        distanceKm: Number(
          haversineKm(lat, lng, c.coverageLat!, c.coverageLng!).toFixed(2),
        ),
        servesYourArea:
          haversineKm(lat, lng, c.coverageLat!, c.coverageLng!) <= (c.coverageKm ?? 7),
      }))
      .filter((c) => c.distanceKm <= maxDistanceKm)
      .sort((a, b) => {
        // Plants whose coverage circle includes the customer come first
        if (a.servesYourArea !== b.servesYourArea) return a.servesYourArea ? -1 : 1;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 10);
  }

  // ─── Platform admin operations ────────────────────────────────────────

  /** Snapshot of every tenant + subscription state, for the platform owner. */
  async platformOverview() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        group: true,
        subscriptions: { orderBy: { startsAt: 'desc' }, take: 1 },
        _count: { select: { customers: true, drivers: true, tanks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map((t) => {
      const sub = t.subscriptions[0];
      return {
        id: t.id,
        name: t.name,
        city: t.city,
        owner: t.ownerName,
        ownerPhone: t.ownerPhone,
        group: t.group?.name ?? null,
        plan: t.plan,
        status: t.status,
        customers: t._count.customers,
        drivers: t._count.drivers,
        tanks: t._count.tanks,
        subscription: sub
          ? {
              status: sub.status,
              priceIqd: sub.priceIqd,
              endsAt: sub.endsAt,
              daysToRenewal: Math.ceil((sub.endsAt.getTime() - Date.now()) / 86_400_000),
            }
          : null,
      };
    });
  }

  /** Platform admin renews a tenant for one month. */
  async renewSubscription(tenantId: string, plan: SubscriptionPlan) {
    const last = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { endsAt: 'desc' },
    });
    const startsAt = last && last.endsAt > new Date() ? last.endsAt : new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);
    return this.prisma.$transaction([
      this.prisma.subscription.create({
        data: {
          tenantId,
          plan,
          priceIqd: PLAN_PRICES[plan],
          status: SubscriptionStatus.ACTIVE,
          startsAt,
          endsAt,
        },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan, status: TenantStatus.ACTIVE },
      }),
    ]);
  }

  /** Suspend a tenant for non-payment etc. */
  async setStatus(tenantId: string, status: TenantStatus) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
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

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
