import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ReminderSchedulerService } from './reminder.scheduler';
import { SubscriptionReminderScheduler } from './subscription-reminder.scheduler';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  providers: [
    NotificationsService,
    ReminderSchedulerService,
    SubscriptionReminderScheduler,
    WhatsAppProvider,
    SmsProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
