import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { BulkImportService } from './bulk-import.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CustomersController],
  providers: [CustomersService, BulkImportService],
  exports: [CustomersService],
})
export class CustomersModule {}
