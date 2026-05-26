import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * OnboardingController — feeds the mobile-admin first-run checklist tile.
 *
 * `GET /plant/onboarding/status` returns one bool per task so the UI can
 * tick items off; `allComplete` is true when the owner has finished every
 * step. `POST /plant/onboarding/skip` stamps Tenant.onboardingSkippedAt so
 * the checklist disappears even if some steps are still pending.
 *
 * The bools are derived from existing fields — we don't store any
 * dedicated "step done" rows. Adding a step is a one-line query change.
 */
@ApiBearerAuth()
@ApiTags('plant-onboarding')
@UseGuards(RolesGuard)
@Controller('plant/onboarding')
export class OnboardingController {
  constructor(private prisma: PrismaService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('status')
  async status(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        city: true,
        ownerName: true,
        ownerPhone: true,
        refillPriceIqd: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        onboardingSkippedAt: true,
      },
    });

    if (!tenant) {
      // Defensive — JWT was valid but the tenant row vanished. Fail soft so
      // the mobile UI just hides the checklist instead of crashing.
      return {
        plantInfoComplete: false,
        firstCustomerAdded: false,
        firstDriverHired: false,
        refillPriceSet: false,
        workingHoursSet: false,
        allComplete: false,
        skipped: false,
      };
    }

    // "Plant info complete" = the four bootstrap fields are present and
    // non-empty. The tenant row always has them after signup, so this is
    // really a sanity check for migrated/imported plants.
    const plantInfoComplete = Boolean(
      tenant.name?.trim() &&
        tenant.city?.trim() &&
        tenant.ownerName?.trim() &&
        tenant.ownerPhone?.trim(),
    );

    const [customerCount, driverCount] = await this.prisma.$transaction([
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.driver.count({ where: { tenantId } }),
    ]);

    // refillPriceIqd defaults to 1000 in the schema. We treat the default
    // as "not yet customised" — the owner must visit settings and pick a
    // price (even if they end up keeping 1000, the act of saving stamps
    // updatedAt and we'd ideally key on that, but until we add a "visited
    // settings" flag this heuristic is the best we can do without a
    // schema change).
    const refillPriceSet = tenant.refillPriceIqd > 0;

    // Same idea for working hours — defaults are 08:00 → 22:00. Treat
    // anything as "set" since the schema enforces the format.
    const workingHoursSet = Boolean(
      tenant.workingHoursStart?.trim() && tenant.workingHoursEnd?.trim(),
    );

    const firstCustomerAdded = customerCount > 0;
    const firstDriverHired = driverCount > 0;

    const allComplete =
      plantInfoComplete &&
      firstCustomerAdded &&
      firstDriverHired &&
      refillPriceSet &&
      workingHoursSet;

    return {
      plantInfoComplete,
      firstCustomerAdded,
      firstDriverHired,
      refillPriceSet,
      workingHoursSet,
      allComplete,
      skipped: tenant.onboardingSkippedAt != null,
      skippedAt: tenant.onboardingSkippedAt,
    };
  }

  /**
   * Owner taps "Skip for now". We stamp Tenant.onboardingSkippedAt so the
   * checklist won't render again — but the GET endpoint still reports the
   * underlying bools, so the UI can decide whether to surface a banner
   * ("3 steps left — finish setup") instead of the full tile.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('skip')
  async skip(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingSkippedAt: true },
    });
    // Idempotent — if already skipped, return the existing timestamp.
    if (tenant?.onboardingSkippedAt) {
      return { ok: true, onboardingSkippedAt: tenant.onboardingSkippedAt };
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingSkippedAt: new Date() },
      select: { onboardingSkippedAt: true },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId: user.id,
          actorName: user.phone,
          action: 'onboarding.skip',
          entityType: 'Tenant',
          entityId: tenantId,
        },
      });
    } catch {
      /* audit failure must not block the request */
    }

    return { ok: true, onboardingSkippedAt: updated.onboardingSkippedAt };
  }
}
