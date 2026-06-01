import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TanksModule } from './tanks/tanks.module';
import { CustomersModule } from './customers/customers.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { RatingsModule } from './ratings/ratings.module';
import { CustomerAddressModule } from './customer-address/customer-address.module';
import { ScheduledOrdersModule } from './scheduled-orders/scheduled-orders.module';
import { CashHandoverModule } from './cash-handover/cash-handover.module';
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
import { AiModule } from './ai/ai.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { CapabilitiesGuard } from './common/guards/capabilities.guard';

const vendorsEnabled = (process.env.FEATURE_VENDORS ?? 'false') === 'true';
const optionalModules: DynamicModule['imports'] = vendorsEnabled ? [VendorsModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    /**
     * Structured JSON logging via pino. In production the output is a
     * single JSON line per log entry, which journalctl + log-shippers can
     * parse without regex gymnastics:
     *   journalctl -u daari-water-api -o json --since "1 hour ago"
     *
     * In dev (NODE_ENV=development) we pretty-print to stdout for humans.
     * Authorization headers + cookies are redacted at the logger level so
     * tokens never reach disk.
     */
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        // Pretty-print only when explicitly in dev. In prod we want raw
        // JSON so journald and any future log-shipper get structured data.
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // Suppress the noisy req/res payloads for the health checks —
        // UptimeRobot hits these every 5 minutes per probe and they would
        // otherwise dominate the log volume.
        autoLogging: {
          ignore: (req: any) =>
            req.url === '/api/v1/health' || req.url === '/api/v1/ready',
        },
      },
    }),
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
    RatingsModule,
    CustomerAddressModule,
    ScheduledOrdersModule,
    CashHandoverModule,
    AccountingModule,
    NotificationsModule,
    PlantModule,
    PlatformAdminModule,
    AiModule,
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
