import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { UserRole } from '@prisma/client';
import { RatingsService } from './ratings.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class RateOrderDto {
  @IsInt() @Min(1) @Max(5)
  stars!: number;

  @IsOptional() @IsString() @MaxLength(500)
  comment?: string;
}

/**
 * POST /orders/:id/rate — customer leaves a 1..5 star rating (+ optional
 * comment) on a COMPLETED order they own. One rating per order (re-rating
 * updates the existing row). Mounted under the /orders base path so it sits
 * alongside the rest of the order actions on the customer app.
 */
@ApiBearerAuth()
@ApiTags('ratings')
@UseGuards(RolesGuard)
@Controller('orders')
export class OrderRatingController {
  constructor(private ratings: RatingsService) {}

  @RequireCapability('customer')
  @Post(':id/rate')
  rate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RateOrderDto,
  ) {
    return this.ratings.rateOrder(user.id, id, {
      stars: dto.stars,
      comment: dto.comment,
    });
  }
}

/**
 * GET /drivers/:id/ratings — recent ratings for a driver, for the dashboard
 * driver-detail page. Tenant-scoped to OWNER/MANAGER/ACCOUNTANT.
 */
@ApiBearerAuth()
@ApiTags('ratings')
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriverRatingsController {
  constructor(private ratings: RatingsService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get(':id/ratings')
  driverRatings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    return this.ratings.recentForDriver(user.tenantId!, id, n);
  }
}
