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
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ScheduleCadence } from '@prisma/client';
import { ScheduledOrdersService } from './scheduled-orders.service';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateScheduleDto {
  @IsEnum(ScheduleCadence)
  cadence!: ScheduleCadence;

  @IsDateString()
  nextRunAt!: string;

  @IsOptional() @IsString()
  addressId?: string;
}

class UpdateScheduleDto {
  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsEnum(ScheduleCadence)
  cadence?: ScheduleCadence;

  @IsOptional() @IsDateString()
  nextRunAt?: string;
}

/**
 * Customer's recurring auto-refill schedules. A background cron
 * (ScheduledOrdersProcessor) materialises a real RefillOrder each time a
 * schedule is due. All routes scoped to the calling customer
 * (customer.userId === user.id). Mounted under /customers so it reads as
 * /customers/me/schedules on the client.
 */
@ApiBearerAuth()
@ApiTags('scheduled-orders')
@UseGuards(RolesGuard)
@Controller('customers')
export class ScheduledOrdersController {
  constructor(private schedules: ScheduledOrdersService) {}

  @RequireCapability('customer')
  @Get('me/schedules')
  list(@CurrentUser() user: AuthUser) {
    return this.schedules.list(user.id);
  }

  @RequireCapability('customer')
  @Post('me/schedules')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.schedules.create(user.id, {
      cadence: dto.cadence,
      nextRunAt: new Date(dto.nextRunAt),
      addressId: dto.addressId,
    });
  }

  @RequireCapability('customer')
  @Patch('me/schedules/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedules.update(user.id, id, {
      active: dto.active,
      cadence: dto.cadence,
      nextRunAt: dto.nextRunAt ? new Date(dto.nextRunAt) : undefined,
    });
  }

  @RequireCapability('customer')
  @Delete('me/schedules/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedules.remove(user.id, id);
  }
}
