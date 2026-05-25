import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TankCapacity, TankStatus, UserRole } from '@prisma/client';
import { TanksService } from './tanks.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

class CreateTankDto {
  @IsString() @MinLength(2)
  serialNumber!: string;

  @IsEnum(TankCapacity)
  capacity!: TankCapacity;

  /** Optional. If omitted, backend generates a long unique code.
   *  Plants usually prefer friendly codes (T-1001) for printed stickers. */
  @IsOptional() @IsString() @MinLength(2)
  qrCode?: string;
}

class AssignTankDto {
  @IsString()
  customerId!: string;
}

@ApiBearerAuth()
@ApiTags('tanks')
@UseGuards(RolesGuard)
@Controller('tanks')
export class TanksController {
  constructor(private tanks: TanksService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTankDto) {
    return this.tanks.create(user.tenantId!, dto);
  }

  @RequireCapability('plant_admin', 'driver')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: TankStatus,
  ) {
    return this.tanks.list(
      user.tenantId!,
      status,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('inventory')
  inventory(@CurrentUser() user: AuthUser) {
    return this.tanks.inventory(user.tenantId!);
  }

  @RequireCapability('driver', 'plant_admin')
  @Get('qr/:code')
  byQr(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.tanks.findByQr(user.tenantId!, code);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignTankDto) {
    return this.tanks.assignToCustomer(user.tenantId!, id, dto.customerId);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/reclaim')
  reclaim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tanks.reclaim(user.tenantId!, id);
  }
}
