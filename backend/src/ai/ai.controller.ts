import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserScopedCacheInterceptor } from '../cache/user-scoped-cache.interceptor';
import { AiService } from './ai.service';

/**
 * AI-driven analytics endpoints. Algorithmic only — no ML libraries — so the
 * outputs are explainable to the plant owner ("we flagged Ahmed because his
 * usual cadence is 7 days and he hasn't ordered in 18"). All endpoints are
 * GET-only, role-gated, and cached per-user for 60 s to absorb dashboard
 * polling without hammering Postgres.
 */
@ApiBearerAuth()
@ApiTags('ai')
@UseGuards(RolesGuard)
@Controller('plant/ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('demand-forecast')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(60_000)
  demandForecast(@CurrentUser() user: AuthUser) {
    return this.ai.demandForecast(user.tenantId!);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('churn-risk')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(60_000)
  churnRisk(@CurrentUser() user: AuthUser) {
    return this.ai.churnRisk(user.tenantId!);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('order-clusters')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(60_000)
  orderClusters(@CurrentUser() user: AuthUser) {
    return this.ai.orderClusters(user.tenantId!);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('driver-scorecard')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(60_000)
  driverScorecard(@CurrentUser() user: AuthUser) {
    return this.ai.driverScorecard(user.tenantId!);
  }
}
