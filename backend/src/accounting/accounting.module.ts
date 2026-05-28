import { Module } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { RecurringExpenseScheduler } from './recurring-expense.scheduler';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, RecurringExpenseScheduler],
  exports: [AccountingService],
})
export class AccountingModule {}
