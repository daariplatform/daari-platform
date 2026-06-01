import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleCadence } from '@prisma/client';

interface CreateScheduleInput {
  cadence: ScheduleCadence;
  nextRunAt: Date;
  addressId?: string;
}

interface UpdateScheduleInput {
  active?: boolean;
  cadence?: ScheduleCadence;
  nextRunAt?: Date;
}

/**
 * Advance a due date by one cadence step. WEEKLY → +7d, BIWEEKLY → +14d,
 * MONTHLY → +1 calendar month. Exported helper so the processor and any
 * future "skip next run" logic share the same arithmetic.
 */
export function advanceByCadence(from: Date, cadence: ScheduleCadence): Date {
  const next = new Date(from);
  switch (cadence) {
    case ScheduleCadence.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case ScheduleCadence.BIWEEKLY:
      next.setDate(next.getDate() + 14);
      break;
    case ScheduleCadence.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

@Injectable()
export class ScheduledOrdersService {
  constructor(private prisma: PrismaService) {}

  private async resolveCustomer(userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
      select: { id: true, tenantId: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
    return customer;
  }

  async list(userId: string) {
    const customer = await this.resolveCustomer(userId);
    return this.prisma.scheduledOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, input: CreateScheduleInput) {
    const customer = await this.resolveCustomer(userId);

    // If an addressId is supplied it must belong to this customer — never
    // let a schedule point at someone else's saved address.
    if (input.addressId) {
      const addr = await this.prisma.customerAddress.findFirst({
        where: { id: input.addressId, customerId: customer.id },
        select: { id: true },
      });
      if (!addr) throw new BadRequestException('العنوان غير موجود');
    }

    return this.prisma.scheduledOrder.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        cadence: input.cadence,
        nextRunAt: input.nextRunAt,
        addressId: input.addressId,
        active: true,
      },
    });
  }

  async update(userId: string, scheduleId: string, input: UpdateScheduleInput) {
    const customer = await this.resolveCustomer(userId);
    const existing = await this.prisma.scheduledOrder.findFirst({
      where: { id: scheduleId, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');

    const data: {
      active?: boolean;
      cadence?: ScheduleCadence;
      nextRunAt?: Date;
    } = {};
    if (input.active !== undefined) data.active = input.active;
    if (input.cadence !== undefined) data.cadence = input.cadence;
    if (input.nextRunAt !== undefined) data.nextRunAt = input.nextRunAt;

    return this.prisma.scheduledOrder.update({
      where: { id: scheduleId },
      data,
    });
  }

  async remove(userId: string, scheduleId: string) {
    const customer = await this.resolveCustomer(userId);
    const existing = await this.prisma.scheduledOrder.findFirst({
      where: { id: scheduleId, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    await this.prisma.scheduledOrder.delete({ where: { id: scheduleId } });
    return { ok: true };
  }
}
