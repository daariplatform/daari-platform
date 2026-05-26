import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TanksModule } from './tanks/tanks.module';
import { CustomersModule } from './customers/customers.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { AccountingModule } from './accounting/accounting.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlantModule } from './plant/plant.module';
import { VendorsModule } from './vendors/vendors.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { CapabilitiesGuard } from './common/guards/capabilities.guard';

const vendorsEnabled = (process.env.FEATURE_VENDORS ?? 'false') === 'true';
const optionalModules: DynamicModule['imports'] = vendorsEnabled ? [VendorsModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    /**
     * Throttling tiers (apply to EVERY route via global ThrottlerGuard):
     *  - 'short'    1s   / 10 req  — burst protection (was 3, too tight)
     *  - 'default' 60s  / 120 req  — normal app traffic ceiling
     *
     * Auth-specific cap (5 attempts / 15 min for /auth/login) is enforced
     * via the @Throttle({ default: { limit: 5, ttl: 15*60_000 } }) override
     * on the auth controller — DO NOT add it as a global named tier here.
     * Doing so would apply 5/15min to /customers/me, /orders/me, … which
     * blocks normal app usage instantly.
     */
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    CacheModule,
    QueueModule,
    EmailModule,
    AuthModule,
    TenantsModule,
    TanksModule,
    CustomersModule,
    DriversModule,
    OrdersModule,
    AccountingModule,
    NotificationsModule,
    PlantModule,
    PlatformAdminModule,
    UploadsModule,
    HealthModule,
    ...optionalModules,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: CapabilitiesGuard },
  ],
})
export class AppModule {}
