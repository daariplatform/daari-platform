import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PromoService } from './promo.service';
import { WalletService } from './wallet.service';

class CreatePromoDto {
  @IsInt()
  @Min(1)
  promoPriceIqd!: number;

  @IsInt()
  @Min(1)
  @Max(48)
  durationHours!: number;
}

/**
 * Plant-owner facing promo endpoints. Mounted at /plant/promos so the
 * existing plant dashboard pattern (other /plant/* routes) is preserved.
 */
@ApiTags('plant-promos')
@ApiBearerAuth()
@Controller('plant/promos')
export class PromoCampaignController {
  constructor(
    private promo: PromoService,
    private wallet: WalletService,
  ) {}

  /** GET /plant/promos — list past + active campaigns for this tenant. */
  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  async list(@CurrentUser() user: AuthUser) {
    const [campaigns, walletBalance] = await Promise.all([
      this.promo.listCampaigns(user.tenantId!),
      this.wallet.getBalance(user.tenantId!),
    ]);
    return {
      walletBalanceIqd: walletBalance.promoWalletIqd,
      campaigns,
    };
  }

  /** POST /plant/promos — create + auto-fanout (≤48h, requires wallet ≥ 1k). */
  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePromoDto,
  ) {
    return this.promo.createCampaign(user.tenantId!, user.id, {
      promoPriceIqd: dto.promoPriceIqd,
      durationHours: dto.durationHours,
    });
  }

  /** POST /plant/promos/:id/pause — owner-initiated early stop. */
  @Post(':id/pause')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.promo.pauseCampaign(user.tenantId!, id, user.id);
  }
}
