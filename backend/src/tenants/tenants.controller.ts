import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsLatitude, IsLongitude, IsString, MinLength, IsEnum, IsOptional, Matches, Min } from 'class-validator';
import { SubscriptionPlan, TenantStatus, UserRole } from '@prisma/client';
import { TenantsService } from './tenants.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class RegisterTenantDto {
  @IsString() @MinLength(2)
  plantName!: string;

  @IsString()
  city!: string;

  @IsString() @MinLength(2)
  ownerFullName!: string;

  @Matches(/^07\d{9}$/)
  ownerPhone!: string;

  @IsString() @MinLength(8)
  ownerPassword!: string;

  @IsOptional() @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;
}

class BonusConfigDto {
  @IsOptional() @IsInt() @Min(0) refillBonusIqd?: number;
  @IsOptional() @IsInt() @Min(0) deliveryBonusIqd?: number;
  @IsOptional() @IsInt() @Min(0) reclaimBonusIqd?: number;
  @IsOptional() @IsInt() @Min(0) newCustomerBonusIqd?: number;
}

class RenewSubscriptionDto {
  @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
}

class SetStatusDto {
  @IsEnum(TenantStatus) status!: TenantStatus;
}

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterTenantDto) {
    return this.tenants.register(dto);
  }

  @ApiBearerAuth()
  @RequireCapability('plant_admin')
  @Get('me/stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.tenants.getDashboardStats(user.tenantId!);
  }

  /** Plant settings (prices, hours, coverage, bonuses) */
  @RequireCapability('plant_admin')
  @Get('me/settings')
  getMySettings(@CurrentUser() user: AuthUser) {
    return this.tenants.getSettings(user.tenantId!);
  }

  @RequireCapability('plant_admin')
  @Patch('me/settings')
  updateMySettings(@CurrentUser() user: AuthUser, @Body() dto: Record<string, unknown>) {
    // Pass the role so the service can enforce the "pricing is locked
    // for plant admins after onboarding completes" policy — see the
    // service for the full reasoning. Platform admins bypass this.
    return this.tenants.updateSettings(user.tenantId!, dto, user.role);
  }

  /** Reports — analytics بفترة (week/month/year) */
  @RequireCapability('plant_admin')
  @Get('me/reports')
  getReports(
    @CurrentUser() user: AuthUser,
    @Query('range') range: 'week' | 'month' | 'year' = 'month',
  ) {
    return this.tenants.getReports(user.tenantId!, range);
  }

  /**
   * Public lookup so a new customer can find which plant covers
   * their neighbourhood. Used during first-launch onboarding.
   */
  @Public()
  @Get('nearest')
  nearest(@Query('lng') lng: string, @Query('lat') lat: string) {
    return this.tenants.findNearestPlant(Number(lng), Number(lat));
  }

  /**
   * Public discovery — returns up to 10 plants within 30 km ordered by
   * "serves you?" first, then distance. Used by the customer mobile
   * Welcome screen so a prospect can pick a plant before signing up.
   */
  @Public()
  @Get('discover')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(5 * 60 * 1000) // 5 min — plant coverage areas change rarely
  discover(@Query('lng') lng: string, @Query('lat') lat: string) {
    // Note: default CacheInterceptor keys by request URL which includes the
    // lng/lat (and any radius) querystring, so each location bucket gets
    // its own cache entry naturally.
    return this.tenants.discoverPlants(Number(lng), Number(lat));
  }

  /** Plant owner with multiple branches lists them for the switcher. */
  @RequireCapability('plant_admin')
  @Get('my-plants')
  myPlants(@CurrentUser() user: AuthUser) {
    return this.tenants.listForOwner(user.phone);
  }

  /** Owner / manager configures driver bonuses for THIS plant. */
  @RequireCapability('plant_admin')
  @Post('me/bonuses')
  updateBonuses(@CurrentUser() user: AuthUser, @Body() dto: BonusConfigDto) {
    return this.tenants.updateBonuses(user.tenantId!, dto);
  }

  /** Drives the expiry banner + renew button on the plant's dashboard. */
  @RequireCapability('plant_admin')
  @Get('me/subscription')
  mySubscription(@CurrentUser() user: AuthUser) {
    return this.tenants.getSubscriptionStatus(user.tenantId!);
  }

  // NOTE: the former POST /tenants/me/renew (plant self-renew) was REMOVED.
  // It activated a paid subscription with zero payment gate — any plant owner
  // could renew themselves free, forever, bypassing the cash-to-platform model.
  // Renewal is a platform-admin action only: POST /tenants/:id/renew below.

  // ─── Platform admin (you, the SaaS owner) ─────────────────────────

  @RequireCapability('platform_admin')
  @Get('platform/overview')
  platformOverview() {
    return this.tenants.platformOverview();
  }

  @RequireCapability('platform_admin')
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewSubscriptionDto) {
    return this.tenants.renewSubscription(id, dto.plan);
  }

  @RequireCapability('platform_admin')
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.tenants.setStatus(id, dto.status);
  }
}
