import { Module, forwardRef } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { BulkImportService } from './bulk-import.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

// CustomersModule ←→ NotificationsModule are mutually dependent:
//   - CustomersService injects PushService (lead → admin push).
//   - NotificationsModule's schedulers inject CustomersService.
// forwardRef breaks the circular import at module-load time. Without
// this, Nest sees `undefined` at the head of one side's imports[] and
// boots fail with "module at index [0] is undefined".
@Module({
  imports: [AuthModule, forwardRef(() => NotificationsModule)],
  controllers: [CustomersController],
  providers: [CustomersService, BulkImportService],
  exports: [CustomersService],
})
export class CustomersModule {}
