import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { EmailModule } from '../email/email.module';

@Module({
  // OrdersController injects DriversService (for driver-assigned order
  // lookups and GPS verification). DriversModule already exports
  // DriversService, so importing the module here satisfies the DI graph.
  // NotificationsModule exports PushService for order-event push delivery.
  // CustomersModule exposes CustomersService for cache invalidation on
  // order completion. EmailModule sends the receipt.
  imports: [DriversModule, NotificationsModule, CustomersModule, EmailModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
