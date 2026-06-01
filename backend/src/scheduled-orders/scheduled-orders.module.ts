import { Module } from '@nestjs/common';
import { ScheduledOrdersService } from './scheduled-orders.service';
import { ScheduledOrdersController } from './scheduled-orders.controller';
import { ScheduledOrdersProcessor } from './scheduled-orders.processor';
import { OrdersModule } from '../orders/orders.module';

// OrdersModule exports OrdersService, which the cron processor uses to
// materialise real RefillOrders from due schedules. The dependency is
// one-directional (OrdersModule does NOT import ScheduledOrdersModule) so
// there is no circular import.
@Module({
  imports: [OrdersModule],
  controllers: [ScheduledOrdersController],
  providers: [ScheduledOrdersService, ScheduledOrdersProcessor],
  exports: [ScheduledOrdersService],
})
export class ScheduledOrdersModule {}
