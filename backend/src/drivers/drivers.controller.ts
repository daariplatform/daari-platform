import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, Matches, Min, IsInt, MinLength } from 'class-validator';
import { DriverStatus, UserRole } from '@prisma/client';
import { DriversService } from './drivers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateDriverDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsOptional() @IsString()
  vehiclePlate?: string;

  @IsOptional() @IsInt() @Min(0)
  baseSalaryIqd?: number;

  @IsOptional() @IsInt() @Min(0)
  commissionPerRefillIqd?: number;
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

@ApiBearerAuth()
@ApiTags('drivers')
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private drivers: DriversService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDriverDto) {
    return this.drivers.create(user.tenantId!, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.drivers.list(user.tenantId!);
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
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
