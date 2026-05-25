import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { CustomersService } from '../customers/customers.service';
import { EmailService } from '../email/email.service';
import {
  CustomerStatus,
  PaymentMethod,
  Prisma,
  RefillOrderKind,
  RefillOrderStatus,
  TankStatus,
} from '@prisma/client';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

interface CreateOrderInput {
  customerId: string;
  tankId?: string;
  kind?: RefillOrderKind;
  scheduledFor?: Date;
  priceIqd?: number;
}

interface CompleteOrderInput {
  qrCode?: string;
  paymentMethod: PaymentMethod;
  paidAmountIqd: number;
  proofPhotoUrl?: string;
  /** Driver's GPS at the moment of completion. Required for `REFILL` orders. */
  completionLng?: number;
  completionLat?: number;
  /** Required when kind is TANK_RECLAIM — picked from the radio list. */
  reclaimReason?: 'NON_COMPLIANCE' | 'MAINTENANCE' | 'CUSTOMER_MOVED' | 'CUSTOMER_CANCELLED' | 'TANK_DAMAGED' | 'OTHER';
  reclaimNotes?: string;
}

/**
 * Reject completions logged more than this distance from the customer's
 * registered coordinates. 50 m matches a typical urban house footprint
 * plus GPS jitter, and is tight enough to prevent "fill from down the
 * street" fraud. Tunable via REFILL_GPS_MAX_DISTANCE_M.
 */
const GPS_MAX_DISTANCE_M = Number(process.env.REFILL_GPS_MAX_DISTANCE_M ?? 50);

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private customers: CustomersService,
    private email: EmailService,
  ) {}

  async create(tenantId: string, input: CreateOrderInput) {
    // Subscription gate — block new orders if the plant has blown past
    // its monthly operations limit AND hasn't upgraded. We compute the
    // limit per-plan inline so the orders module doesn't have to pull in
    // PlantController. Refills are the metric we bill on.
    await this.assertWithinPlanLimit(tenantId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, tenantId },
      include: { tanks: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const tankId = input.tankId ?? customer.tanks[0]?.id;
    const kind = input.kind ?? RefillOrderKind.REFILL;
    if (kind === RefillOrderKind.REFILL && !tankId) {
      throw new BadRequestException('Customer has no tank assigned for a refill');
    }

    // Guard against duplicate active orders. A customer should only have ONE
    // in-flight refill request at a time — otherwise the same tank ends up
    // in the driver's queue 3-4× and the plant ships the same water twice.
    // Active = anything not yet COMPLETED / CANCELLED / FAILED.
    if (kind === RefillOrderKind.REFILL) {
      const existing = await this.prisma.refillOrder.findFirst({
        where: {
          tenantId,
          customerId: input.customerId,
          kind: RefillOrderKind.REFILL,
          status: {
            in: [
              RefillOrderStatus.PENDING,
              RefillOrderStatus.ASSIGNED,
              RefillOrderStatus.EN_ROUTE,
            ],
          },
        },
        select: { id: true, status: true, requestedAt: true },
      });
      if (existing) {
        throw new ConflictException({
          message: 'لديك طلب تعبئة نشط بالفعل. انتظر اكتماله قبل طلب آخر.',
          existingOrderId: existing.id,
          existingStatus: existing.status,
        });
      }
    }

    // Snapshot the tenant's CURRENT refill price onto the order. If the
    // plant changes the price after the order is placed, the customer
    // still pays the price they saw when they tapped "اطلب الآن". Same
    // pattern as completed-order bonus snapshots.
    let priceIqd = input.priceIqd;
    if (priceIqd == null) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { refillPriceIqd: true },
      });
      priceIqd = tenant?.refillPriceIqd ?? 1000;
    }

    // Auto-assign to a driver. Preference order:
    //   1. AVAILABLE drivers (online but not on a route) — most-recently-seen first
    //   2. ON_ROUTE drivers (already working a tour, can pick up another)
    //   3. Any active driver in the tenant (covers OFFLINE — they'll see
    //      the assignment the moment they open the app)
    // If literally no drivers exist we still create the order in PENDING so
    // the plant admin sees it in the dashboard and can hire/assign manually.
    const driver = await this.pickDriverForNewOrder(tenantId);

    const order = await this.prisma.refillOrder.create({
      data: {
        tenantId,
        customerId: input.customerId,
        tankId,
        kind,
        priceIqd,
        scheduledFor: input.scheduledFor,
        ...(driver
          ? {
              driverId: driver.id,
              status: RefillOrderStatus.ASSIGNED,
              assignedAt: new Date(),
            }
          : {}),
      },
    });

    // Notify the assigned driver — they don't have to keep polling. Fail
    // silently if push delivery fails (the order still exists; driver will
    // see it on next /me/today refresh as a fallback).
    if (driver) {
      this.push
        .sendToUser(
          driver.userId,
          '🚐 طلب جديد',
          `${customer.fullName} — ${customer.district}`,
          { orderId: order.id, kind: 'new-order' },
        )
        .catch((err) => console.warn('[push] notify driver failed:', err));
    }

    // Notify plant admins on the mobile-admin app. Only for customer-initiated
    // orders — walk-in + tank-delivery flows already start from the admin's
    // tap so the admin doesn't need to be told. Best-effort, never blocks.
    this.push
      .sendToTenantAdmins(
        tenantId,
        driver ? 'طلب جديد (مُكلَّف)' : 'طلب جديد بانتظار تعيين سائق',
        `${customer.fullName} — ${customer.district} · ${priceIqd.toLocaleString('ar-IQ')} د.ع`,
        { orderId: order.id, kind: 'new-order', tenantId },
      )
      .catch((err) => console.warn('[push] notify admins failed:', err));

    return order;
  }

  /**
   * Blocks new orders when the plant exceeded its monthly ops cap. The
   * dashboard subscription page tells them to upgrade. We throw a
   * specific error so the customer mobile can surface a friendly message
   * instead of generic "failed".
   */
  private async assertWithinPlanLimit(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    const TIER_OPS: Record<string, number> = {
      STARTER: 300,
      PRO: 1500,
      BUSINESS: 5000,
      ENTERPRISE: 999_999,
    };
    const limit = TIER_OPS[tenant?.plan ?? 'STARTER'] ?? 300;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const opsThisMonth = await this.prisma.refillOrder.count({
      where: {
        tenantId,
        status: RefillOrderStatus.COMPLETED,
        completedAt: { gte: monthStart },
      },
    });
    if (opsThisMonth >= limit) {
      throw new BadRequestException(
        'وصل المعمل لحدّ خطّته الشهرية. الطلبات الجديدة مغلقة مؤقتاً حتى ترقية الخطّة.',
      );
    }
  }

  /**
   * Simplest possible driver picker — first available driver in the tenant.
   * When traffic grows, replace with "fewest active orders" or geo-nearest
   * scoring. Returns null when the tenant has zero drivers (rare, but the
   * caller handles it by leaving the order PENDING for manual triage).
   */
  private async pickDriverForNewOrder(tenantId: string) {
    const available = await this.prisma.driver.findFirst({
      where: { tenantId, status: 'AVAILABLE' },
      orderBy: { lastLocationAt: 'desc' },
    });
    if (available) return available;
    const onRoute = await this.prisma.driver.findFirst({
      where: { tenantId, status: 'ON_ROUTE' },
      orderBy: { lastLocationAt: 'desc' },
    });
    if (onRoute) return onRoute;
    return this.prisma.driver.findFirst({
      where: { tenantId },
      orderBy: { hiredAt: 'asc' },
    });
  }

  async list(
    tenantId: string,
    status?: RefillOrderStatus,
    driverId?: string,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.RefillOrderWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(driverId && { driverId }),
    };
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refillOrder.findMany({
        where,
        include: {
          customer: { select: { fullName: true, phone: true, district: true, locationLat: true, locationLng: true } },
          driver: { select: { id: true, user: { select: { fullName: true } } } },
          tank: { select: { qrCode: true, capacity: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.refillOrder.count({ where }),
    ]);
    return paginated(items, total, { page, pageSize });
  }

  async assign(tenantId: string, orderId: string, driverId: string) {
    const order = await this.prisma.refillOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== RefillOrderStatus.PENDING) {
      throw new BadRequestException(`Order is ${order.status}, cannot assign`);
    }
    const driver = await this.prisma.driver.findFirst({ where: { id: driverId, tenantId } });
    if (!driver) throw new NotFoundException('Driver not found');

    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: {
        driverId,
        status: RefillOrderStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });
  }

  async start(orderId: string, driverId: string) {
    const order = await this.prisma.refillOrder.findFirst({
      where: { id: orderId, driverId },
      include: { customer: { include: { user: true } } },
    });
    if (!order) throw new NotFoundException('Order not found or not assigned to you');
    if (order.status !== RefillOrderStatus.ASSIGNED) {
      throw new BadRequestException(`Order is ${order.status}`);
    }
    const updated = await this.prisma.refillOrder.update({
      where: { id: orderId },
      data: { status: RefillOrderStatus.EN_ROUTE, startedAt: new Date() },
    });
    // Tell the customer the driver is moving toward them.
    if (order.customer?.user) {
      this.push
        .sendToUser(
          order.customer.user.id,
          '🚐 السائق متجه إليك',
          'سيصل خلال وقت قصير. تحقّق من العنوان والـ GPS.',
          { orderId, kind: 'en-route' },
        )
        .catch((err) => console.warn('[push] en-route notify failed:', err));
    }
    return updated;
  }

  /**
   * Driver marks complete. The driver app does NOT scan QR — instead, the
   * route preloads "this customer = this tank" and we verify the refill
   * with three signals that don't require manual data entry:
   *   1. GPS — driver is within GPS_MAX_DISTANCE_M of the customer's home
   *   2. Photo proof — non-empty proofPhotoUrl (uploaded to S3 before this call)
   *   3. Customer WhatsApp confirmation — happens asynchronously after
   *
   * If the customer's location isn't yet recorded (newly onboarded, no GPS),
   * we accept the completion but flag it as `gpsVerified: false` so the plant
   * can see it on the dashboard and chase if needed.
   *
   * `qrCode` is retained for forward compatibility (e.g., delivery / reclaim
   * audits) but no longer required for routine refills.
   */
  async complete(orderId: string, driverId: string, input: CompleteOrderInput) {
    const order = await this.prisma.refillOrder.findFirst({
      where: { id: orderId, driverId },
      include: { tank: { include: { tenant: true } }, customer: true },
    });
    if (!order) throw new NotFoundException('Order not found or not yours');
    // Every RefillOrder should be linked to a customer in practice — if we
    // got here without one, the order row is corrupt and we'd rather fail
    // loud than crash later with `cannot read property of null`.
    if (!order.customer) {
      throw new BadRequestException('Order has no associated customer (data integrity issue)');
    }
    if (order.status !== RefillOrderStatus.EN_ROUTE && order.status !== RefillOrderStatus.ASSIGNED) {
      throw new BadRequestException(`Order is ${order.status}, cannot complete`);
    }

    // Defensive: tank, if any, must still belong to this tenant.
    if (order.tank && order.tank.tenantId !== order.tenantId) {
      throw new BadRequestException('Tank belongs to a different plant');
    }

    // Layer 1: GPS distance check — only enforced when both sides have coordinates.
    let gpsDistanceM: number | null = null;
    let gpsVerified = false;
    const gpsAvailable =
      input.completionLng != null &&
      input.completionLat != null &&
      order.customer.locationLng != null &&
      order.customer.locationLat != null;

    if (order.kind === RefillOrderKind.REFILL && gpsAvailable) {
      gpsDistanceM = Math.round(
        haversineMetres(
          input.completionLat!,
          input.completionLng!,
          order.customer.locationLat!,
          order.customer.locationLng!,
        ),
      );

      // If the customer recently moved, the system also tolerates the
      // previous address (in case the driver hasn't been notified). The
      // grace window widens the geofence on either side.
      const inMoveGracePeriod =
        order.customer.movedAt &&
        Date.now() - order.customer.movedAt.getTime() < 30 * 24 * 60 * 60 * 1000;

      let effectiveLimit = GPS_MAX_DISTANCE_M;
      if (inMoveGracePeriod && order.customer.previousLocationLat && order.customer.previousLocationLng) {
        const distToPrev = haversineMetres(
          input.completionLat!,
          input.completionLng!,
          order.customer.previousLocationLat,
          order.customer.previousLocationLng,
        );
        gpsDistanceM = Math.min(gpsDistanceM, Math.round(distToPrev));
        effectiveLimit = GPS_MAX_DISTANCE_M * 3; // 150 m during move
      }

      if (gpsDistanceM > effectiveLimit) {
        throw new BadRequestException(
          `You are ${gpsDistanceM} m from ${order.customer.fullName}'s registered address. ` +
            `Refills must be completed within ${effectiveLimit} m. Are you at the right house?`,
        );
      }
      gpsVerified = true;
    }

    // If the customer has no location on file yet (e.g. onboarded via admin
    // without GPS), capture the driver's coordinates as the home address.
    // The plant can override later, but having *some* location is far better
    // than none for future refills.
    if (
      order.kind === RefillOrderKind.REFILL &&
      input.completionLat != null &&
      input.completionLng != null &&
      order.customer.locationLat == null
    ) {
      await this.prisma.customer.update({
        where: { id: order.customer.id },
        data: {
          locationLng: input.completionLng,
          locationLat: input.completionLat,
          locationCapturedAt: new Date(),
          locationCapturedBy: 'DRIVER_AT_INSTALL',
        },
      });
    }

    // Layer 2: photo proof is required for refills — it's the evidence trail
    // for the (rare) case where a customer disputes a refill via WhatsApp.
    if (order.kind === RefillOrderKind.REFILL && !input.proofPhotoUrl) {
      throw new BadRequestException(
        'Photo proof is required for a refill. Take one quick photo of the filled tank.',
      );
    }

    // Reclaims require a reason + photo so the plant can audit later.
    if (order.kind === RefillOrderKind.TANK_RECLAIM) {
      if (!input.reclaimReason) {
        throw new BadRequestException('Please pick a reason for reclaiming the tank.');
      }
      if (!input.proofPhotoUrl) {
        throw new BadRequestException('Photo of the reclaimed tank is required.');
      }
    }

    // Optional QR check kept as defense-in-depth — if the driver app
    // happens to send one (e.g., for ambiguous multi-tank households),
    // we still confirm it matches the assigned tank.
    const qrScanned = !!(input.qrCode && order.tank && input.qrCode === order.tank.qrCode);
    if (order.tank && input.qrCode && !qrScanned) {
      throw new BadRequestException(
        `QR mismatch: scanned tank ${input.qrCode} is not the one assigned to ${order.customer.fullName}.`,
      );
    }

    // Look up the tenant's bonus config so we can snapshot the right
    // amount on the completed order. Different kinds get different bonuses.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: order.tenantId },
      select: {
        refillBonusIqd: true,
        deliveryBonusIqd: true,
        reclaimBonusIqd: true,
      },
    });
    const bonusIqd =
      order.kind === RefillOrderKind.REFILL ? (tenant?.refillBonusIqd ?? 0) :
      order.kind === RefillOrderKind.TANK_DELIVERY ? (tenant?.deliveryBonusIqd ?? 0) :
      order.kind === RefillOrderKind.TANK_RECLAIM ? (tenant?.reclaimBonusIqd ?? 0) : 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.refillOrder.update({
        where: { id: orderId },
        data: {
          status: RefillOrderStatus.COMPLETED,
          completedAt: new Date(),
          paymentMethod: input.paymentMethod,
          paidAmountIqd: input.paidAmountIqd,
          paidAt: input.paidAmountIqd > 0 ? new Date() : null,
          proofPhotoUrl: input.proofPhotoUrl,
          qrScanned,
          completionLng: input.completionLng,
          completionLat: input.completionLat,
          gpsDistanceM,
          gpsVerified,
          bonusIqd,
        },
      });

      const balanceDelta = input.paidAmountIqd - order.priceIqd; // negative = owes plant

      // order.customerId is non-null in practice (every refill belongs to
      // a customer); narrow with a defensive throw so Prisma's stricter
      // typing accepts it as a unique identifier.
      if (!order.customerId) {
        throw new BadRequestException('Order has no customer id');
      }

      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          status: CustomerStatus.ACTIVE,
          lastRefillAt: new Date(),
          totalRefills: { increment: 1 },
          balanceIqd: { increment: balanceDelta },
        },
      });

      if (order.tank) {
        await tx.tank.update({
          where: { id: order.tank.id },
          data: {
            lastRefillAt: new Date(),
            ...(order.kind === RefillOrderKind.TANK_DELIVERY && {
              status: TankStatus.ASSIGNED,
              installedAt: new Date(),
            }),
            ...(order.kind === RefillOrderKind.TANK_RECLAIM && {
              customerId: null,
              status: TankStatus.RECLAIMED,
              reclaimedAt: new Date(),
              reclaimedByDriverId: driverId,
              reclaimReason: input.reclaimReason as any,
              reclaimNotes: input.reclaimNotes,
              reclaimPhotoUrl: input.proofPhotoUrl,
            }),
          },
        });
      }

      // Wave 4: decrement plant's water stock for refills. Defensive try
      // so a missing/disabled stock row doesn't block the refill itself.
      if (order.kind === RefillOrderKind.REFILL && order.tank) {
        const liters = order.tank.capacity === 'L500' ? 500 : 350;
        try {
          await tx.waterStock.update({
            where: { tenantId: order.tenantId },
            data: { currentLiters: { decrement: liters } },
          });
        } catch {
          /* stock row not initialised yet — skip */
        }
      }

      return completed;
    });

    // Push notification to customer (outside transaction so a push failure
    // doesn't roll back the completed order). Customer.user might be null
    // for legacy customers who haven't claimed an account yet.
    if (order.customer?.userId) {
      const arabicKind =
        order.kind === RefillOrderKind.REFILL ? 'تعبئة' :
        order.kind === RefillOrderKind.TANK_DELIVERY ? 'توصيل خزان' : 'سحب خزان';
      this.push
        .sendToUser(
          order.customer.userId,
          `✅ تمّت ${arabicKind}`,
          `المبلغ المدفوع: ${input.paidAmountIqd.toLocaleString('ar-IQ')} د.ع. شكراً لاستخدامك داري.`,
          { orderId, kind: 'completed' },
        )
        .catch((err) => console.warn('[push] completion notify failed:', err));
    }

    // Cache invalidation: balance / lastRefillAt / totalRefills all changed,
    // so the next /customers/me must hit DB.
    if (order.customer?.userId) {
      await this.customers.invalidateMeCache(order.customer.userId, order.tenantId);
    }

    // Email receipt — only for refills, only if the customer has email on
    // file. Customer schema doesn't (yet) have an email column, so we
    // gracefully no-op when none is available. Wrapped in try/catch so an
    // SMTP outage never blocks order completion. Follow-up TODO: add
    // `Customer.email` (optional) so receipts can actually be delivered.
    if (
      order.kind === RefillOrderKind.REFILL &&
      order.customer &&
      result.completedAt
    ) {
      const recipientEmail = (order.customer as unknown as { email?: string | null }).email;
      if (recipientEmail) {
        try {
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: order.tenantId },
            select: { name: true },
          });
          const refillLiters = order.tank?.capacity === 'L500' ? 500 : 350;
          await this.email.sendReceipt(recipientEmail, {
            customerName: order.customer.fullName,
            orderId: order.id,
            refillLiters,
            refillPriceIqd: input.paidAmountIqd,
            tenantName: tenant?.name ?? 'داري',
            completedAt: result.completedAt,
          });
        } catch (err) {
          this.log.warn(
            `Email receipt failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      } else {
        // Customer has no email — silently skip. Logged at debug only so
        // production logs aren't flooded.
        this.log.debug(`No email on customer ${order.customer.id} — skipping receipt`);
      }
    }

    return result;
  }

  async cancel(orderId: string, reason: string) {
    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: {
        status: RefillOrderStatus.CANCELLED,
        cancelReason: reason,
      },
    });
  }

  /**
   * Walk-in sale recorded by a driver in the field — e.g. the neighbour
   * who flagged them down. No tank, no customer account, just a cash
   * transaction stored for accounting. GPS + photo are required as proof.
   */
  async recordWalkinSale(
    tenantId: string,
    driverId: string,
    input: {
      liters: number;
      priceIqd: number;
      paidAmountIqd: number;
      buyerName?: string;
      buyerPhone?: string;
      completionLng: number;
      completionLat: number;
      proofPhotoUrl: string;
    },
  ) {
    if (!input.proofPhotoUrl) {
      throw new BadRequestException('Photo proof is required for walk-in sales');
    }
    return this.prisma.refillOrder.create({
      data: {
        tenantId,
        driverId,
        kind: RefillOrderKind.WALKIN_SALE,
        status: RefillOrderStatus.COMPLETED,
        priceIqd: input.priceIqd,
        paidAmountIqd: input.paidAmountIqd,
        paymentMethod: 'CASH',
        paidAt: new Date(),
        completedAt: new Date(),
        completionLng: input.completionLng,
        completionLat: input.completionLat,
        gpsVerified: true,
        proofPhotoUrl: input.proofPhotoUrl,
        walkinBuyerName: input.buyerName,
        walkinBuyerPhone: input.buyerPhone,
        walkinLiters: input.liters,
      },
    });
  }

  /**
   * Customer-side confirmation. Triggered when the customer taps the
   * WhatsApp button (or the in-app card) after a refill is marked complete.
   * The plant sees an unconfirmed-refill list on the dashboard to chase.
   */
  async confirmRefill(orderId: string, customerUserId: string) {
    const order = await this.prisma.refillOrder.findFirst({
      where: { id: orderId },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.customer || order.customer.userId !== customerUserId) {
      throw new BadRequestException('This refill belongs to a different customer');
    }
    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: { customerConfirmedAt: new Date() },
    });
  }

  async disputeRefill(orderId: string, customerUserId: string, reason: string) {
    const order = await this.prisma.refillOrder.findFirst({
      where: { id: orderId },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.customer || order.customer.userId !== customerUserId) {
      throw new BadRequestException('This refill belongs to a different customer');
    }
    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: {
        customerDisputedAt: new Date(),
        disputeReason: reason,
      },
    });
  }

  /**
   * Driver app fetches today's task list — assigned + en-route orders, ordered
   * by scheduled time (or by customer location nearest-first if no schedule).
   */
  myTasksToday(driverId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return this.prisma.refillOrder.findMany({
      where: {
        driverId,
        status: { in: [RefillOrderStatus.ASSIGNED, RefillOrderStatus.EN_ROUTE] },
        OR: [
          { scheduledFor: { gte: start, lt: end } },
          { scheduledFor: null, requestedAt: { gte: start, lt: end } },
        ],
      },
      include: {
        customer: true,
        tank: true,
      },
      orderBy: [{ scheduledFor: 'asc' }, { requestedAt: 'asc' }],
    });
  }

  /**
   * Customer's own order history. Used by mobile-customer to render
   * "نشاطك الأخير" and the full orders tab.
   */
  listByCustomerUser(userId: string, limit = 50) {
    return this.prisma.refillOrder.findMany({
      where: { customer: { userId } },
      include: {
        driver: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Driver's full task history (not just today). Used by mobile-worker's
   * History tab. Includes completed + cancelled orders.
   */
  listMyHistory(driverId: string, limit = 100) {
    return this.prisma.refillOrder.findMany({
      where: { driverId },
      include: { customer: true, tank: true },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Walk-in sale — a driver sells water to someone who is NOT in the system
   * (or a registered customer paying for a one-off out-of-cycle refill).
   * Creates a WALKIN_SALE order pre-completed in one step.
   */
  async createWalkinRefill(
    tenantId: string,
    driverId: string,
    input: {
      customerId?: string;
      walkinBuyerName?: string;
      walkinBuyerPhone?: string;
      walkinLiters?: number;
      paymentMethod: PaymentMethod;
      paidAmountIqd: number;
      proofPhotoUrl: string;
      completionLng?: number;
      completionLat?: number;
    },
  ) {
    return this.prisma.refillOrder.create({
      data: {
        tenantId,
        driverId,
        customerId: input.customerId ?? null,
        kind: 'WALKIN_SALE',
        status: RefillOrderStatus.COMPLETED,
        priceIqd: input.paidAmountIqd,
        paidAmountIqd: input.paidAmountIqd,
        paymentMethod: input.paymentMethod,
        proofPhotoUrl: input.proofPhotoUrl,
        completionLng: input.completionLng,
        completionLat: input.completionLat,
        walkinBuyerName: input.walkinBuyerName,
        walkinBuyerPhone: input.walkinBuyerPhone,
        walkinLiters: input.walkinLiters,
        requestedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
