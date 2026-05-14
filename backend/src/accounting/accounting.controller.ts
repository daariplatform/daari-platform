import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ExpenseCategory, UserRole } from '@prisma/client';
import { AccountingService } from './accounting.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateExpenseDto {
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @IsInt() @Min(1) amountIqd!: number;
  @IsString() @MinLength(2) description!: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @IsDateString() occurredAt?: string;
}

class ComputeSalaryDto {
  @IsString() driverId!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsOptional() @IsInt() @Min(0) bonusIqd?: number;
  @IsOptional() @IsInt() @Min(0) deductionIqd?: number;
}

@ApiBearerAuth()
@ApiTags('accounting')
@UseGuards(RolesGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private accounting: AccountingService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('expenses')
  recordExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.accounting.recordExpense(user.tenantId!, user.id, {
      ...dto,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('expenses')
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: ExpenseCategory,
  ) {
    return this.accounting.listExpenses(
      user.tenantId!,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      category,
    );
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('salaries/compute')
  computeSalary(@CurrentUser() user: AuthUser, @Body() dto: ComputeSalaryDto) {
    return this.accounting.computeSalary(
      user.tenantId!,
      dto.driverId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.bonusIqd ?? 0,
      dto.deductionIqd ?? 0,
    );
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('salaries/:id/pay')
  paySalary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.paySalary(user.tenantId!, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('pnl')
  pnl(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.accounting.profitAndLoss(
      user.tenantId!,
      from ? new Date(from) : startOfMonth(),
      to ? new Date(to) : new Date(),
    );
  }
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
