import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CustomerAddressService } from './customer-address.service';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateAddressDto {
  @IsString() @MinLength(1) @MaxLength(60)
  label!: string;

  @IsString() @MinLength(1) @MaxLength(300)
  addressLine!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  district!: string;

  @IsOptional() @IsLongitude()
  lng?: number;

  @IsOptional() @IsLatitude()
  lat?: number;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

class UpdateAddressDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  label?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  addressLine?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  district?: string;

  @IsOptional() @IsLongitude()
  lng?: number;

  @IsOptional() @IsLatitude()
  lat?: number;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

/**
 * Customer's saved delivery addresses (home / work / …). All routes are
 * scoped to the calling customer (resolved by customer.userId === user.id) —
 * the addressId is always re-checked against the resolved customer, so no
 * cross-account access is possible.
 *
 * Mounted under /customers so it reads as /customers/me/addresses on the
 * client. The `me/...` paths are fully specific (no bare `:id` here) so
 * there is no Express ordering hazard within this controller.
 */
@ApiBearerAuth()
@ApiTags('customer-addresses')
@UseGuards(RolesGuard)
@Controller('customers')
export class CustomerAddressController {
  constructor(private addresses: CustomerAddressService) {}

  @RequireCapability('customer')
  @Get('me/addresses')
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.id);
  }

  @RequireCapability('customer')
  @Post('me/addresses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @RequireCapability('customer')
  @Patch('me/addresses/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(user.id, id, dto);
  }

  @RequireCapability('customer')
  @Delete('me/addresses/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.remove(user.id, id);
  }

  @RequireCapability('customer')
  @Post('me/addresses/:id/make-default')
  makeDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.makeDefault(user.id, id);
  }
}
