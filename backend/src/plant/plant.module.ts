import { Module } from '@nestjs/common';
import { PlantController } from './plant.controller';
import { PromoCampaignController } from './promo.controller';
import { CustomerPromoController } from './customer-promo.controller';
import { PlantReportsController } from './reports.controller';
import { TeamController } from './team.controller';
import { OnboardingController } from './onboarding.controller';
import { PromoService } from './promo.service';
import { WalletService } from './wallet.service';
import { ReportsCleanupScheduler } from './reports-cleanup.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    PlantController,
    PromoCampaignController,
    CustomerPromoController,
    PlantReportsController,
    TeamController,
    OnboardingController,
  ],
  providers: [PromoService, WalletService, ReportsCleanupScheduler],
  // Exported so OrdersService (campaign deduction at completion) and the
  // platform-admin module (wallet topups) can inject them.
  exports: [PromoService, WalletService],
})
export class PlantModule {}
