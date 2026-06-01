import { Module } from '@nestjs/common';
import { CashHandoverService } from './cash-handover.service';
import {
  DriverCashController,
  PlantCashController,
} from './cash-handover.controller';
import { DriversModule } from '../drivers/drivers.module';

// DriversModule exports DriversService, which the driver-side controller uses
// to resolve the calling driver's profile from the JWT (getMyDriverProfile).
@Module({
  imports: [DriversModule],
  controllers: [DriverCashController, PlantCashController],
  providers: [CashHandoverService],
  exports: [CashHandoverService],
})
export class CashHandoverModule {}
