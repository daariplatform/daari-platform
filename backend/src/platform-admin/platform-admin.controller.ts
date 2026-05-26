import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

class WalletTopupDto {
  @IsString()
  tenantId!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountIqd!: number;

  @IsEnum(WalletTopupSource)
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
