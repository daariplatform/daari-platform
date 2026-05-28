import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, WalletTopupSource } from '@prisma/client';
import { WalletService } from '../plant/wallet.service';

// OpenTelemetry's `require-in-the-middle` (loaded by Sentry's NestJS
// instrumentation) wraps every `require(...)` call in this codebase. On
// the live VPS that wrapping somehow returns a partial export for
// `@prisma/client` at *decorator-application time*, which makes the
// `WalletTopupSource` value undefined → `IsEnum(undefined)` crashes
// the entire request pipeline. The enum is still exported correctly at
// runtime (the service code can use it fine) — only the static
// decorator-time read is affected. We inline the enum string union for
// the validator's sake; the runtime `WalletTopupSource` Prisma type
// still drives the controller signature + service argument typing.
const WALLET_TOPUP_SOURCE_VALUES = ['CASH', 'BANK_TRANSFER', 'ZAINCASH', 'ASIACELL', 'OTHER'] as const;

class WalletTopupDto {
  @IsString()
  tenantId!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountIqd!: number;

  @IsEnum(WALLET_TOPUP_SOURCE_VALUES)
  source!: WalletTopupSource;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * Platform-admin (Ahmed / PhiBit) controls. All routes guarded by
 * UserRole.PLATFORM_ADMIN. Lives under /platform/* so it can never be
 * mistaken for a tenant-scoped route.
 *
 * Today: wallet top-ups for plant promo budgets.
 * Future: tenant suspension, plan changes, manual order overrides, etc.
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
// RolesGuard is NOT registered globally — the audit caught that `@Roles()`
// on individual handlers was inert here. Without this @UseGuards line, any
// authenticated user (even a CUSTOMER) could call /platform/wallets/topup
// and arbitrarily credit a tenant's promo wallet. CRITICAL fix.
@UseGuards(RolesGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(private wallet: WalletService) {}

  /** GET /platform/wallets — list every tenant + their current balance. */
  @Get('wallets')
  @Roles(UserRole.PLATFORM_ADMIN)
  async list() {
    return this.wallet.listAllTenantBalances();
  }

  /** GET /platform/wallets/:tenantId/topups — topup history for a tenant. */
  @Get('wallets/:tenantId/topups')
  @Roles(UserRole.PLATFORM_ADMIN)
  async topups(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.listTopups(
      tenantId,
      limit ? Math.min(200, Math.max(1, parseInt(limit, 10))) : 50,
    );
  }

  /** POST /platform/wallets/topup — Ahmed adds funds after off-platform settlement. */
  @Post('wallets/topup')
  @Roles(UserRole.PLATFORM_ADMIN)
  async topup(@CurrentUser() user: AuthUser, @Body() dto: WalletTopupDto) {
    return this.wallet.topup({
      tenantId: dto.tenantId,
      amountIqd: dto.amountIqd,
      source: dto.source,
      reference: dto.reference,
      note: dto.note,
      recordedById: user.id,
    });
  }
}
