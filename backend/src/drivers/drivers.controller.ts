import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  Min,
  IsInt,
  MinLength,
} from 'class-validator';
import { DriverStatus, UserRole } from '@prisma/client';
import { DriversService } from './drivers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

class CreateDriverDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  /**
   * Optional. If omitted, the backend generates a random 6-char password
   * and returns it once in the response. Plant admin hands it to the
   * driver verbally or via WhatsApp.
   */
  @IsOptional() @IsString() @MinLength(6)
  password?: string;

  @IsOptional() @IsString()
  vehiclePlate?: string;

  @IsOptional() @IsInt() @Min(0)
  baseSalaryIqd?: number;

  /** Alias accepted from the mobile-admin "hire driver" form. */
  @IsOptional() @IsInt() @Min(0)
  salaryIqd?: number;

  @IsOptional() @IsInt() @Min(0)
  commissionPerRefillIqd?: number;

  /** Alias — mobile uses baseCommissionPct in the form but persists as IQD per refill.
   *  When provided, we treat it as IQD per refill (no FX conversion). */
  @IsOptional() @IsInt() @Min(0)
  baseCommissionPct?: number;

  @IsOptional() @IsDateString()
  joinDate?: string;
}

class UpdateDriverDto {
  @IsOptional() @IsString() @MinLength(2)
  fullName?: string;

  @IsOptional() @IsString()
  vehiclePlate?: string;

  @IsOptional() @IsInt() @Min(0)
  baseSalaryIqd?: number;

  @IsOptional() @IsInt() @Min(0)
  salaryIqd?: number;

  @IsOptional() @IsInt() @Min(0)
  commissionPerRefillIqd?: number;

  @IsOptional() @IsInt() @Min(0)
  baseCommissionPct?: number;

  @IsOptional() @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

class ResetDriverPasswordDto {
  @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

class PingLocationDto {
  @IsLongitude()
  lng!: number;

  @IsLatitude()
  lat!: number;
}

class StatusDto {
  @IsEnum(DriverStatus)
  status!: DriverStatus;
}

class VanInventoryDto {
  @IsInt() @Min(0)
  tanksFullOnVan!: number;

  @IsInt() @Min(0)
  tanksEmptyOnVan!: number;
}

@ApiBearerAuth()
@ApiTags('drivers')
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private drivers: DriversService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDriverDto) {
    return this.drivers.create(user.tenantId!, {
      fullName: dto.fullName,
      phone: dto.phone,
      password: dto.password,
      vehiclePlate: dto.vehiclePlate,
      // Accept either canonical field or mobile-form alias.
      baseSalaryIqd: dto.baseSalaryIqd ?? dto.salaryIqd,
      commissionPerRefillIqd:
        dto.commissionPerRefillIqd ?? dto.baseCommissionPct,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.drivers.update(user.tenantId!, id, {
      fullName: dto.fullName,
      vehiclePlate: dto.vehiclePlate,
      baseSalaryIqd: dto.baseSalaryIqd ?? dto.salaryIqd,
      commissionPerRefillIqd:
        dto.commissionPerRefillIqd ?? dto.baseCommissionPct,
      status: dto.status,
      isActive: dto.isActive,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(':id')
  softDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drivers.softDelete(user.tenantId!, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.drivers.list(user.tenantId!, pagination.page, pagination.pageSize);
  }

  /**
   * Live tracking — كل سائقي المعمل مع آخر موقع + علم inactivity (لو
   * `lastLocationAt` أقدم من ٣٠ دقيقة). الداشبورد يستدعيها كل ١٥ ثانية.
   * يجب أن تأتي قبل /:id حتى لا تُطابق "live" كـ ID.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('live')
  liveLocations(@CurrentUser() user: AuthUser) {
    return this.drivers.liveLocations(user.tenantId!);
  }

  /**
   * Route history — مسار سائق ليوم محدد. الداشبورد يستعملها لرسم خط
   * على الخريطة. `date` بصيغة YYYY-MM-DD (افتراضياً اليوم).
   * يجب أن تأتي قبل /:id العامة.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get(':id/route')
  driverRoute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('date') date?: string,
  ) {
    return this.drivers.routeForDate(user.tenantId!, id, date);
  }

  @RequireCapability('driver')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.drivers.getMyDriverProfile(user.id);
  }

  @RequireCapability('driver')
  @Post('me/location')
  async ping(@CurrentUser() user: AuthUser, @Body() dto: PingLocationDto) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    await this.drivers.pingLocation(profile.id, dto.lng, dto.lat);
    return { ok: true };
  }

  @RequireCapability('driver')
  @Post('me/status')
  async setStatus(@CurrentUser() user: AuthUser, @Body() dto: StatusDto) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    return this.drivers.setStatus(profile.id, dto.status);
  }

  /**
   * Driver-scoped performance summary for the mobile worker profile.
   * Same shape as `/drivers/:id/perf` but the driver passes no id —
   * the resolved driver profile is read from `user.id`. Gated to the
   * driver capability so plant admins must use the id-bearing route.
   */
  @RequireCapability('driver')
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month'] })
  @Get('me/perf')
  async myPerf(@CurrentUser() user: AuthUser, @Query('period') period?: string) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    const p: 'week' | 'month' = period === 'week' ? 'week' : 'month';
    return this.drivers.performanceByPeriod(profile.tenantId, profile.id, p);
  }

  /**
   * Daily earnings series for the worker earnings-over-time chart. One row per
   * day in the window (week = last 7 days, month = since the 1st).
   */
  @RequireCapability('driver')
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month'] })
  @Get('me/earnings')
  async myEarnings(@CurrentUser() user: AuthUser, @Query('period') period?: string) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    const p: 'week' | 'month' = period === 'week' ? 'week' : 'month';
    return this.drivers.earningsByPeriod(profile.id, p);
  }

  /** Today's shift summary (completed count, cash collected, per-kind breakdown). */
  @RequireCapability('driver')
  @Get('me/shift-summary')
  async myShiftSummary(@CurrentUser() user: AuthUser) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    return this.drivers.shiftSummary(profile.id);
  }

  /** Driver updates the full/empty tank counts loaded on their van. */
  @RequireCapability('driver')
  @Post('me/van-inventory')
  async myVanInventory(
    @CurrentUser() user: AuthUser,
    @Body() dto: VanInventoryDto,
  ) {
    const profile = await this.drivers.getMyDriverProfile(user.id);
    return this.drivers.updateVanInventory(
      profile.id,
      dto.tanksFullOnVan,
      dto.tanksEmptyOnVan,
    );
  }

  /**
   * Plant admin force-resets a driver's password. Returns the new value
   * ONCE; existing sessions are revoked so the driver app signs out.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetDriverPasswordDto,
  ) {
    return this.drivers.resetPassword(user.tenantId!, id, dto.password);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get(':id/performance')
  performance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.drivers.performance(
      user.tenantId!,
      id,
      from ? new Date(from) : startOfMonth(),
      to ? new Date(to) : new Date(),
    );
  }

  /**
   * Mobile-admin driver detail page. Shortcut for the common week/month
   * windows — returns the shape the mobile UI binds directly (revenue,
   * bonus, avgCompletionMin, customerRating). For arbitrary date ranges
   * the dashboard uses `/drivers/:id/performance?from=&to=`.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month'] })
  @Get(':id/perf')
  perf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('period') period?: string,
  ) {
    const p: 'week' | 'month' = period === 'week' ? 'week' : 'month';
    return this.drivers.performanceByPeriod(user.tenantId!, id, p);
  }
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
