import { Module } from '@nestjs/common';
import { PlantController } from './plant.controller';
import { PromoCampaignController } from './promo.controller';
import { CustomerPromoController } from './customer-promo.controller';
import { PromoService } from './promo.service';
import { WalletService } from './wallet.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PlantController, PromoCampaignController, CustomerPromoController],
  providers: [PromoService, WalletService],
  // Exported so OrdersService (campaign deduction at completion) and the
  // platform-admin module (wallet topups) can inject them.
  exports: [PromoService, WalletService],
})
export class PlantModule {}
