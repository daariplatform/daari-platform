import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseCategory, Prisma, RefillOrderStatus } from '@prisma/client';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

interface RecordExpenseInput {
  category: ExpenseCategory;
  amountIqd: number;
  description: string;
  receiptUrl?: string;
  occurredAt?: Date;
  categoryItemId?: string;
}

export type AccountingPeriod = 'today' | 'week' | 'month' | 'year';
export type TxKind = 'all' | 'sale' | 'expense' | 'salary';

export type RecurringCadence = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface CreateInvoiceInput {
  customerId?: string;
  dueAt?: Date;
  taxIqd?: number;
  notes?: string;
  items: Array<{
    description: string;
    liters?: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

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
        categoryItemId: input.categoryItemId,
      },
    });
  }

  // ── Categories (user-defined) ────────────────────────────────────────────

  /**
   * Create a named expense category for this tenant. `name` is unique
   * per-tenant; duplicates throw 400.
   */
  async createCategory(
    tenantId: string,
    input: { name: string; icon?: string; color?: string },
  ) {
    try {
      return await this.prisma.expenseCategoryItem.create({
        data: {
          tenantId,
          name: input.name,
          icon: input.icon,
          color: input.color,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Category name already exists for this tenant');
      }
      throw e;
    }
  }

  /**
   * List categories with the count of attached expenses. Cheap n+1 here
   * is fine — a plant rarely has more than ~20 named categories.
   */
  async listCategories(tenantId: string) {
    const cats = await this.prisma.expenseCategoryItem.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    const counts = await this.prisma.expense.groupBy({
      by: ['categoryItemId'],
      where: { tenantId, categoryItemId: { not: null } },
      _count: { _all: true },
    });
    const countByCat = new Map(counts.map((c) => [c.categoryItemId!, c._count._all]));
    return cats.map((c) => ({
      ...c,
      expenseCount: countByCat.get(c.id) ?? 0,
    }));
  }

  // ── Recurring expenses ───────────────────────────────────────────────────

  async createRecurringExpense(
    tenantId: string,
    input: {
      amountIqd: number;
      description: string;
      cadence: RecurringCadence;
      nextDueAt: Date;
      categoryId?: string;
    },
  ) {
    if (!['WEEKLY', 'MONTHLY', 'YEARLY'].includes(input.cadence)) {
      throw new BadRequestException('cadence must be WEEKLY, MONTHLY, or YEARLY');
    }
    return this.prisma.recurringExpense.create({
      data: {
        tenantId,
        amountIqd: input.amountIqd,
        description: input.description,
        cadence: input.cadence,
        nextDueAt: input.nextDueAt,
        categoryId: input.categoryId,
      },
    });
  }

  listRecurringExpenses(tenantId: string, includeInactive = false) {
    return this.prisma.recurringExpense.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { nextDueAt: 'asc' },
      include: { category: true },
    });
  }

  /**
   * Materialise every recurring expense whose nextDueAt has elapsed.
   * Returns the count of expenses created. Idempotent up to the cadence
   * tick — a missed run just creates one row, not a backlog. Caller is
   * the daily cron in RecurringExpenseScheduler.
   */
  async materialiseRecurring(now: Date = new Date()) {
    const due = await this.prisma.recurringExpense.findMany({
      where: { isActive: true, nextDueAt: { lte: now } },
    });
    let created = 0;
    for (const r of due) {
      // Wrap creation + advance in a transaction so we never double-charge
      // if the second update throws.
      await this.prisma.$transaction(async (tx) => {
        await tx.expense.create({
          data: {
            tenantId: r.tenantId,
            category: ExpenseCategory.OTHER, // legacy enum fallback
            categoryItemId: r.categoryId,
            amountIqd: r.amountIqd,
            description: `[تكراري] ${r.description}`,
            occurredAt: now,
          },
        });
        const nextDueAt = advanceCadence(r.nextDueAt, r.cadence as RecurringCadence, now);
        await tx.recurringExpense.update({
          where: { id: r.id },
          data: { nextDueAt },
        });
      });
      created++;
    }
    return { created };
  }

  // ── Invoices ─────────────────────────────────────────────────────────────

  /**
   * Create a customer invoice. invoiceNumber is generated server-side as
   * INV-YYYY-NNNN where NNNN is the per-tenant per-year sequence. We
   * tolerate races by retrying on unique-violation.
   */
  async createInvoice(tenantId: string, input: CreateInvoiceInput) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Invoice must have at least one line item');
    }
    const subtotalIqd = input.items.reduce((s, it) => s + (it.subtotal ?? 0), 0);
    const taxIqd = input.taxIqd ?? 0;
    const totalIqd = subtotalIqd + taxIqd;

    // Allocate the next invoice number. Race-safe by counting only rows
    // within this calendar year for this tenant.
    for (let attempt = 0; attempt < 3; attempt++) {
      const year = new Date().getFullYear();
      const yearPrefix = `INV-${year}-`;
      const last = await this.prisma.invoice.findFirst({
        where: { tenantId, invoiceNumber: { startsWith: yearPrefix } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      const nextSeq = last
        ? parseInt(last.invoiceNumber.slice(yearPrefix.length), 10) + 1
        : 1;
      const invoiceNumber = `${yearPrefix}${String(nextSeq).padStart(4, '0')}`;
      try {
        return await this.prisma.invoice.create({
          data: {
            tenantId,
            customerId: input.customerId,
            invoiceNumber,
            dueAt: input.dueAt,
            notes: input.notes,
            subtotalIqd,
            taxIqd,
            totalIqd,
            items: input.items as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException('Failed to allocate a unique invoice number');
  }

  listInvoices(tenantId: string, status?: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { issuedAt: 'desc' },
      take: 500,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async getInvoice(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { customer: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async markInvoicePaid(tenantId: string, id: string, amountIqd?: number) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    // Don't re-settle an already-paid or voided invoice.
    if (inv.status === 'PAID' || inv.status === 'VOID') {
      throw new BadRequestException('لا يمكن تحصيل فاتورة مدفوعة أو ملغاة');
    }
    const paid = amountIqd ?? inv.totalIqd;
    // A payment below the total must not flip the invoice to PAID (that would
    // report an unpaid balance as settled). Partial payments aren't modelled.
    if (paid < inv.totalIqd) {
      throw new BadRequestException('المبلغ المدفوع أقل من إجمالي الفاتورة');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAmountIqd: paid,
      },
    });
  }

  /**
   * Daily inflow + outflow series across a window. Inflow = paid amounts
   * on completed refill orders. Outflow = expenses + paid salaries. Used
   * by the mobile-admin "Cash Flow" chart.
   */
  async cashFlow(tenantId: string, from: Date, to: Date) {
    if (to <= from) throw new BadRequestException('to must be > from');
    const dayMs = 86_400_000;
    const numDays = Math.min(Math.ceil((to.getTime() - from.getTime()) / dayMs), 366);

    const days: { date: string; start: Date; end: Date; inflowIqd: number; outflowIqd: number }[] = [];
    for (let i = 0; i < numDays; i++) {
      const start = new Date(from);
      start.setDate(start.getDate() + i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      days.push({ date: start.toISOString().slice(0, 10), start, end, inflowIqd: 0, outflowIqd: 0 });
    }
    const windowStart = days[0]?.start ?? from;
    const windowEnd = days[days.length - 1]?.end ?? to;

    const [orders, expenses, salaries] = await Promise.all([
      this.prisma.refillOrder.findMany({
        where: {
          tenantId,
          status: RefillOrderStatus.COMPLETED,
          completedAt: { gte: windowStart, lt: windowEnd },
        },
        select: { completedAt: true, paidAmountIqd: true },
      }),
      this.prisma.expense.findMany({
        where: { tenantId, occurredAt: { gte: windowStart, lt: windowEnd } },
        select: { occurredAt: true, amountIqd: true },
      }),
      this.prisma.salaryPayment.findMany({
        where: { tenantId, paidAt: { gte: windowStart, lt: windowEnd } },
        select: { paidAt: true, netIqd: true },
      }),
    ]);

    const dayIdx = (t: Date) =>
      Math.floor((t.getTime() - windowStart.getTime()) / dayMs);

    for (const o of orders) {
      if (!o.completedAt) continue;
      const i = dayIdx(o.completedAt);
      if (i >= 0 && i < days.length) days[i].inflowIqd += o.paidAmountIqd ?? 0;
    }
    for (const e of expenses) {
      const i = dayIdx(e.occurredAt);
      if (i >= 0 && i < days.length) days[i].outflowIqd += e.amountIqd;
    }
    for (const s of salaries) {
      if (!s.paidAt) continue;
      const i = dayIdx(s.paidAt);
      if (i >= 0 && i < days.length) days[i].outflowIqd += s.netIqd;
    }

    const totals = days.reduce(
      (acc, d) => {
        acc.inflowIqd += d.inflowIqd;
        acc.outflowIqd += d.outflowIqd;
        return acc;
      },
      { inflowIqd: 0, outflowIqd: 0 },
    );

    return {
      from: windowStart,
      to: windowEnd,
      series: days.map((d) => ({
        date: d.date,
        inflowIqd: d.inflowIqd,
        outflowIqd: d.outflowIqd,
        netIqd: d.inflowIqd - d.outflowIqd,
      })),
      totals: { ...totals, netIqd: totals.inflowIqd - totals.outflowIqd },
    };
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

  /**
   * Mark a salary payment as paid. Tenant-scoped — the original code
   * accepted `tenantId` then ignored it, allowing IDOR: an OWNER of plant
   * A could mark plant B's salary as paid by guessing the salaryId.
   * Audit finding C3. The pre-fetch + tenant equality check is the fix.
   */
  async paySalary(tenantId: string, salaryId: string) {
    const existing = await this.prisma.salaryPayment.findFirst({
      where: { id: salaryId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Salary payment not found');
    }
    // Idempotent + atomic: only stamp paidAt when it's still null. A repeat
    // call (double-tap) must not overwrite the original timestamp, which would
    // retroactively move the outflow into a different accounting period.
    await this.prisma.salaryPayment.updateMany({
      where: { id: salaryId, paidAt: null },
      data: { paidAt: new Date() },
    });
    return this.prisma.salaryPayment.findUnique({ where: { id: salaryId } });
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

/**
 * Advance a recurring expense's nextDueAt forward by `cadence`, keeping
 * the result strictly in the future of `now`. If we missed several ticks
 * (server outage, etc.) we don't backfill — just jump to the next
 * future tick so the plant doesn't get a backlog of duplicate expenses.
 */
function advanceCadence(current: Date, cadence: RecurringCadence, now: Date): Date {
  const next = new Date(current);
  while (next <= now) {
    if (cadence === 'WEEKLY') next.setDate(next.getDate() + 7);
    else if (cadence === 'MONTHLY') next.setMonth(next.getMonth() + 1);
    else if (cadence === 'YEARLY') next.setFullYear(next.getFullYear() + 1);
    else break;
  }
  return next;
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
