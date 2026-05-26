import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlantModule } from '../plant/plant.module';

@Module({
  // WalletService lives in PlantModule (it's exported); platform-admin
  // just consumes it. No new providers here.
  imports: [PlantModule],
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule {}
