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
import { VendorsModule } from './vendors/vendors.module';
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
     * Throttling tiers:
     *  - 'short'    1s   /  3 req  — burst protection on every endpoint
     *  - 'default' 60s  / 120 req  — normal app traffic ceiling
     *  - 'auth'    15min /  5 req  — tight cap on /auth/login + /auth/login/otp
     *                                so password-guessing is impractical
     */
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 3 },
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 15 * 60_000, limit: 5 },
    ]),
    PrismaModule,
    AuthModule,
    TenantsModule,
    TanksModule,
    CustomersModule,
    DriversModule,
    OrdersModule,
    AccountingModule,
    NotificationsModule,
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
