import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ReminderSchedulerService } from './reminder.scheduler';
import { SubscriptionReminderScheduler } from './subscription-reminder.scheduler';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushService } from './push.service';
import { CustomersModule } from '../customers/customers.module';

@Module({
  // Paired with the forwardRef() on CustomersModule's side — see comment there.
  imports: [forwardRef(() => CustomersModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ReminderSchedulerService,
    SubscriptionReminderScheduler,
    WhatsAppProvider,
    SmsProvider,
    PushService,
  ],
  exports: [NotificationsService, PushService, WhatsAppProvider],
})
export class NotificationsModule {}
