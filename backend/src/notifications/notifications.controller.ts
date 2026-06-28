import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

class RegisterPushTokenDto {
  @IsString() token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}

/**
 * Inbox query — extends PaginationDto with an optional `unreadOnly` filter.
 * Needed as its own DTO because the global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, so passing `unreadOnly` as a separate
 * @Query() would 400 against the bare PaginationDto.
 */
class InboxQueryDto extends PaginationDto {
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
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
   * is refreshed (FCM can rotate tokens on app reinstall / restore).
   */
  @Post('push-token')
  registerPushToken(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushTokenDto) {
    return this.push.registerToken(user.id, dto.token, dto.platform);
  }

  /**
   * Mobile-admin "Inbox" tab. Paginated NotificationLog scoped to tenant.
   * Returns `{ items, total, page, pageSize, totalPages, unreadCount }`
   * so the UI can render a badge on the bell icon in one round-trip.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @Get('inbox')
  inbox(
    @CurrentUser() user: AuthUser,
    @Query() q: InboxQueryDto,
  ) {
    return this.notifications.inbox(
      user.tenantId!,
      q.page,
      q.pageSize,
      q.unreadOnly === 'true' || q.unreadOnly === '1',
    );
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post(':id/mark-read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.tenantId!, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('mark-all-read')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.tenantId!);
  }

  // ─── Customer-scoped endpoints ─────────────────────────────────────
  //
  // The mobile-customer app needs its own notification feed (the inbox
  // on the home-screen bell). Previously the app pointed at /me, /:id/
  // read, /read-all — all 404. These three routes plug that gap. The
  // service-layer reads NotificationLog filtered by `recipient` matching
  // the user's phone so we don't leak other customers' messages.

  @Roles(UserRole.CUSTOMER)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @Get('me')
  myInbox(
    @CurrentUser() user: AuthUser,
    @Query() q: InboxQueryDto,
  ) {
    return this.notifications.inboxForCustomer(
      user.id,
      q.page,
      q.pageSize,
      q.unreadOnly === 'true' || q.unreadOnly === '1',
    );
  }

  @Roles(UserRole.CUSTOMER)
  @Post('me/:id/mark-read')
  myMarkRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markReadForCustomer(user.id, id);
  }

  @Roles(UserRole.CUSTOMER)
  @Post('me/mark-all-read')
  myMarkAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllReadForCustomer(user.id);
  }
}
