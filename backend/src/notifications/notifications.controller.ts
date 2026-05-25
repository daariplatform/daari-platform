import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class RegisterPushTokenDto {
  @IsString() token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}

/**
 * NotificationsController — Dashboard "Notifications" page.
 *
 * Lists recent `NotificationLog` rows for the current tenant so the plant
 * owner can audit WhatsApp/SMS deliveries (and see which messages failed).
 */
@ApiBearerAuth()
@ApiTags('notifications')
@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private push: PushService,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100;
    return this.notifications.recentForTenant(user.tenantId!, n);
  }

  /**
   * Any signed-in user (customer / driver / admin) registers their device
   * push token. Mobile calls this after first login + whenever the token
   * is refreshed (Expo can rotate tokens on app reinstall).
   */
  @Post('push-token')
  registerPushToken(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushTokenDto) {
    return this.push.registerToken(user.id, dto.token, dto.platform);
  }
}
