import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerStatus, LocationSource, Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

interface CreateCustomerInput {
  fullName: string;
  phone: string;
  whatsapp?: string;
  district: string;
  addressLine: string;
  locationLng?: number;
  locationLat?: number;
  /**
   * Optional. If omitted, a 6-character password is generated. Either way the
   * plain value is returned ONCE in the response so the plant admin can hand it
   * to the customer (in person, or via WhatsApp). It is never stored in plain
   * form — only the argon2 hash lives on the User row.
   */
  password?: string;
}

/**
 * 6-character credentials are a deliberate compromise:
 *  - long enough that incidental guessing is hopeless
 *  - short enough that a plant admin can read it over the phone or write it on
 *    paper without errors
 * Together with the rate-limited /auth/login endpoint (5 attempts / 15 min /
 * phone) the entropy is comfortable for this threat model.
 *
 * Excludes 0/O/1/I/l visually-confusable characters.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

interface ListFilters {
  status?: CustomerStatus;
  district?: string;
  search?: string;
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Plant admin creates a customer from the dashboard. Also provisions a
   * User row (role=CUSTOMER) so the customer can sign into the mobile app
   * with phone + password. The plant tells the customer the password verbally
   * (or via WhatsApp). Customer can change it later from the app.
   *
   * The plain password is returned ONLY in this response — never persisted.
   */
  async create(tenantId: string, input: CreateCustomerInput) {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new ConflictException('A user with this phone already exists');
    }

    const plainPassword = input.password ?? generatePassword();
    const passwordHash = await argon2.hash(plainPassword);

    const { password: _ignore, ...customerInput } = input;

    const customer = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: input.phone,
          passwordHash,
          fullName: input.fullName,
          role: UserRole.CUSTOMER,
          tenantId,
        },
      });
      return tx.customer.create({
        data: {
          tenantId,
          userId: user.id,
          ...customerInput,
          whatsapp: input.whatsapp ?? input.phone,
        },
      });
    });

    // tempPassword is returned ONCE — the dashboard displays it on the
    // success screen, and there is no way to recover it afterward.
    return { ...customer, tempPassword: plainPassword };
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

  /**
   * Plant owner approves a driver-registered customer. A User row is created
   * at this point (not at registration time) so the customer can log in
   * straight after approval — the plant gets the temporary password back.
   */
  async approve(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Idempotent: if already has a user, just flip status.
    if (customer.userId) {
      const updated = await this.prisma.customer.update({
        where: { id: customerId },
        data: { status: CustomerStatus.ACTIVE },
      });
      return { ...updated, tempPassword: null };
    }

    const plainPassword = generatePassword();
    const passwordHash = await argon2.hash(plainPassword);

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: customer.phone,
          passwordHash,
          fullName: customer.fullName,
          role: UserRole.CUSTOMER,
          tenantId,
        },
      });
      return tx.customer.update({
        where: { id: customerId },
        data: { status: CustomerStatus.ACTIVE, userId: user.id },
      });
    });

    return { ...updated, tempPassword: plainPassword };
  }

  /**
   * Plant admin forces a new password for the customer. Returns the plain
   * value ONCE — admin tells the customer over WhatsApp/in-person.
   *
   * Also revokes existing refresh tokens so old sessions stop working
   * immediately (defensive: if the reset is happening because the customer
   * lost access, a stolen session shouldn't survive the reset).
   */
  async resetPassword(tenantId: string, customerId: string, newPassword?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: { user: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.userId) {
      throw new NotFoundException('Customer has no login account yet — approve them first');
    }

    const plainPassword = newPassword ?? generatePassword();
    const passwordHash = await argon2.hash(plainPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: customer.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: customer.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true, tempPassword: plainPassword };
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
