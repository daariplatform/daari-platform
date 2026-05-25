import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseCategory, RefillOrderStatus } from '@prisma/client';

interface RecordExpenseInput {
  category: ExpenseCategory;
  amountIqd: number;
  description: string;
  receiptUrl?: string;
  occurredAt?: Date;
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
}
