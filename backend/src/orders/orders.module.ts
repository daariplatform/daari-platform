import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  // OrdersController injects DriversService (for driver-assigned order
  // lookups and GPS verification). DriversModule already exports
  // DriversService, so importing the module here satisfies the DI graph.
  imports: [DriversModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
