import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseCategory, RefillOrderStatus } from '@prisma/client';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

interface RecordExpenseInput {
  category: ExpenseCategory;
  amountIqd: number;
  description: string;
  receiptUrl?: string;
  occurredAt?: Date;
}

export type AccountingPeriod = 'today' | 'week' | 'month' | 'year';
export type TxKind = 'all' | 'sale' | 'expense' | 'salary';

export interface Transaction {
  id: string;
  kind: 'sale' | 'expense' | 'salary';
  occurredAt: Date;
  amountIqd: number; // positive = income, negative = outflow
  description: string;
  reference?: string | null;
}

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  recordExpense(tenantId: string, userId: string, input: RecordExpenseInput) {
    return this.prisma.expense.create({
      data: {
        tenantId,
        createdById: userId,
        category: input.category,
        amountIqd: input.amountIqd,
        description: input.description,
        receiptUrl: input.receiptUrl,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  listExpenses(tenantId: string, from?: Date, to?: Date, category?: ExpenseCategory) {
    return this.prisma.expense.findMany({
      where: {
        tenantId,
        ...(category && { category }),
        ...(from || to
          ? { occurredAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Compute a salary for a driver across [periodStart, periodEnd].
   * Net = base + (commission * completed refills) + bonus - deductions.
   * Stores it as draft; mark paid via /pay.
   */
  async computeSalary(
    tenantId: string,
    driverId: string,
    periodStart: Date,
    periodEnd: Date,
    bonusIqd = 0,
    deductionIqd = 0,
  ) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const completedAgg = await this.prisma.refillOrder.aggregate({
      where: {
        tenantId,
        driverId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
      _sum: { bonusIqd: true },
    });
    const refills = completedAgg._count._all;
    const performanceBonusIqd = completedAgg._sum.bonusIqd ?? 0;

    // Sum every new-customer bonus the driver earned in this period — i.e.
    // every customer they registered in the field that the plant approved
    // during [periodStart, periodEnd]. The bonus rate was snapshotted onto
    // the Customer row at approval time, so changing the rate in settings
    // later doesn't retroactively rewrite already-paid salaries.
    const registrationAgg = await this.prisma.customer.aggregate({
      where: {
        tenantId,
        onboardedByDriverId: driverId,
        approvedAt: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
      _sum: { registrationBonusIqd: true },
    });
    const registrationBonusIqd = registrationAgg._sum.registrationBonusIqd ?? 0;

    const commissionIqd = refills * driver.commissionPerRefillIqd;
    const totalBonusIqd = bonusIqd + performanceBonusIqd + registrationBonusIqd;
    const netIqd =
      driver.baseSalaryIqd + commissionIqd + totalBonusIqd - deductionIqd;

    return this.prisma.salaryPayment.create({
      data: {
        tenantId,
        driverId,
        periodStart,
        periodEnd,
        baseIqd: driver.baseSalaryIqd,
        commissionIqd,
        bonusIqd: totalBonusIqd,
        deductionIqd,
        netIqd,
      },
    });
  }

  paySalary(tenantId: string, salaryId: string) {
    return this.prisma.salaryPayment.update({
      where: { id: salaryId },
      data: { paidAt: new Date() },
    });
  }

  /**
   * Profit & loss for a window.
   *  Revenue  = sum(paidAmountIqd) on COMPLETED refill orders
   *  Expenses = sum(amountIqd) on Expense rows + sum(netIqd) on paid salaries
   */
  async profitAndLoss(tenantId: string, from: Date, to: Date) {
    const [revenue, expenses, salaries] = await Promise.all([
      this.prisma.refillOrder.aggregate({
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: from, lte: to },
        },
        _sum: { paidAmountIqd: true },
        _count: { _all: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId, occurredAt: { gte: from, lte: to } },
        _sum: { amountIqd: true },
      }),
      this.prisma.salaryPayment.aggregate({
        where: { tenantId, paidAt: { gte: from, lte: to } },
        _sum: { netIqd: true },
      }),
    ]);

    const revenueIqd = revenue._sum.paidAmountIqd ?? 0;
    const expensesIqd = expenses._sum.amountIqd ?? 0;
    const salariesIqd = salaries._sum.netIqd ?? 0;
    const netIqd = revenueIqd - expensesIqd - salariesIqd;

    return {
      from,
      to,
      revenueIqd,
      expensesIqd,
      salariesIqd,
      netIqd,
      completedOrders: revenue._count._all,
    };
  }

  /**
   * Mobile-admin accounting "summary" tile. Returns the current period's
   * revenue / expenses / net profit + growth vs. the previous comparable
   * window so the UI can show a trend arrow.
   *
   *   growthPct = (currentNet - previousNet) / |previousNet| * 100
   *   When previousNet is 0 we return null (no baseline to compare to).
   */
  async summary(tenantId: string, period: AccountingPeriod) {
    const { from, to, prevFrom, prevTo } = computePeriodWindow(period);

    const [curRevenue, curExpenses, curSalaries, prevRevenue, prevExpenses, prevSalaries] =
      await Promise.all([
        this.prisma.refillOrder.aggregate({
          where: {
            tenantId,
            status: RefillOrderStatus.COMPLETED,
            completedAt: { gte: from, lte: to },
          },
          _sum: { paidAmountIqd: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, occurredAt: { gte: from, lte: to } },
          _sum: { amountIqd: true },
        }),
        this.prisma.salaryPayment.aggregate({
          where: { tenantId, paidAt: { gte: from, lte: to } },
          _sum: { netIqd: true },
        }),
        this.prisma.refillOrder.aggregate({
          where: {
            tenantId,
            status: RefillOrderStatus.COMPLETED,
            completedAt: { gte: prevFrom, lte: prevTo },
          },
          _sum: { paidAmountIqd: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, occurredAt: { gte: prevFrom, lte: prevTo } },
          _sum: { amountIqd: true },
        }),
        this.prisma.salaryPayment.aggregate({
          where: { tenantId, paidAt: { gte: prevFrom, lte: prevTo } },
          _sum: { netIqd: true },
        }),
      ]);

    const revenue = curRevenue._sum.paidAmountIqd ?? 0;
    const expenses = (curExpenses._sum.amountIqd ?? 0) + (curSalaries._sum.netIqd ?? 0);
    const netProfit = revenue - expenses;

    const prevRevenueIqd = prevRevenue._sum.paidAmountIqd ?? 0;
    const prevExpensesIqd =
      (prevExpenses._sum.amountIqd ?? 0) + (prevSalaries._sum.netIqd ?? 0);
    const prevNet = prevRevenueIqd - prevExpensesIqd;

    let growthPct: number | null = null;
    if (prevNet !== 0) {
      growthPct = Math.round(((netProfit - prevNet) / Math.abs(prevNet)) * 1000) / 10;
    }

    return {
      period,
      from,
      to,
      revenue,
      expenses,
      netProfit,
      growthPct,
    };
  }

  /**
   * Unified ledger of cash flow rows for the mobile-admin "Transactions"
   * tab. Merges three sources — completed sales, manual expenses, paid
   * salaries — into a single time-ordered list with a shared envelope so
   * the UI can render a single FlatList.
   *
   * The merge is done in memory (Postgres has no cheap UNION across these
   * tables without sacrificing pagination correctness). Pulls 5× the
   * pageSize from each source then sorts/slices — fine for plant-scale
   * volumes (< 10k tx/month). If a plant ever crosses that we'll move to
   * a materialised view.
   */
  async transactions(
    tenantId: string,
    page = 1,
    pageSize = 50,
    kind: TxKind = 'all',
  ): Promise<PaginatedResult<Transaction>> {
    const pull = Math.max(pageSize * 5, 200);
    const sales =
      kind === 'all' || kind === 'sale'
        ? await this.prisma.refillOrder.findMany({
            where: {
              tenantId,
              status: RefillOrderStatus.COMPLETED,
              completedAt: { not: null },
            },
            orderBy: { completedAt: 'desc' },
            take: pull,
            select: {
              id: true,
              completedAt: true,
              paidAmountIqd: true,
              kind: true,
              customer: { select: { fullName: true } },
            },
          })
        : [];
    const expenses =
      kind === 'all' || kind === 'expense'
        ? await this.prisma.expense.findMany({
            where: { tenantId },
            orderBy: { occurredAt: 'desc' },
            take: pull,
            select: {
              id: true,
              occurredAt: true,
              amountIqd: true,
              description: true,
              category: true,
            },
          })
        : [];
    const salaries =
      kind === 'all' || kind === 'salary'
        ? await this.prisma.salaryPayment.findMany({
            where: { tenantId, paidAt: { not: null } },
            orderBy: { paidAt: 'desc' },
            take: pull,
            select: {
              id: true,
              paidAt: true,
              netIqd: true,
              driver: { include: { user: { select: { fullName: true } } } },
            },
          })
        : [];

    const merged: Transaction[] = [
      ...sales.map<Transaction>((s) => ({
        id: s.id,
        kind: 'sale',
        occurredAt: s.completedAt!,
        amountIqd: s.paidAmountIqd ?? 0,
        description: s.customer?.fullName
          ? `${s.kind} — ${s.customer.fullName}`
          : s.kind,
        reference: s.id,
      })),
      ...expenses.map<Transaction>((e) => ({
        id: e.id,
        kind: 'expense',
        occurredAt: e.occurredAt,
        amountIqd: -e.amountIqd,
        description: `${e.category} — ${e.description}`,
        reference: e.id,
      })),
      ...salaries.map<Transaction>((s) => ({
        id: s.id,
        kind: 'salary',
        occurredAt: s.paidAt!,
        amountIqd: -s.netIqd,
        description: `راتب — ${s.driver.user.fullName}`,
        reference: s.id,
      })),
    ];

    merged.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const total = merged.length;
    const start = (page - 1) * pageSize;
    const items = merged.slice(start, start + pageSize);
    return paginated(items, total, { page, pageSize });
  }
}

function computePeriodWindow(period: AccountingPeriod) {
  const now = new Date();
  const to = now;
  let from: Date;
  let prevFrom: Date;
  let prevTo: Date;

  switch (period) {
    case 'today': {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      prevFrom = new Date(from);
      prevFrom.setDate(prevFrom.getDate() - 1);
      prevTo = new Date(from);
      prevTo.setMilliseconds(-1);
      break;
    }
    case 'week': {
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      prevFrom = new Date(from);
      prevFrom.setDate(prevFrom.getDate() - 7);
      prevTo = new Date(from);
      prevTo.setMilliseconds(-1);
      break;
    }
    case 'year': {
      from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      prevFrom = new Date(from);
      prevFrom.setFullYear(prevFrom.getFullYear() - 1);
      prevTo = new Date(from);
      prevTo.setMilliseconds(-1);
      break;
    }
    case 'month':
    default: {
      from = new Date(now);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      prevFrom = new Date(from);
      prevFrom.setMonth(prevFrom.getMonth() - 1);
      prevTo = new Date(from);
      prevTo.setMilliseconds(-1);
      break;
    }
  }
  return { from, to, prevFrom, prevTo };
}
