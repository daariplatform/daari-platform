import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { PromoCampaignStatus, Prisma } from '@prisma/client';

/**
 * Plant-promo system — price-discount campaigns paid out of a pre-funded
 * promo wallet. See the schema comment on PromoCampaign for the full
 * money flow. Key invariants this service guards:
 *
 *   1. At most ONE active campaign per tenant at any moment.
 *   2. Window length ≤ 48 hours (the upper limit Ahmed set).
 *   3. promoPriceIqd MUST be strictly less than originalPriceIqd —
 *      otherwise it's not a discount, and the customer-facing copy
 *      ("بدلاً من X") would be a lie.
 *   4. Wallet must have at least 1× costPerOrderIqd at start, otherwise
 *      the campaign would expire on its first order.
 *   5. Owner can pause at will; pausing doesn't refund anything.
 *   6. Deductions happen on order COMPLETION, not creation — refunds-on-
 *      cancellation are then automatic (we never charged in the first place).
 */

const MAX_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h
const DEFAULT_COST_PER_ORDER = 1000; // IQD

@Injectable()
export class PromoService {
  private readonly log = new Logger(PromoService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // ───────────────────────────────────────────────────────────────────
  // Plant owner: create / list / pause campaigns
  // ───────────────────────────────────────────────────────────────────

  async createCampaign(
    tenantId: string,
    createdById: string,
    input: {
      promoPriceIqd: number;
      durationHours: number; // 1–48
      // Optional override; defaults to current tenant.refillPriceIqd snapshot.
      originalPriceIqd?: number;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { refillPriceIqd: true, promoWalletIqd: true, name: true },
    });
    if (!tenant) throw new NotFoundException('المعمل غير موجود');

    const originalPriceIqd = input.originalPriceIqd ?? tenant.refillPriceIqd;

    if (input.promoPriceIqd >= originalPriceIqd) {
      throw new BadRequestException(
        'سعر العرض يجب أن يكون أقل من السعر العادي',
      );
    }
    if (input.promoPriceIqd < 0) {
      throw new BadRequestException('سعر العرض غير صحيح');
    }
    if (input.durationHours < 1 || input.durationHours > 48) {
      throw new BadRequestException('مدّة العرض بين ساعة و 48 ساعة');
    }
    if (tenant.promoWalletIqd < DEFAULT_COST_PER_ORDER) {
      throw new BadRequestException(
        `رصيد المحفظة لا يكفي. الحد الأدنى ${DEFAULT_COST_PER_ORDER} د.ع — تواصل مع داري للشحن.`,
      );
    }

    // Reject if there's already an active campaign — one at a time keeps the
    // customer UX simple (the CTA can show exactly one discount).
    const existingActive = await this.prisma.promoCampaign.findFirst({
      where: { tenantId, status: PromoCampaignStatus.ACTIVE },
    });
    if (existingActive) {
      throw new BadRequestException(
        'يوجد عرض نشط بالفعل. أوقفه أو انتظر انتهاءه.',
      );
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + input.durationHours * 60 * 60 * 1000);

    const campaign = await this.prisma.promoCampaign.create({
      data: {
        tenantId,
        originalPriceIqd,
        promoPriceIqd: input.promoPriceIqd,
        costPerOrderIqd: DEFAULT_COST_PER_ORDER,
        startAt,
        endAt,
        status: PromoCampaignStatus.ACTIVE,
        walletBalanceAtStartIqd: tenant.promoWalletIqd,
        createdById,
      },
    });

    // Fan out push to every active customer. Best-effort — campaign exists
    // regardless of delivery success; the customer app polls the active-promo
    // endpoint anyway when opened.
    this.fanoutPush(tenantId, campaign).catch((err) =>
      this.log.warn(`promo push fanout failed: ${(err as Error).message}`),
    );

    return campaign;
  }

  private async fanoutPush(tenantId: string, campaign: { id: string; promoPriceIqd: number; originalPriceIqd: number; endAt: Date }) {
    const activeCustomers = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: 'CUSTOMER',
        isActive: true,
        customer: { status: { in: ['ACTIVE', 'AT_RISK'] } },
      },
      select: { id: true },
    });

    if (activeCustomers.length === 0) return;

    const result = await this.push.sendToUsers(
      activeCustomers.map((u) => u.id),
      '🎉 عرض خاص لفترة محدودة!',
      `تعبئة الماء بـ ${campaign.promoPriceIqd.toLocaleString('en-US')} د.ع بدلاً من ${campaign.originalPriceIqd.toLocaleString('en-US')} د.ع — اطلب الآن`,
      { kind: 'promo', promoCampaignId: campaign.id, screen: 'home' },
    );

    await this.prisma.promoCampaign.update({
      where: { id: campaign.id },
      data: {
        pushSentCount: result.sent,
        pushFailedCount: result.failed,
      },
    });
  }

  /** List all campaigns for a tenant, newest first. */
  async listCampaigns(tenantId: string) {
    return this.prisma.promoCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Owner-initiated pause. Does NOT refund anything. */
  async pauseCampaign(tenantId: string, campaignId: string, pausedByUserId: string) {
    const campaign = await this.prisma.promoCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new NotFoundException('العرض غير موجود');
    if (campaign.status !== PromoCampaignStatus.ACTIVE) {
      throw new BadRequestException('العرض غير نشط');
    }
    return this.prisma.promoCampaign.update({
      where: { id: campaignId },
      data: {
        status: PromoCampaignStatus.PAUSED_BY_OWNER,
        pausedAt: new Date(),
        pausedByUserId,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Customer-facing read — current active promo for a tenant (if any)
  // ───────────────────────────────────────────────────────────────────

  /**
   * Returns the campaign a customer's CTA should display, or null. Auto-
   * expires stale ACTIVE rows whose endAt has passed (cheap maintenance
   * triggered by reads — avoids a separate cron).
   */
  async getActiveForTenant(tenantId: string): Promise<{
    id: string;
    originalPriceIqd: number;
    promoPriceIqd: number;
    endAt: Date;
    secondsRemaining: number;
  } | null> {
    const now = new Date();

    // Lazy-expire anything whose window has passed. Single UPDATE so we
    // don't race ourselves on concurrent reads.
    await this.prisma.promoCampaign.updateMany({
      where: {
        tenantId,
        status: PromoCampaignStatus.ACTIVE,
        endAt: { lte: now },
      },
      data: { status: PromoCampaignStatus.EXPIRED },
    });

    const active = await this.prisma.promoCampaign.findFirst({
      where: {
        tenantId,
        status: PromoCampaignStatus.ACTIVE,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: {
        id: true,
        originalPriceIqd: true,
        promoPriceIqd: true,
        endAt: true,
      },
    });

    if (!active) return null;
    return {
      ...active,
      secondsRemaining: Math.max(0, Math.floor((active.endAt.getTime() - now.getTime()) / 1000)),
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // Called from OrdersService at completion time (transactional)
  // ───────────────────────────────────────────────────────────────────

  /**
   * Charge a tenant's wallet for ONE completed promo order. Atomic: either
   * wallet, campaign counters, and the audit happen together, or none do.
   * If the wallet would go negative we still allow this order to settle
   * (it was already promised to the customer at the discounted price) but
   * we flip the campaign to OUT_OF_BUDGET so no further orders pile up.
   *
   * Returns true if the campaign is still ACTIVE after this charge, false
   * if it auto-expired (out of budget OR window elapsed).
   */
  async chargeOrderCompletion(tx: Prisma.TransactionClient, campaignId: string, orderRevenueIqd: number): Promise<boolean> {
    const campaign = await tx.promoCampaign.findUnique({
      where: { id: campaignId },
      select: { tenantId: true, costPerOrderIqd: true, status: true, endAt: true },
    });
    if (!campaign) return false;

    // Race-safe deduction. Decrement wallet, increment counters, and check
    // post-state in a single round-trip per table.
    const updatedTenant = await tx.tenant.update({
      where: { id: campaign.tenantId },
      data: {
        promoWalletIqd: { decrement: campaign.costPerOrderIqd },
      },
      select: { promoWalletIqd: true },
    });

    await tx.promoCampaign.update({
      where: { id: campaignId },
      data: {
        orderCount: { increment: 1 },
        totalDeductedIqd: { increment: campaign.costPerOrderIqd },
        totalRevenueIqd: { increment: orderRevenueIqd },
      },
    });

    const now = new Date();
    let stillActive = campaign.status === PromoCampaignStatus.ACTIVE;

    // Trigger auto-expiry if either wallet ran out OR the window elapsed.
    if (updatedTenant.promoWalletIqd < campaign.costPerOrderIqd) {
      await tx.promoCampaign.update({
        where: { id: campaignId },
        data: { status: PromoCampaignStatus.OUT_OF_BUDGET },
      });
      stillActive = false;
    } else if (campaign.endAt.getTime() <= now.getTime()) {
      await tx.promoCampaign.update({
        where: { id: campaignId },
        data: { status: PromoCampaignStatus.EXPIRED },
      });
      stillActive = false;
    }

    return stillActive;
  }
}
