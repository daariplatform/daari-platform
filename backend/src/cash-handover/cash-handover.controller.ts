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
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CashHandoverStatus, UserRole } from '@prisma/client';
import { CashHandoverService } from './cash-handover.service';
import { DriversService } from '../drivers/drivers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateHandoverDto {
  @IsInt() @Min(1)
  amountIqd!: number;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;

  // Idempotency key (UUID) — guards a double-tap / retried handover from being
  // recorded twice. Optional → legacy clients omit it.
  @IsOptional() @IsString() @MaxLength(64)
  clientRequestId?: string;
}

/**
 * Driver-side cash handover endpoints. Mounted under /drivers so they read as
 * /drivers/me/cash-handover etc. All `me/...` specific paths — declared on a
 * separate controller from DriversController, but neither defines a bare
 * `GET /drivers/:id`, so there is no route-shadowing hazard. The driver is
 * resolved from the JWT via DriversService.getMyDriverProfile.
 */
@ApiBearerAuth()
@ApiTags('cash-handover')
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriverCashController {
  constructor(
    private cash: CashHandoverService,
    private drivers: DriversService,
  ) {}

  @RequireCapability('driver')
  @Post('me/cash-handover')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateHandoverDto) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.cash.createForDriver(driver.tenantId, driver.id, {
      amountIqd: dto.amountIqd,
      note: dto.note,
      clientRequestId: dto.clientRequestId,
    });
  }

  @RequireCapability('driver')
  @Get('me/cash-handovers')
  async list(@CurrentUser() user: AuthUser) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.cash.listForDriver(driver.id);
  }

  @RequireCapability('driver')
  @Get('me/cash-summary')
  async summary(@CurrentUser() user: AuthUser) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.cash.summaryForDriver(driver.id);
  }
}

/**
 * Plant-side cash handover oversight. OWNER/MANAGER/ACCOUNTANT can list the
 * tenant's handovers; OWNER/MANAGER can confirm receipt. Tenant-scoped.
 */
@ApiBearerAuth()
@ApiTags('cash-handover')
@UseGuards(RolesGuard)
@Controller('plant')
export class PlantCashController {
  constructor(private cash: CashHandoverService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'status', required: false, enum: CashHandoverStatus })
  @Get('cash-handovers')
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: CashHandoverStatus,
  ) {
    return this.cash.listForTenant(user.tenantId!, status);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('cash-handovers/:id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cash.confirm(user.tenantId!, id);
  }
}
