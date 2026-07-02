import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { CustomerStatus, LocationSource, Prisma, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { ImportRow } from './bulk-import.service';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';
import { hashPassword } from '../common/crypto';

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
  private readonly log = new Logger(CustomersService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @Inject(forwardRef(() => PushService)) private push: PushService,
  ) {}

  /**
   * Invalidate cached GET /customers/me for one user. Call after any write
   * that changes the payload (balance change, location move, status flip,
   * password reset). The key shape comes from UserScopedCacheInterceptor:
   * `<userId>:<tenantId>:<url>` — but `tenantId` on the cached value comes
   * from JWT, which we don't have here, so we delete by scanning known
   * variants. cache-manager `del` is forgiving when the key doesn't exist.
   *
   * `url` is the API path (no prefix) — Nest's HttpAdapter.getRequestUrl
   * returns the request URL relative to the global prefix. In our setup the
   * prefix is `api/v1`, so the URL the interceptor sees is `/customers/me`.
   */
  async invalidateMeCache(userId: string | null | undefined, tenantId?: string | null) {
    if (!userId) return;
    const variants = [
      `${userId}:${tenantId ?? 'no-tenant'}:/customers/me`,
      `${userId}:${tenantId ?? 'no-tenant'}:/api/v1/customers/me`,
    ];
    try {
      await Promise.all(variants.map((k) => this.cache.del(k)));
    } catch (err) {
      this.log.warn(`Cache invalidate failed for user=${userId}: ${(err as Error).message}`);
    }
  }

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
    const passwordHash = await hashPassword(plainPassword);

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
   * Customer-initiated self-signup lead. The prospect submitted their info
   * from the customer mobile app after passing OTP. We create the Customer
   * row in PENDING_APPROVAL state — plant admin reviews + approves to
   * trigger a tank delivery.
   *
   * Rejects if the plant doesn't exist or isn't actively serving customers.
   */
  async submitSelfLead(input: {
    tenantId: string;
    fullName: string;
    phone: string;
    district: string;
    addressLine: string;
    locationLng: number;
    locationLat: number;
  }) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: input.tenantId },
      select: { id: true, name: true, status: true },
    });
    if (!tenant) throw new NotFoundException('المعمل غير موجود');
    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      throw new BadRequestException('هذا المعمل لا يقبل طلبات جديدة حالياً');
    }

    // Guard against duplicate leads — if this phone already has a pending
    // request at THIS plant, return the existing one so the customer can
    // track its status instead of creating noise.
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId: input.tenantId,
        phone: input.phone,
      },
    });
    if (existing) {
      if (existing.status === CustomerStatus.PENDING_APPROVAL) {
        return { ok: true, customerId: existing.id, status: existing.status, deduped: true };
      }
      throw new BadRequestException(
        'هذا الرقم مسجّل بالفعل عند هذا المعمل. سجّل دخولك أو راجع المعمل.',
      );
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId: input.tenantId,
        fullName: input.fullName,
        phone: input.phone,
        whatsapp: input.phone,
        district: input.district,
        addressLine: input.addressLine,
        locationLng: input.locationLng,
        locationLat: input.locationLat,
        locationCapturedAt: new Date(),
        locationCapturedBy: LocationSource.CUSTOMER_PIN,
        status: CustomerStatus.PENDING_APPROVAL,
      },
    });
    // Notify plant admins — best effort, never block the lead creation.
    this.push
      .sendToTenantAdmins(
        input.tenantId,
        'طلب زبون جديد',
        `${input.fullName} من ${input.district} يطلب الانضمام لمعملك`,
        { kind: 'new-lead', customerId: customer.id, tenantId: input.tenantId },
      )
      .catch((err) => this.log.warn(`lead push failed: ${(err as Error).message}`));
    return { ok: true, customerId: customer.id, status: customer.status };
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
    const customer = await this.prisma.customer.create({
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
    this.push
      .sendToTenantAdmins(
        tenantId,
        'زبون جديد عبر السائق',
        `${input.fullName}${input.district ? ' من ' + input.district : ''} بانتظار موافقتك`,
        { kind: 'new-lead', customerId: customer.id, tenantId },
      )
      .catch((err) => this.log.warn(`driver-lead push failed: ${(err as Error).message}`));
    return customer;
  }

  /**
   * Plant owner approves a driver-registered customer. A User row is created
   * at this point (not at registration time) so the customer can log in
   * straight after approval — the plant gets the temporary password back.
   *
   * Also snapshots the new-customer bonus on the Customer row so the driver's
   * monthly salary picks it up. We snapshot the rate at approval time, not
   * at salary-computation time — so changing the bonus in settings later
   * doesn't retroactively rewrite already-earned commissions.
   */
  async approve(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Idempotent: if already has a user, just flip status. Don't re-snapshot
    // the bonus — that's earned on FIRST approval only.
    if (customer.userId) {
      const updated = await this.prisma.customer.update({
        where: { id: customerId },
        data: { status: CustomerStatus.ACTIVE },
      });
      await this.invalidateMeCache(updated.userId, updated.tenantId);
      return { ...updated, tempPassword: null };
    }

    // Snapshot the bonus only when there's a driver to pay AND we haven't
    // already paid (approvedAt is null on first approval).
    let bonusIqd = 0;
    if (customer.onboardedByDriverId && !customer.approvedAt) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { newCustomerBonusIqd: true },
      });
      bonusIqd = tenant?.newCustomerBonusIqd ?? 0;
    }

    const plainPassword = generatePassword();
    const passwordHash = await hashPassword(plainPassword);

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
        data: {
          status: CustomerStatus.ACTIVE,
          userId: user.id,
          approvedAt: new Date(),
          registrationBonusIqd: bonusIqd,
        },
      });
    });

    await this.invalidateMeCache(updated.userId, updated.tenantId);
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

    const plainPassword = newPassword ?? generatePassword();
    const passwordHash = await hashPassword(plainPassword);

    // إذا الزبون لم يُربط بحساب user بعد (مثل الـ seed customers):
    //  - لو في user بنفس الـ phone أصلاً → أربطه + حدّث الـ password
    //  - وإلا أنشئ user جديد
    if (!customer.userId) {
      await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { phone: customer.phone },
        });
        let userId: string;
        if (existingUser) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { passwordHash, tenantId, role: UserRole.CUSTOMER, fullName: customer.fullName },
          });
          userId = existingUser.id;
        } else {
          const user = await tx.user.create({
            data: {
              tenantId,
              phone: customer.phone,
              passwordHash,
              fullName: customer.fullName,
              role: UserRole.CUSTOMER,
            },
          });
          userId = user.id;
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: { userId, status: CustomerStatus.ACTIVE },
        });
        // إلغ أي refresh tokens قديمة
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
      return { ok: true, tempPassword: plainPassword };
    }

    // الحالة العادية: update الـ passwordHash + revoke الـ refresh tokens
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

  /**
   * Bulk import customers from a parsed Excel sheet.
   *
   * يعالج صفوف Excel بالعشرات/الآلاف:
   *  1. يستثني الصفوف التي تحوي errors (validate تمّ في BulkImportService)
   *  2. يجلب الأرقام الموجودة في DB دفعة واحدة لتجاهل المكرّر
   *  3. يولّد كلمات سر argon2 بـ concurrency=10 (٢٠٠٠ تأخذ ~٢٠ ثانية)
   *  4. ينشئ User + Customer لكل صف صالح في chunks من 50 (لتفادي transaction طويل)
   *  5. يرجع: created (مع plaintext passwords للطباعة) + skipped (مع سبب)
   *
   * **هام:** كلمات السرّ تُرجَع مرّة واحدة فقط — التطبيق يطبعها للمعمل لتوزيعها.
   */
  async bulkCreate(tenantId: string, rows: ImportRow[]) {
    const valid = rows.filter((r) => (!r.errors || r.errors.length === 0) && r.fullName && r.phone);
    const invalid = rows.filter((r) => r.errors && r.errors.length > 0);

    // اجلب الأرقام الموجودة دفعة واحدة
    const phones = valid.map((r) => r.phone!);
    const existing = await this.prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { phone: true },
    });
    const existingSet = new Set(existing.map((u) => u.phone));

    const toCreate = valid.filter((r) => !existingSet.has(r.phone!));
    const skippedExisting = valid.filter((r) => existingSet.has(r.phone!));

    // ولّد كلمات السر + الـ hashes بـ concurrency 10
    const credentials = await this.parallelGenerateCreds(toCreate.length, 10);

    // أنشئ في chunks من 50 (transaction واحد لكل chunk)
    const CHUNK = 50;
    const created: Array<{
      fullName: string;
      phone: string;
      password: string;
      district: string;
    }> = [];

    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const chunk = toCreate.slice(i, i + CHUNK);
      const chunkCreds = credentials.slice(i, i + CHUNK);

      await this.prisma.$transaction(async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          const user = await tx.user.create({
            data: {
              tenantId,
              phone: row.phone!,
              passwordHash: chunkCreds[j].hash,
              fullName: row.fullName!,
              role: UserRole.CUSTOMER,
            },
          });
          await tx.customer.create({
            data: {
              tenantId,
              userId: user.id,
              fullName: row.fullName!,
              phone: row.phone!,
              whatsapp: row.phone!,
              district: row.district ?? 'غير محدد',
              addressLine: row.addressLine ?? '—',
            },
          });
        }
      });

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        created.push({
          fullName: row.fullName!,
          phone: row.phone!,
          password: chunkCreds[j].plain,
          district: row.district ?? 'غير محدد',
        });
      }
    }

    return {
      created,
      skipped: {
        invalid: invalid.map((r) => ({
          row: r.rowNumber,
          fullName: r.fullName,
          phone: r.phone,
          reasons: r.errors!,
        })),
        existing: skippedExisting.map((r) => ({
          row: r.rowNumber,
          fullName: r.fullName,
          phone: r.phone,
          reason: 'الرقم مسجّل مسبقاً في النظام',
        })),
      },
      summary: {
        totalRows: rows.length,
        created: created.length,
        skippedInvalid: invalid.length,
        skippedExisting: skippedExisting.length,
      },
    };
  }

  /** يولّد N أزواج (plain, hash) متوازياً بحد أقصى concurrency */
  private async parallelGenerateCreds(
    count: number,
    concurrency: number,
  ): Promise<Array<{ plain: string; hash: string }>> {
    const results: Array<{ plain: string; hash: string }> = new Array(count);
    let next = 0;

    const worker = async () => {
      while (true) {
        const idx = next++;
        if (idx >= count) return;
        const plain = generatePassword();
        const hash = await hashPassword(plain);
        results[idx] = { plain, hash };
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, count) }, () => worker()));
    return results;
  }

  /**
   * Returns the customer profile for the currently-authenticated user.
   * Used by the customer mobile app's home screen — it looks up the
   * customer row tied to the logged-in user.id.
   */
  async findByUserId(userId: string) {
    // Resilience: a Customer row whose `userId` was never linked (a seed/import
    // defect) used to 404 here, which bricked the customer app home on an
    // infinite skeleton. If the primary lookup misses, fall back to matching
    // the user's phone within their tenant and self-heal the link — a logged-in
    // CUSTOMER should always be able to resolve their own profile.
    const linked = await this.prisma.customer.findFirst({ where: { userId } });
    if (!linked) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, tenantId: true },
      });
      if (user?.phone) {
        const byPhone = await this.prisma.customer.findFirst({
          where: {
            phone: user.phone,
            ...(user.tenantId ? { tenantId: user.tenantId } : {}),
            userId: null,
          },
        });
        if (byPhone) {
          await this.prisma.customer
            .update({ where: { id: byPhone.id }, data: { userId } })
            .catch(() => undefined); // best-effort one-time heal
        }
      }
    }

    const customer = await this.prisma.customer.findFirst({
      where: { userId },
      include: {
        // الحقول التي ينتظرها mobile-customer/lib/types.ts → Tank interface:
        // id, serialNumber, qrCode, capacity, status, lastRefillAt
        tanks: {
          select: {
            id: true,
            serialNumber: true,
            qrCode: true,
            capacity: true,
            status: true,
            lastRefillAt: true,
          },
        },
        // نضم سعر التعبئة الحالي للمعمل حتى يستخدمه التطبيق في زر "اطلب تعبئة الآن"
        // بدلاً من قيمة مهارد‑كود. يتجدد تلقائياً مع كل refetch لـ /customers/me.
        tenant: { select: { refillPriceIqd: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    const { tenant, ...rest } = customer;
    return { ...rest, refillPriceIqd: tenant.refillPriceIqd };
  }

  async list(
    tenantId: string,
    f: ListFilters = {},
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.CustomerWhereInput = { tenantId };
    if (f.status) where.status = f.status;
    if (f.district) where.district = f.district;
    if (f.search) {
      // Search by name (case-insensitive), phone substring, address substring,
      // OR by any tank QR code owned by the customer. The walk-in flow on
      // mobile-worker explicitly tells the driver "ابحث بالاسم، الهاتف، أو
      // رقم الخزان" — the tank-QR branch is essential for that UX.
      where.OR = [
        { fullName: { contains: f.search, mode: 'insensitive' } },
        { phone: { contains: f.search } },
        { addressLine: { contains: f.search, mode: 'insensitive' } },
        { tanks: { some: { qrCode: { contains: f.search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { tanks: { select: { id: true, qrCode: true, capacity: true } } },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginated(items, total, { page, pageSize });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        tanks: { select: { id: true, qrCode: true, capacity: true } },
        refillOrders: {
          take: 10,
          orderBy: { requestedAt: 'desc' },
          include: { driver: { include: { user: { select: { fullName: true } } } } },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    // Shape response — recentOrders + payments (derived من completed refillOrders)
    return {
      ...customer,
      recentOrders: customer.refillOrders.map((o: any) => ({
        id: o.id,
        requestedAt: o.requestedAt,
        status: o.status,
        priceIqd: o.priceIqd,
        driver: o.driver ? { user: { fullName: o.driver.user.fullName } } : null,
      })),
      payments: customer.refillOrders
        .filter((o: any) => o.status === 'COMPLETED' && o.paidAmountIqd > 0)
        .map((o: any) => ({
          id: o.id,
          amountIqd: o.paidAmountIqd,
          method: 'نقداً', // افتراضياً — لاحقاً نقرأها من حقل paymentMethod
          createdAt: o.completedAt ?? o.requestedAt,
        })),
    };
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
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        locationLng: lng,
        locationLat: lat,
        locationCapturedAt: new Date(),
        locationCapturedBy: source,
      },
    });
    await this.invalidateMeCache(updated.userId, updated.tenantId);
    return updated;
  }

  /**
   * Customer (or plant) flags a house move. The previous coordinates are
   * preserved for the grace period so the system tolerates either address.
   * The plant approves and adds a delivery / reclaim job to the driver's
   * route for the new house.
   */
  async startMove(
    tenantId: string,
    customerId: string,
    newLng: number,
    newLat: number,
    ownerUserId?: string,
  ) {
    // When [ownerUserId] is provided (request came from a plain customer, not a
    // plant admin) the lookup is additionally scoped to that user — so a
    // customer can ONLY move their own record, never another customer's by id.
    const c = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
        ...(ownerUserId ? { userId: ownerUserId } : {}),
      },
    });
    if (!c) throw new NotFoundException('Customer not found');
    const updated = await this.prisma.customer.update({
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
    await this.invalidateMeCache(updated.userId, updated.tenantId);
    return updated;
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
