import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { SubscriptionPlan, SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';

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
    const passwordHash = await argon2.hash(input.ownerPassword);
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
    const [tankCount, customerCount, driverCount, todaysRefills, atRiskCustomers] = await Promise.all([
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
    ]);

    const monthRevenue = await this.prisma.refillOrder.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: startOfMonth() },
      },
      _sum: { paidAmountIqd: true },
    });

    return {
      tankCount,
      customerCount,
      driverCount,
      todaysRefills,
      atRiskCustomers,
      monthRevenueIqd: monthRevenue._sum.paidAmountIqd ?? 0,
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
