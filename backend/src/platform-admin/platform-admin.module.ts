import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlantModule } from '../plant/plant.module';

@Module({
  // WalletService lives in PlantModule (exported). PlatformAdminService
  // (cross-tenant stats) is local and uses the global PrismaService.
  imports: [PlantModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
