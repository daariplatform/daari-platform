import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { EmailModule } from '../email/email.module';
import { PlantModule } from '../plant/plant.module';

@Module({
  // OrdersController injects DriversService (for driver-assigned order
  // lookups and GPS verification). DriversModule already exports
  // DriversService, so importing the module here satisfies the DI graph.
  // NotificationsModule exports PushService for order-event push delivery.
  // CustomersModule exposes CustomersService for cache invalidation on
  // order completion. EmailModule sends the receipt. PlantModule exports
  // PromoService — OrdersService calls it at completion to charge any
  // active promo campaign against the tenant's wallet.
  imports: [DriversModule, NotificationsModule, CustomersModule, EmailModule, PlantModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
