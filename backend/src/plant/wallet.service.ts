import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTopupSource } from '@prisma/client';

/**
 * Promo wallet — owned by each Tenant, topped up exclusively by
 * PLATFORM_ADMIN (Ahmed/PhiBit) after off-platform cash/bank settlement.
 *
 * NO refund flow exists by design: once funded, the money is committed.
 * Deductions happen via PromoService.chargeOrderCompletion.
 */
@Injectable()
export class WalletService {
  private readonly log = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  /** Top up a tenant's promo wallet. Called from /platform/wallet/topup. */
  async topup(input: {
    tenantId: string;
    amountIqd: number;
    source: WalletTopupSource;
    reference?: string;
    note?: string;
    recordedById: string;
  }) {
    if (input.amountIqd <= 0) {
      throw new BadRequestException('المبلغ يجب أن يكون أكبر من صفر');
    }
    if (input.amountIqd > 100_000_000) {
      // Sanity cap — prevents typos like accidentally adding 6 zeros.
      throw new BadRequestException('المبلغ يتجاوز الحد الأقصى المسموح');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true, promoWalletIqd: true },
    });
    if (!tenant) throw new NotFoundException('المعمل غير موجود');

    // Atomic: bump wallet + insert audit row together.
    const [updated, topupRow] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: input.tenantId },
        data: { promoWalletIqd: { increment: input.amountIqd } },
        select: { id: true, name: true, promoWalletIqd: true },
      }),
      this.prisma.walletTopup.create({
        data: {
          tenantId: input.tenantId,
          amountIqd: input.amountIqd,
          // We'll patch balanceAfterIqd via a second update — Prisma can't
          // see the just-incremented tenant value from inside the same
          // transaction without an extra round-trip.
          balanceAfterIqd: tenant.promoWalletIqd + input.amountIqd,
          source: input.source,
          reference: input.reference,
          note: input.note,
          recordedById: input.recordedById,
        },
      }),
    ]);

    this.log.log(
      `Wallet topup: tenant=${updated.name} +${input.amountIqd} → balance=${updated.promoWalletIqd}`,
    );

    return { tenant: updated, topup: topupRow };
  }

  /** Get current wallet balance for a tenant. Platform-admin OR the tenant itself. */
  async getBalance(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, promoWalletIqd: true },
    });
    if (!tenant) throw new NotFoundException('المعمل غير موجود');
    return tenant;
  }

  /** Topup history for a tenant. */
  async listTopups(tenantId: string, limit = 50) {
    return this.prisma.walletTopup.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Platform-admin overview: all tenants + their current balances. */
  async listAllTenantBalances() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        ownerName: true,
        promoWalletIqd: true,
        status: true,
        plan: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
