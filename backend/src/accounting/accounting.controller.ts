import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ExpenseCategory, UserRole } from '@prisma/client';
import { AccountingService, type AccountingPeriod, type RecurringCadence, type TxKind } from './accounting.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

class CreateExpenseDto {
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @IsInt() @Min(1) amountIqd!: number;
  @IsString() @MinLength(2) description!: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @IsDateString() occurredAt?: string;
}

class QuickExpenseDto {
  @IsInt() @Min(1) amountIqd!: number;
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  /** Mobile-admin sends a short "note" rather than "description". */
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() description?: string;
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

class CreateCategoryDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsHexColor() color?: string;
}

class CreateRecurringDto {
  @IsInt() @Min(1) amountIqd!: number;
  @IsString() @MinLength(2) description!: string;
  @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) cadence!: RecurringCadence;
  @IsDateString() nextDueAt!: string;
  @IsOptional() @IsString() categoryId?: string;
}

class InvoiceItemDto {
  @IsString() @MinLength(1) description!: string;
  @IsOptional() @IsInt() @Min(0) liters?: number;
  @IsInt() @Min(0) unitPrice!: number;
  @IsInt() @Min(0) subtotal!: number;
}

class CreateInvoiceDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsInt() @Min(0) taxIqd?: number;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

class MarkInvoicePaidDto {
  @IsOptional() @IsInt() @Min(0) amountIqd?: number;
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

  /**
   * Mobile-admin "Accounting" summary tile. Returns revenue + expenses +
   * net profit + growth% vs. previous comparable period.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('period') period?: string) {
    const p: AccountingPeriod = ['today', 'week', 'month', 'year'].includes(period ?? '')
      ? (period as AccountingPeriod)
      : 'month';
    return this.accounting.summary(user.tenantId!, p);
  }

  /**
   * Unified transactions feed (sales + expenses + salaries). Paginated.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'sale', 'expense', 'salary'] })
  @Get('transactions')
  transactions(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('kind') kind?: string,
  ) {
    const k: TxKind = ['all', 'sale', 'expense', 'salary'].includes(kind ?? '')
      ? (kind as TxKind)
      : 'all';
    return this.accounting.transactions(
      user.tenantId!,
      pagination.page,
      pagination.pageSize,
      k,
    );
  }

  /**
   * Mobile-shortcut: record an expense with a single tap. Same effect as
   * POST /accounting/expenses but accepts the friendlier `{ amountIqd,
   * category, note }` shape the mobile UI uses.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('expense')
  recordQuickExpense(@CurrentUser() user: AuthUser, @Body() dto: QuickExpenseDto) {
    return this.accounting.recordExpense(user.tenantId!, user.id, {
      category: dto.category,
      amountIqd: dto.amountIqd,
      description: dto.description ?? dto.note ?? dto.category,
      receiptUrl: dto.receiptUrl,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.accounting.createCategory(user.tenantId!, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('categories')
  listCategories(@CurrentUser() user: AuthUser) {
    return this.accounting.listCategories(user.tenantId!);
  }

  // ── Recurring expenses ─────────────────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('recurring')
  createRecurring(@CurrentUser() user: AuthUser, @Body() dto: CreateRecurringDto) {
    return this.accounting.createRecurringExpense(user.tenantId!, {
      amountIqd: dto.amountIqd,
      description: dto.description,
      cadence: dto.cadence,
      nextDueAt: new Date(dto.nextDueAt),
      categoryId: dto.categoryId,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @Get('recurring')
  listRecurring(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.accounting.listRecurringExpenses(
      user.tenantId!,
      includeInactive === 'true',
    );
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.accounting.createInvoice(user.tenantId!, {
      customerId: dto.customerId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      taxIqd: dto.taxIqd,
      notes: dto.notes,
      items: dto.items,
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] })
  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.accounting.listInvoices(user.tenantId!, status);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.getInvoice(user.tenantId!, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Post('invoices/:id/mark-paid')
  markInvoicePaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkInvoicePaidDto,
  ) {
    return this.accounting.markInvoicePaid(user.tenantId!, id, dto.amountIqd);
  }

  // ── Cash flow ──────────────────────────────────────────────────────────────

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get('cash-flow')
  cashFlow(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    return this.accounting.cashFlow(
      user.tenantId!,
      from ? new Date(from) : defaultFrom,
      to ? new Date(to) : now,
    );
  }
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
