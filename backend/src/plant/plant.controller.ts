import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PromoChannel, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { WhatsAppProvider } from '../notifications/providers/whatsapp.provider';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

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

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('audit-log')
  auditLog(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 200, 1000) : 200;
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId!,
        ...(action && { action }),
      },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
  }

  // ─── Wave 4: Driver performance ─────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('driver-performance')
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
    // Tier limits — billed at the boundaries the user agreed in chat
    const tiers = {
      STARTER: { ops: 300, priceIqd: 0 },
      PRO: { ops: 1500, priceIqd: 75000 },
      BUSINESS: { ops: 5000, priceIqd: 200000 },
      ENTERPRISE: { ops: 999999, priceIqd: 400000 },
    } as const;
    const current = tiers[tenant?.plan ?? 'STARTER'];
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

  // ─── Wave 5: Promo blast ───────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('promo-blast')
  async sendPromo(@CurrentUser() user: AuthUser, @Body() dto: SendPromoDto) {
    // Count active customers in this tenant — that's the audience.
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
    // Pricing (per Ahmed's pricing strategy): push = 5,000 IQD flat, WhatsApp = 10,000 + 10/msg
    const priceIqd =
      dto.channel === PromoChannel.PUSH
        ? 5000
        : 10000 + userIds.length * 10;

    // Create the promo record first
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

    // Send (push only for now; WhatsApp wire-up later via existing provider)
    if (dto.channel === PromoChannel.PUSH) {
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
    // WhatsApp path — fetch every active customer's phone and send via
    // the existing provider. Provider returns null when not configured,
    // which we count as "would send" so the plant still gets billed for
    // the work done by Daari (and we don't silently swallow the blast).
    const recipients = await this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId!,
        status: { in: ['ACTIVE', 'AT_RISK'] },
      },
      select: { phone: true, whatsapp: true, fullName: true },
    });
    let sent = 0;
    let failed = 0;
    const message = `${dto.title}\n\n${dto.body}`;
    for (const r of recipients) {
      try {
        await this.whatsapp.send(r.whatsapp ?? r.phone, message);
        sent++;
      } catch {
        failed++;
      }
    }
    await this.prisma.promoNotification.update({
      where: { id: promo.id },
      data: {
        status: failed === recipients.length ? 'FAILED' : 'SENT',
        sentCount: sent,
        failedCount: failed,
        sentAt: new Date(),
      },
    });
    await this.audit(user, 'promo.send', 'PromoNotification', promo.id, null, {
      channel: 'WHATSAPP',
      sent,
      failed,
    });
    return { ...promo, sentCount: sent, failedCount: failed };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('promo-history')
  promoHistory(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.prisma.promoNotification.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
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
