import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod, RefillOrderKind, RefillOrderStatus, TankReclaimReason, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { DriversService } from '../drivers/drivers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

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

  // ── Reclaim-only fields ──
  // مطلوبة فقط عند tank-reclaim؛ الـ service يتحقق
  // من وجود `reclaimReason` لو الطلب من نوع TANK_RECLAIM.
  @IsOptional() @IsEnum(TankReclaimReason)
  reclaimReason?: TankReclaimReason;

  @IsOptional() @IsString()
  reclaimNotes?: string;
}

class CancelOrderDto {
  // Customers can now cancel their own PENDING orders, so the reason
  // becomes optional — defaults to "ألغاه الزبون" if omitted. Drivers
  // and plant admins still expected to provide a real reason.
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

class DisputeDto {
  @IsString() reason!: string;
}

class WalkinRefillDto {
  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  walkinBuyerName?: string;

  @IsOptional() @IsString()
  walkinBuyerPhone?: string;

  @IsOptional() @IsInt() @Min(1)
  walkinLiters?: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsInt() @Min(0)
  paidAmountIqd!: number;

  @IsString()
  proofPhotoUrl!: string;

  @IsOptional()
  completionLng?: number;

  @IsOptional()
  completionLat?: number;
}

/**
 * Plant-admin walk-in sale — simpler shape than the driver's field DTO
 * because the manager is at the plant: no GPS coordinates, no photo
 * proof, no payment-method picker (defaults to CASH). All the manager
 * supplies is the buyer name/phone (both optional, since a true walk-in
 * may be anonymous) plus the liters/price/paid amounts.
 */
class WalkinAdminDto {
  @IsOptional() @IsString() @MaxLength(80)
  customerName?: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsInt() @Min(1)
  liters!: number;

  @IsInt() @Min(0)
  priceIqd!: number;

  @IsOptional() @IsInt() @Min(0)
  paidAmountIqd?: number;
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: RefillOrderStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.orders.list(
      user.tenantId!,
      status,
      driverId,
      pagination.page,
      pagination.pageSize,
    );
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

  /**
   * Driver's full history (completed + cancelled + active). Used by
   * mobile-worker's History tab. Newest first, limited to 100 by default.
   */
  @RequireCapability('driver')
  @Get('me/history')
  async myHistory(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    const n = limit ? Math.min(parseInt(limit, 10) || 100, 200) : 100;
    return this.orders.listMyHistory(driver.id, n);
  }

  /**
   * Customer's own order history. Used by mobile-customer "نشاطك الأخير"
   * + the full orders tab. Filters by customer.userId so the customer
   * can only see their own — no tenant leak possible.
   * Must come BEFORE any /:id route to avoid "me" being matched as an id.
   */
  @RequireCapability('customer')
  @Get('me')
  async myOrders(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.orders.listByCustomerUser(user.id, n);
  }

  /**
   * Walk-in sale recorded by a driver. Either `customerId` (existing
   * out-of-cycle customer) OR `walkinBuyerName/Phone/Liters` (one-off
   * passerby). Pre-completed in one POST.
   */
  @RequireCapability('driver')
  @Post('walkin-refill')
  async walkinRefill(@CurrentUser() user: AuthUser, @Body() dto: WalkinRefillDto) {
    const driver = await this.drivers.getMyDriverProfile(user.id);
    return this.orders.createWalkinRefill(user.tenantId!, driver.id, dto);
  }

  /**
   * Plant-admin counter sale. Used when the manager records a walk-in
   * customer at the plant itself (someone arrives with their own
   * jerrycans, no driver, no field visit). Defaults to CASH and skips
   * the GPS/photo-proof requirements that apply to driver field sales.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('walkin-admin')
  async walkinAdmin(@CurrentUser() user: AuthUser, @Body() dto: WalkinAdminDto) {
    return this.orders.createAdminWalkinSale(user.tenantId!, user.id, dto);
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

  /**
   * Cancel an order. Allowed for:
   *   - plant_admin  → cancels any order in the tenant
   *   - driver       → cancels their own assigned order ("no-customer at door")
   *   - customer     → cancels their own pending order (before driver assigned)
   *
   * The service-layer guards the customer/driver path by verifying
   * ownership AND that the order is still in a cancellable state
   * (PENDING/ASSIGNED, not COMPLETED/CANCELLED already).
   */
  @RequireCapability('plant_admin', 'driver', 'customer')
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(id, dto.reason, user);
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
