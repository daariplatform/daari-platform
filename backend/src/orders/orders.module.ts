import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // OrdersController injects DriversService (for driver-assigned order
  // lookups and GPS verification). DriversModule already exports
  // DriversService, so importing the module here satisfies the DI graph.
  // NotificationsModule exports PushService for order-event push delivery.
  imports: [DriversModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
