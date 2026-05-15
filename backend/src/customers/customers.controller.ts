import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { CustomerStatus, LocationSource, UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateCustomerDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsOptional() @Matches(/^07\d{9}$/)
  whatsapp?: string;

  @IsString()
  district!: string;

  @IsString()
  addressLine!: string;

  @IsOptional() @IsLongitude()
  locationLng?: number;

  @IsOptional() @IsLatitude()
  locationLat?: number;

  /** If omitted the backend generates a random 6-char password. */
  @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

class ResetPasswordDto {
  /** Plant admin can force-set a new password, or omit to auto-generate. */
  @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

class CaptureLocationDto {
  @IsLongitude() lng!: number;
  @IsLatitude() lat!: number;
  @IsEnum(LocationSource) source!: LocationSource;
}

class MoveDto {
  @IsLongitude() newLng!: number;
  @IsLatitude() newLat!: number;
}

@ApiBearerAuth()
@ApiTags('customers')
@UseGuards(RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user.tenantId!, dto);
  }

  @RequireCapability('plant_admin', 'driver')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: CustomerStatus,
    @Query('district') district?: string,
    @Query('search') search?: string,
  ) {
    return this.customers.list(user.tenantId!, { status, district, search });
  }

  @RequireCapability('plant_admin', 'driver')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.findOne(user.tenantId!, id);
  }

  /** Plant admin or driver recalibrates an existing customer's home GPS. */
  @RequireCapability('plant_admin', 'driver')
  @Post(':id/location')
  captureLocation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CaptureLocationDto,
  ) {
    return this.customers.captureLocation(user.tenantId!, id, dto.lng, dto.lat, dto.source);
  }

  /** Customer or plant flags a move to a new home. */
  @RequireCapability('plant_admin', 'customer')
  @Post(':id/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    return this.customers.startMove(user.tenantId!, id, dto.newLng, dto.newLat);
  }

  /**
   * Plant admin resets a customer's login password. The plain new value is
   * returned ONCE so the admin can hand it back. Useful when a customer
   * forgets — there is no SMS-based reset flow yet.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.customers.resetPassword(user.tenantId!, id, dto.password);
  }
}
