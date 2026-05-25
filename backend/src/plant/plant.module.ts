import { Module } from '@nestjs/common';
import { PlantController } from './plant.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PlantController],
})
export class PlantModule {}
