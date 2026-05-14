import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod, UserRole, VehicleType } from '@prisma/client';
import { VendorsService } from './vendors.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class RegisterVendorDto {
  @IsEnum(VehicleType) vehicleType!: VehicleType;
  @IsOptional() @IsString() vehiclePlate?: string;
  @IsOptional() @IsInt() @Min(5) @Max(100) maxCapacityLiters?: number;
}

class AvailabilityDto {
  @IsBoolean() isAvailable!: boolean;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsLatitude() lat?: number;
}

class CreateDeliveryDto {
  @IsString() customerId!: string;
  @IsInt() @Min(5) @Max(25) liters!: number;
  @IsLongitude() dropLng!: number;
  @IsLatitude() dropLat!: number;
  @IsString() dropAddress!: string;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}

@ApiBearerAuth()
@ApiTags('vendors')
@UseGuards(RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private vendors: VendorsService) {}

  /**
   * Self-registration as a vendor. Open to any authenticated user —
   * a plant driver who wants to also work independently can call this
   * with their existing driver login.
   */
  @Post('me/register')
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterVendorDto) {
    return this.vendors.register({ userId: user.id, ...dto });
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.vendors.approve(id);
  }

  @RequireCapability('vendor')
  @Post('me/availability')
  setAvailability(@CurrentUser() user: AuthUser, @Body() dto: AvailabilityDto) {
    return this.vendors.setAvailability(user.id, dto.isAvailable, dto.lng, dto.lat);
  }

  @RequireCapability('customer')
  @Post('deliveries')
  createDelivery(@Body() dto: CreateDeliveryDto) {
    return this.vendors.createDeliveryOrder(dto);
  }

  @RequireCapability('vendor', 'platform_admin')
  @Get('deliveries/:id/candidates')
  candidates(@Param('id') id: string) {
    return this.vendors.findCandidatesForOrder(id);
  }

  @RequireCapability('vendor')
  @Post('deliveries/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vendors.acceptOrder(user.id, id);
  }

  @RequireCapability('vendor')
  @Post('deliveries/:id/delivered')
  delivered(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vendors.markDelivered(user.id, id);
  }

  @RequireCapability('vendor')
  @Get('me/wallet')
  wallet(@CurrentUser() user: AuthUser) {
    return this.vendors.wallet(user.id);
  }
}
