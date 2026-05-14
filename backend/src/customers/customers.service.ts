import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerStatus, LocationSource, Prisma } from '@prisma/client';

interface CreateCustomerInput {
  fullName: string;
  phone: string;
  whatsapp?: string;
  district: string;
  addressLine: string;
  locationLng?: number;
  locationLat?: number;
}

interface ListFilters {
  status?: CustomerStatus;
  district?: string;
  search?: string;
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(tenantId: string, input: CreateCustomerInput) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        ...input,
        whatsapp: input.whatsapp ?? input.phone,
      },
    });
  }

  /**
   * Driver-initiated walk-up registration. Captured live at the buyer's
   * door; plant owner approves it before the account can request refills.
   * GPS becomes the home location automatically.
   */
  async registerByDriver(
    tenantId: string,
    driverId: string,
    input: CreateCustomerInput,
  ) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        ...input,
        whatsapp: input.whatsapp ?? input.phone,
        status: CustomerStatus.PENDING_APPROVAL,
        onboardedByDriverId: driverId,
        onboardedAt: new Date(),
        ...(input.locationLng != null && input.locationLat != null
          ? {
              locationCapturedAt: new Date(),
              locationCapturedBy: 'DRIVER_AT_INSTALL' as const,
            }
          : {}),
      },
    });
  }

  /** Plant owner approves a driver-registered customer. */
  async approve(tenantId: string, customerId: string) {
    return this.prisma.customer.update({
      where: { id: customerId, tenantId },
      data: { status: CustomerStatus.ACTIVE },
    });
  }

  listPendingApprovals(tenantId: string) {
    return this.prisma.customer.findMany({
      where: { tenantId, status: CustomerStatus.PENDING_APPROVAL },
      orderBy: { onboardedAt: 'desc' },
    });
  }

  list(tenantId: string, f: ListFilters = {}) {
    const where: Prisma.CustomerWhereInput = { tenantId };
    if (f.status) where.status = f.status;
    if (f.district) where.district = f.district;
    if (f.search) {
      where.OR = [
        { fullName: { contains: f.search, mode: 'insensitive' } },
        { phone: { contains: f.search } },
      ];
    }

    return this.prisma.customer.findMany({
      where,
      include: { tanks: { select: { id: true, qrCode: true, capacity: true } } },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        tanks: true,
        refillOrders: { take: 10, orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /**
   * Capture / update the customer's home GPS. Called when:
   *  - driver completes the first delivery (`DRIVER_AT_INSTALL` — most accurate)
   *  - customer drops a pin themselves (`CUSTOMER_PIN`)
   *  - admin sets it manually from the dashboard (`ADMIN_MANUAL`)
   *  - we extract it from the first completed refill after an offline-only
   *    onboarding (`OFFLINE_SYNC`)
   */
  async captureLocation(
    tenantId: string,
    customerId: string,
    lng: number,
    lat: number,
    source: LocationSource,
  ) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!c) throw new NotFoundException('Customer not found');
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        locationLng: lng,
        locationLat: lat,
        locationCapturedAt: new Date(),
        locationCapturedBy: source,
      },
    });
  }

  /**
   * Customer (or plant) flags a house move. The previous coordinates are
   * preserved for the grace period so the system tolerates either address.
   * The plant approves and adds a delivery / reclaim job to the driver's
   * route for the new house.
   */
  async startMove(tenantId: string, customerId: string, newLng: number, newLat: number) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!c) throw new NotFoundException('Customer not found');
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        previousLocationLng: c.locationLng,
        previousLocationLat: c.locationLat,
        locationLng: newLng,
        locationLat: newLat,
        locationCapturedAt: new Date(),
        locationCapturedBy: LocationSource.CUSTOMER_PIN,
        movedAt: new Date(),
      },
    });
  }

  /**
   * Recompute customer health buckets. Called by the scheduled job.
   * Returns [warning, atRisk] customer arrays so the notification job
   * can send the right message kind.
   */
  async refreshHealthStatuses(tenantId: string) {
    const reminderDays = Number(process.env.REMINDER_FIRST_DAYS ?? 25);
    const warningDays = Number(process.env.REMINDER_WARNING_DAYS ?? 35);

    const reminderCutoff = daysAgo(reminderDays);
    const warningCutoff = daysAgo(warningDays);

    // ACTIVE → AT_RISK once we cross the warning cutoff
    await this.prisma.customer.updateMany({
      where: {
        tenantId,
        status: CustomerStatus.ACTIVE,
        OR: [
          { lastRefillAt: { lt: warningCutoff } },
          { lastRefillAt: null, registeredAt: { lt: warningCutoff } },
        ],
      },
      data: { status: CustomerStatus.AT_RISK },
    });

    const dueForReminder = await this.prisma.customer.findMany({
      where: {
        tenantId,
        status: CustomerStatus.ACTIVE,
        lastRefillAt: { lt: reminderCutoff, gte: warningCutoff },
      },
      select: { id: true, fullName: true, phone: true, whatsapp: true },
    });

    const atRisk = await this.prisma.customer.findMany({
      where: { tenantId, status: CustomerStatus.AT_RISK },
      select: { id: true, fullName: true, phone: true, whatsapp: true },
    });

    return { dueForReminder, atRisk };
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
