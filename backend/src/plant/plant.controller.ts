import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { UserScopedCacheInterceptor } from '../cache/user-scoped-cache.interceptor';
import { WHATSAPP_BLAST_QUEUE } from '../queue/queue.constants';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PromoChannel, UserRole } from '@prisma/client';
import { LITERS_BY_CAPACITY } from '../common/tank';
import { paginated } from '../common/dto/pagination.dto';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { WhatsAppProvider } from '../notifications/providers/whatsapp.provider';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

// Tier limits — billed at the boundaries the user agreed in chat.
// Module-level so both /plant/usage and /plant/kpis share the same source of truth.
const PLAN_TIERS = {
  STARTER: { ops: 300, priceIqd: 0 },
  PRO: { ops: 1500, priceIqd: 75000 },
  BUSINESS: { ops: 5000, priceIqd: 200000 },
  ENTERPRISE: { ops: 999999, priceIqd: 400000 },
} as const;

/** Wave 4 — water stock management. */
class StockUpdateDto {
  @IsOptional() @IsInt() @Min(0)
  currentLiters?: number;

  @IsOptional() @IsInt() @Min(0)
  capacityLiters?: number;

  @IsOptional() @IsInt() @Min(0)
  lowThresholdLiters?: number;

  /** When set, treats this as a top-up (add to current, record timestamp). */
  @IsOptional() @IsInt() @Min(0)
  topUpLiters?: number;
}

/** Wave 5 — paid promotional broadcast. */
class SendPromoDto {
  @IsString() @MinLength(3) @MaxLength(80)
  title!: string;

  @IsString() @MinLength(3) @MaxLength(280)
  body!: string;

  @IsEnum(PromoChannel)
  channel!: PromoChannel;
}

/**
 * One controller for plant-power features (Wave 4) and revenue features
 * (Wave 5). All under /plant/* so it's clear these are plant-admin tools.
 */
@ApiBearerAuth()
@ApiTags('plant')
@UseGuards(RolesGuard)
@Controller('plant')
export class PlantController {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private whatsapp: WhatsAppProvider,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @InjectQueue(WHATSAPP_BLAST_QUEUE) private whatsappBlastQueue: Queue,
  ) {}

  // ─── Wave 4: Water stock ─────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('stock')
  async getStock(@CurrentUser() user: AuthUser) {
    // Auto-create on first read so the dashboard always has something to show.
    const existing = await this.prisma.waterStock.findUnique({
      where: { tenantId: user.tenantId! },
    });
    if (existing) return existing;
    return this.prisma.waterStock.create({
      data: { tenantId: user.tenantId! },
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('stock')
  async updateStock(@CurrentUser() user: AuthUser, @Body() dto: StockUpdateDto) {
    const before = await this.prisma.waterStock.findUnique({
      where: { tenantId: user.tenantId! },
    });
    const data: Record<string, unknown> = {};
    if (dto.capacityLiters != null) data.capacityLiters = dto.capacityLiters;
    if (dto.lowThresholdLiters != null) data.lowThresholdLiters = dto.lowThresholdLiters;
    if (dto.topUpLiters != null) {
      // Treat as additive top-up + record audit fields
      data.currentLiters = (before?.currentLiters ?? 0) + dto.topUpLiters;
      data.lastTopUpLiters = dto.topUpLiters;
      data.lastTopUpAt = new Date();
    } else if (dto.currentLiters != null) {
      // Manual override (e.g. plant ran a physical inventory)
      data.currentLiters = dto.currentLiters;
    }
    const updated = await this.prisma.waterStock.upsert({
      where: { tenantId: user.tenantId! },
      create: { tenantId: user.tenantId!, ...data },
      update: data,
    });
    // Audit
    await this.audit(user, 'stock.update', 'WaterStock', updated.id, before, updated);
    return updated;
  }

  // ─── Wave 4: Audit log ─────────────────────────────────────────────

  /**
   * Audit-log feed. Two calling shapes are supported on the same route:
   *
   * 1. Legacy dashboard call — `?limit=N&action=string` returns a flat
   *    array of rows (no envelope). Preserved so the web admin keeps
   *    working while mobile rolls out.
   *
   * 2. Mobile-admin call — `?page=&pageSize=&actor=&action=` returns the
   *    standard PaginatedResult envelope so the UI can show a "load more"
   *    spinner with total counts.
   *
   * We detect which shape the caller wants by presence of `page` — only
   * the paginated path opts into the envelope.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('audit-log')
  async auditLog(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenantId = user.tenantId!;
    // Build a single WHERE shared by both code paths.
    const where = {
      tenantId,
      ...(action && { action: { contains: action } }),
      ...(actor && {
        OR: [
          { actorId: actor },
          { actorName: { contains: actor, mode: 'insensitive' as const } },
        ],
      }),
    };

    // Paginated path (mobile)
    if (page) {
      const p = Math.max(parseInt(page, 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize ?? '50', 10) || 50, 1), 200);
      const skip = (p - 1) * ps;
      const [items, total] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ps,
        }),
        this.prisma.auditLog.count({ where }),
      ]);
      return paginated(items, total, { page: p, pageSize: ps });
    }

    // Legacy flat path (web dashboard)
    const n = limit ? Math.min(parseInt(limit, 10) || 200, 1000) : 200;
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: n,
    });
  }

  // ─── Wave 4: Driver performance ─────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('driver-performance')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(60_000) // 60 s
  async driverPerformance(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const window = Math.min(parseInt(days ?? '30', 10) || 30, 90);
    const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);

    const drivers = await this.prisma.driver.findMany({
      where: { tenantId: user.tenantId! },
      include: { user: { select: { fullName: true, phone: true } } },
    });

    const rows = await Promise.all(
      drivers.map(async (d) => {
        const agg = await this.prisma.refillOrder.aggregate({
          where: {
            driverId: d.id,
            status: 'COMPLETED',
            completedAt: { gte: since },
          },
          _count: { _all: true },
          _sum: { paidAmountIqd: true, bonusIqd: true },
        });
        return {
          driverId: d.id,
          fullName: d.user.fullName,
          phone: d.user.phone,
          vehiclePlate: d.vehiclePlate,
          status: d.status,
          completedOrders: agg._count._all,
          revenueIqd: agg._sum.paidAmountIqd ?? 0,
          bonusEarnedIqd: agg._sum.bonusIqd ?? 0,
          baseSalaryIqd: d.baseSalaryIqd,
          windowDays: window,
        };
      }),
    );
    return rows.sort((a, b) => b.completedOrders - a.completedOrders);
  }

  // ─── Wave 5: Subscription / usage ──────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('usage')
  async usage(@CurrentUser() user: AuthUser) {
    // Monthly operations (completed orders) — the metric we'll bill on.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const opsThisMonth = await this.prisma.refillOrder.count({
      where: {
        tenantId: user.tenantId!,
        status: 'COMPLETED',
        completedAt: { gte: monthStart },
      },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      select: { plan: true, status: true, trialEndsAt: true },
    });
    const current = PLAN_TIERS[tenant?.plan ?? 'STARTER'];
    return {
      plan: tenant?.plan ?? 'STARTER',
      status: tenant?.status,
      trialEndsAt: tenant?.trialEndsAt,
      opsThisMonth,
      opsLimit: current.ops,
      monthlyPriceIqd: current.priceIqd,
      usagePercent: Math.min(100, Math.round((opsThisMonth / current.ops) * 100)),
      nearLimit: opsThisMonth >= current.ops * 0.8,
      overLimit: opsThisMonth >= current.ops,
    };
  }

  // ─── Wave 6: Mobile home-screen KPIs ───────────────────────────────
  //
  // One round-trip for the plant-owner mobile app's home tiles. Replaces
  // 5+ separate calls (/orders, /customers, /drivers, /plant/stock,
  // /plant/usage) — important on slow Iraqi 3G. All counts are scoped to
  // the caller's tenant. Cached for 30 s per tenant via
  // UserScopedCacheInterceptor; mobile polls every 60 s.
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('kpis')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(30_000) // 30 s — data may be slightly stale, that's OK for KPI tiles
  async kpis(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // "Active" = driver was seen in the last 30 minutes. Driver model has
    // no `isOnline` boolean — `lastLocationAt` is the closest proxy
    // (updated whenever the driver app pings its GPS).
    const activeSince = new Date(Date.now() - 30 * 60 * 1000);

    const [
      todayCompletedAgg,
      todayPendingCount,
      activeDriversCount,
      pendingLeadsCount,
      stock,
      opsThisMonth,
      tenant,
    ] = await this.prisma.$transaction([
      this.prisma.refillOrder.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: dayStart },
        },
        _count: { _all: true },
        _sum: { paidAmountIqd: true },
      }),
      this.prisma.refillOrder.count({
        where: {
          tenantId,
          status: { in: ['PENDING', 'ASSIGNED', 'EN_ROUTE'] },
        },
      }),
      this.prisma.driver.count({
        where: {
          tenantId,
          lastLocationAt: { gte: activeSince },
        },
      }),
      this.prisma.customer.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.waterStock.findUnique({ where: { tenantId } }),
      this.prisma.refillOrder.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: monthStart },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      }),
    ]);

    const planLimit = PLAN_TIERS[tenant?.plan ?? 'STARTER'].ops;
    const stockLevelLiters = stock?.currentLiters ?? 0;
    const stockCapacityLiters = stock?.capacityLiters ?? 0;
    const lowThresholdLiters = stock?.lowThresholdLiters ?? 0;

    return {
      todayRevenueIqd: todayCompletedAgg._sum.paidAmountIqd ?? 0,
      todayCompletedOrders: todayCompletedAgg._count._all,
      todayPendingOrders: todayPendingCount,
      activeDrivers: activeDriversCount,
      pendingLeadsCount,
      stockLevelLiters,
      stockCapacityLiters,
      stockLow: stockLevelLiters <= lowThresholdLiters,
      opsThisMonth,
      planLimit,
      nearLimit: opsThisMonth / planLimit >= 0.8,
      overLimit: opsThisMonth >= planLimit,
    };
  }

  // ─── Wave 5: Promo blast ───────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('promo-blast')
  async sendPromo(@CurrentUser() user: AuthUser, @Body() dto: SendPromoDto) {
    // ── PUSH — synchronous. Audience = active customers WITH an app account
    // (push tokens are tied to a User). Price is flat. sentCount/failedCount
    // are written before returning so the dashboard sees the final state. ────
    if (dto.channel === PromoChannel.PUSH) {
      const audience = await this.prisma.customer.findMany({
        where: {
          tenantId: user.tenantId!,
          status: { in: ['ACTIVE', 'AT_RISK'] },
          userId: { not: null },
        },
        select: { userId: true },
      });
      const userIds = audience.map((c) => c.userId!).filter(Boolean);
      if (userIds.length === 0) {
        throw new BadRequestException('لا يوجد زبائن نشطون لإرسال العرض إليهم');
      }
      const priceIqd = 5000; // flat, per pricing strategy

      const promo = await this.prisma.promoNotification.create({
        data: {
          tenantId: user.tenantId!,
          channel: dto.channel,
          title: dto.title,
          body: dto.body,
          audienceCount: userIds.length,
          priceIqd,
          status: 'QUEUED',
          createdById: user.id,
        },
      });

      const result = await this.push.sendToUsers(userIds, dto.title, dto.body, {
        promoId: promo.id,
        kind: 'promo',
      });
      await this.prisma.promoNotification.update({
        where: { id: promo.id },
        data: {
          status: result.failed === userIds.length ? 'FAILED' : 'SENT',
          sentCount: result.sent,
          failedCount: result.failed,
          sentAt: new Date(),
        },
      });
      await this.audit(user, 'promo.send', 'PromoNotification', promo.id, null, {
        ...promo,
        sentCount: result.sent,
      });
      return { ...promo, sentCount: result.sent, failedCount: result.failed };
    }

    // ── WHATSAPP — async via BullMQ so the HTTP call returns immediately for
    // large audiences. Audience = active customers reachable by phone (no app
    // account required). Price, audienceCount AND the queued recipient list all
    // derive from this ONE set, so billing == what's actually sent. (Previously
    // the price/audienceCount used the userId-filtered subset while the queue
    // used the full set → under-billing and sentCount > audienceCount.) ───────
    const customerIds = (
      await this.prisma.customer.findMany({
        where: {
          tenantId: user.tenantId!,
          status: { in: ['ACTIVE', 'AT_RISK'] },
        },
        select: { id: true },
      })
    ).map((c) => c.id);
    if (customerIds.length === 0) {
      throw new BadRequestException('لا يوجد زبائن نشطون لإرسال العرض إليهم');
    }
    const priceIqd = 10000 + customerIds.length * 10;

    const promo = await this.prisma.promoNotification.create({
      data: {
        tenantId: user.tenantId!,
        channel: dto.channel,
        title: dto.title,
        body: dto.body,
        audienceCount: customerIds.length,
        priceIqd,
        status: 'QUEUED',
        createdById: user.id,
      },
    });

    await this.whatsappBlastQueue.add(
      'send',
      {
        promoNotificationId: promo.id,
        tenantId: user.tenantId!,
        customerIds,
        title: dto.title,
        body: dto.body,
      },
      {
        // Retry the whole job on hard failures (network drop). The processor
        // records per-recipient sent state on the job so a retry skips anyone
        // already messaged (no duplicate paid sends).
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 60 * 60 }, // keep for 24 h for debugging
        removeOnFail: { age: 7 * 24 * 60 * 60 }, // keep failed for a week
      },
    );

    await this.audit(user, 'promo.queue', 'PromoNotification', promo.id, null, {
      channel: 'WHATSAPP',
      audienceCount: customerIds.length,
    });
    return promo; // status: QUEUED, sentCount: 0 — dashboard polls /status
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('promo-history')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(30_000) // 30 s — refresh after a new blast is queued
  promoHistory(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.prisma.promoNotification.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
  }

  /**
   * Dashboard polls this to render a progress bar on an in-flight blast.
   * Returns just the PromoNotification row (sentCount / failedCount /
   * status / sentAt fields are what the UI watches).
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('promo-blast/:id/status')
  async promoBlastStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.promoNotification.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!row) throw new NotFoundException('Promo blast not found');
    return row;
  }

  /**
   * Activity feed — last N events across this tenant's day, used by the
   * mobile-admin home dashboard's "آخر النشاط" timeline. Aggregates four
   * sources (orders, pending leads, stock changes via audit, driver
   * location heartbeats), merges them chronologically, and trims to the
   * requested limit.
   *
   * Each row is shaped for the UI directly (id/kind/title/subtitle/createdAt
   * + optional deeplink) so the client doesn't have to format anything.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('activity-feed')
  async activityFeed(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const tenantId = user.tenantId!;
    const n = Math.min(parseInt(limit ?? '8', 10) || 8, 50);
    const since = new Date();
    since.setDate(since.getDate() - 7);

    type Event = {
      id: string;
      kind: 'order' | 'lead' | 'stock' | 'driver';
      title: string;
      subtitle: string;
      createdAt: string;
      deeplink?: string;
    };

    // Pull a small slice from each source — we over-fetch a bit then trim
    // after the merge so the final feed is the freshest N across sources.
    const perSource = Math.max(n, 5);

    const [orders, leads, stockChanges, driverPings] = await Promise.all([
      this.prisma.refillOrder.findMany({
        where: { tenantId, requestedAt: { gte: since } },
        orderBy: { requestedAt: 'desc' },
        take: perSource,
        include: {
          customer: { select: { fullName: true } },
          // Tank capacity is an enum (L350 / L500), not a numeric column.
          // We map it to a liters number when shaping the event subtitle.
          tank: { select: { capacity: true } },
        },
      }),
      this.prisma.customer.findMany({
        where: { tenantId, status: 'PENDING_APPROVAL', registeredAt: { gte: since } },
        orderBy: { registeredAt: 'desc' },
        take: perSource,
        select: { id: true, fullName: true, registeredAt: true, phone: true },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId, entityType: 'stock', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: perSource,
        select: { id: true, action: true, createdAt: true, after: true },
      }),
      this.prisma.driver.findMany({
        where: { tenantId, lastLocationAt: { gte: since } },
        orderBy: { lastLocationAt: 'desc' },
        take: perSource,
        include: { user: { select: { fullName: true } } },
      }),
    ]);

    const events: Event[] = [];

    for (const o of orders) {
      const status = o.status;
      const customerName = o.customer?.fullName ?? o.walkinBuyerName ?? 'زبون';
      let title: string;
      if (status === 'COMPLETED') title = `تمّ طلب ${customerName}`;
      else if (status === 'CANCELLED') title = `أُلغي طلب ${customerName}`;
      else if (status === 'EN_ROUTE') title = `سائق ينقل طلب ${customerName}`;
      else if (status === 'ASSIGNED') title = `تمّ تعيين سائق لطلب ${customerName}`;
      else title = `طلب جديد من ${customerName}`;
      // Subtitle: prefer tank capacity (refill — enum mapped to liters),
      // fall back to walkinLiters (walk-in sale), then to the price.
      let liters = 0;
      if (o.tank) liters = LITERS_BY_CAPACITY[o.tank.capacity];
      else if (o.walkinLiters) liters = o.walkinLiters;
      const subtitle = liters > 0
        ? `${liters.toLocaleString('en-US')} لتر`
        : `${(o.priceIqd ?? 0).toLocaleString('en-US')} د.ع`;
      events.push({
        id: `order:${o.id}`,
        kind: 'order',
        title,
        subtitle,
        createdAt: o.requestedAt.toISOString(),
        deeplink: `/orders/${o.id}`,
      });
    }

    for (const l of leads) {
      events.push({
        id: `lead:${l.id}`,
        kind: 'lead',
        title: `طلب انضمام: ${l.fullName}`,
        subtitle: l.phone ?? 'بانتظار المراجعة',
        createdAt: l.registeredAt.toISOString(),
        deeplink: `/customers/${l.id}`,
      });
    }

    for (const s of stockChanges) {
      // audit `after` is a JSON blob — try to extract liters if present
      let subtitle = 'تحديث المخزون';
      try {
        const after = s.after as any;
        if (after && typeof after.currentLiters === 'number') {
          subtitle = `الرصيد ${after.currentLiters.toLocaleString('en-US')} لتر`;
        }
      } catch {
        // swallow — subtitle stays as default
      }
      events.push({
        id: `stock:${s.id}`,
        kind: 'stock',
        title: s.action === 'topup' ? 'تعبئة مخزون' : 'تحديث مخزون',
        subtitle,
        createdAt: s.createdAt.toISOString(),
        deeplink: '/stock',
      });
    }

    for (const d of driverPings) {
      if (!d.lastLocationAt) continue;
      events.push({
        id: `driver:${d.id}:${d.lastLocationAt.getTime()}`,
        kind: 'driver',
        title: `${d.user.fullName} متصل`,
        subtitle: d.vehiclePlate ? `لوحة ${d.vehiclePlate}` : 'سائق نشط',
        createdAt: d.lastLocationAt.toISOString(),
        deeplink: `/drivers/${d.id}`,
      });
    }

    // Merge + sort by createdAt desc, then trim
    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return events.slice(0, n);
  }

  // ─── helpers ─────────────────────────────────────────────────────

  private async audit(
    user: AuthUser,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.id,
          actorName: user.phone,
          action,
          entityType,
          entityId,
          before: before as any,
          after: after as any,
        },
      });
    } catch (e: any) {
      // Audit failure should never block the action.
      console.warn('[audit] log failed:', e?.message);
    }
  }
}
