import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod, RefillOrderKind, RefillOrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { DriversService } from '../drivers/drivers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateOrderDto {
  @IsString()
  customerId!: string;

  @IsOptional() @IsString()
  tankId?: string;

  @IsOptional() @IsEnum(RefillOrderKind)
  kind?: RefillOrderKind;

  @IsOptional() @IsDateString()
  scheduledFor?: string;

  @IsOptional() @IsInt() @Min(0)
  priceIqd?: number;
}

class AssignOrderDto {
  @IsString() driverId!: string;
}

class CompleteOrderDto {
  @IsOptional() @IsString()
  qrCode?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsInt() @Min(0)
  paidAmountIqd!: number;

  @IsOptional() @IsString()
  proofPhotoUrl?: string;

  @IsOptional()
  completionLng?: number;

  @IsOptional()
  completionLat?: number;
}

class CancelOrderDto {
  @IsString() reason!: string;
}

class DisputeDto {
  @IsString() reason!: string;
}

@ApiBearerAuth()
@ApiTags('orders')
@UseGuards(RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private drivers: DriversService,
  ) {}

  @RequireCapability('plant_admin', 'customer')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.tenantId!, {
      ...dto,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: RefillOrderStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.orders.list(user.tenantId!, status, driverId);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignOrderDto) {
    return this.orders.assign(user.tenantId!, id, dto.driverId);
  }

  @RequireCapability('driver')
  @Get('me/today')
  async myToday(@CurrentUser() user: AuthUser) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.orders.myTasksToday(driver.id);
  }

  @RequireCapability('driver')
  @Post(':id/start')
  async start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.orders.start(id, driver.id);
  }

  @RequireCapability('driver')
  @Post(':id/complete')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteOrderDto,
  ) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.orders.complete(id, driver.id, dto);
  }

  @RequireCapability('plant_admin', 'driver')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(id, dto.reason);
  }

  @RequireCapability('customer')
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.confirmRefill(id, user.id);
  }

  @RequireCapability('customer')
  @Post(':id/dispute')
  dispute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DisputeDto) {
    return this.orders.disputeRefill(id, user.id, dto.reason);
  }
}
