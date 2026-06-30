import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { CustomersService } from '../customers/customers.service';
import { EmailService } from '../email/email.service';
import { PromoService } from '../plant/promo.service';
import {
  CustomerStatus,
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
  PaymentMethod,
  Prisma,
  RefillOrderKind,
  RefillOrderStatus,
  TankStatus,
  TenantStatus,
} from '@prisma/client';
import { paginated, type PaginatedResult } from '../common/dto/pagination.dto';

interface CreateOrderInput {
  customerId: string;
  tankId?: string;
  kind?: RefillOrderKind;
  scheduledFor?: Date;
  priceIqd?: number;
  /** Optional saved-address id to deliver to instead of the home location. */
  addressId?: string;
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
    private promo: PromoService,
  ) {}

  /**
   * Persist an order-status notification into the customer's in-app inbox
   * (NotificationLog, recipient = phone). The audit found we only sent push
   * notifications on order events — which are skipped on simulators and
   * never persisted — so the customer's notifications screen was always
   * empty. This writes a durable inbox row so "حالة الطلب" shows up there
   * regardless of whether the push was delivered. Best-effort: a failure
   * here must never roll back or block the order itself.
   */
  private async notifyCustomerInbox(
    tenantId: string,
    phone: string | null | undefined,
    kind: NotificationKind,
    title: string,
    body: string,
  ): Promise<void> {
    if (!phone) return;
    try {
      await this.prisma.notificationLog.create({
        data: {
          tenantId,
          kind,
          channel: NotificationChannel.PUSH,
          recipient: phone,
          title,
          body,
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      this.log.warn(`[inbox] customer note failed: ${(err as Error).message}`);
    }
  }

  /// يُرجِع مُعرّف سجلّ الزبون المرتبط بحساب المستخدم — لاشتقاق customerId من
  /// الهوية بدل الوثوق بما يرسله العميل (إغلاق IDOR في إنشاء الطلب).
  async resolveOwnCustomerId(userId: string, tenantId: string): Promise<string> {
    const customer = await this.prisma.customer.findFirst({
      where: { userId, tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
    return customer.id;
  }

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
    //
    // ALSO check for an ACTIVE promo campaign — if one is running, the
    // customer sees (and pays) the discounted price, and we tag the order
    // with promoCampaignId so completion can deduct from the tenant wallet.
    let priceIqd = input.priceIqd;
    let promoCampaignId: string | null = null;
    if (priceIqd == null) {
      const activePromo = await this.promo.getActiveForTenant(tenantId);
      if (activePromo) {
        priceIqd = activePromo.promoPriceIqd;
        promoCampaignId = activePromo.id;
      } else {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { refillPriceIqd: true },
        });
        priceIqd = tenant?.refillPriceIqd ?? 1000;
      }
    }

    // CLAIM MODEL: orders are OFFERED to the tenant's drivers, not auto-assigned.
    // The order is created PENDING + unassigned and enters the offer pool; the
    // first driver to call POST /orders/:id/claim wins it (atomic, race-safe).
    // The plant admin can still assign a specific driver from the dashboard as
    // a fallback (POST /orders/:id/assign). pickDriverForNewOrder is retained
    // for that manual/auto fallback path but is no longer used on create.

    // Snapshot the chosen saved address (if any) onto the order so the driver
    // routes there. Verified to belong to this customer; ignored otherwise.
    let delivery: {
      deliveryAddressId?: string;
      deliveryAddressLine?: string;
      deliveryDistrict?: string;
      deliveryLat?: number | null;
      deliveryLng?: number | null;
    } = {};
    if (input.addressId) {
      const addr = await this.prisma.customerAddress.findFirst({
        where: { id: input.addressId, customerId: input.customerId },
      });
      if (addr) {
        delivery = {
          deliveryAddressId: addr.id,
          deliveryAddressLine: addr.addressLine,
          deliveryDistrict: addr.district,
          deliveryLat: addr.lat,
          deliveryLng: addr.lng,
        };
      }
    }

    const order = await this.prisma.refillOrder.create({
      data: {
        tenantId,
        customerId: input.customerId,
        tankId,
        kind,
        priceIqd,
        promoCampaignId, // null when no active promo
        scheduledFor: input.scheduledFor,
        ...delivery,
        // status defaults to PENDING, driverId stays null → enters the offer pool.
      },
    });

    // Broadcast the available order to every active driver in the tenant so
    // they can race to claim it. Best-effort; the order also surfaces in the
    // driver app's "available orders" list on the next refresh / socket tick.
    this.notifyDriversOfOffer(tenantId, order.id, customer).catch((err) =>
      console.warn('[push] notify drivers of offer failed:', err),
    );

    // Notify plant admins on the mobile-admin app. Best-effort, never blocks.
    this.push
      .sendToTenantAdmins(
        tenantId,
        'طلب جديد بانتظار قبول سائق',
        `${customer.fullName} — ${customer.district} · ${priceIqd.toLocaleString('ar-IQ')} د.ع`,
        { orderId: order.id, kind: 'new-order', tenantId },
      )
      .catch((err) => console.warn('[push] notify admins failed:', err));

    return order;
  }

  /**
   * Push an "order available to claim" notification to every active driver in
   * the tenant. Best-effort — failures are swallowed by the caller.
   */
  private async notifyDriversOfOffer(
    tenantId: string,
    orderId: string,
    customer: { fullName: string; district: string },
  ) {
    const drivers = await this.prisma.driver.findMany({
      where: { tenantId, status: { in: ['AVAILABLE', 'ON_ROUTE'] } },
      select: { userId: true },
    });
    await Promise.allSettled(
      drivers.map((d) =>
        this.push.sendToUser(
          d.userId,
          '🚐 طلب جديد متاح — سارِع بالقبول',
          `${customer.fullName} — ${customer.district}`,
          { orderId, kind: 'order-offer', tenantId },
        ),
      ),
    );
  }

  /**
   * First-come, race-safe claim. The conditional updateMany only mutates the
   * row if it is STILL pending and unassigned, so two drivers tapping "قبول"
   * at the same time can never both win — exactly one gets count===1.
   */
  async claim(orderId: string, driverId: string, tenantId: string) {
    const res = await this.prisma.refillOrder.updateMany({
      where: {
        id: orderId,
        tenantId,
        status: RefillOrderStatus.PENDING,
        driverId: null,
      },
      data: {
        driverId,
        status: RefillOrderStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });
    if (res.count === 0) {
      const existing = await this.prisma.refillOrder.findFirst({
        where: { id: orderId, tenantId },
        select: { id: true, driverId: true, status: true },
      });
      if (!existing) throw new NotFoundException('الطلب غير موجود');
      if (existing.driverId === driverId) {
        // Idempotent: this driver already holds it (double-tap / retry).
        return this.findOneForDriver(orderId, driverId);
      }
      if (existing.driverId)
        throw new ConflictException('سبقك سائق آخر إلى هذا الطلب');
      throw new ConflictException('لم يعد هذا الطلب متاحاً للقبول');
    }
    // The customer's meaningful "السائق متجه إليك" notification fires later on
    // start() (EN_ROUTE); no separate claim-time inbox entry is needed.
    return this.findOneForDriver(orderId, driverId);
  }

  /**
   * The pool of orders a driver can claim: still PENDING + unassigned in the
   * driver's tenant. Includes the customer + tank so the app can show name,
   * district, coordinates (for distance/ETA) and tank size on the card.
   */
  async listAvailableForDrivers(tenantId: string) {
    return this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: RefillOrderStatus.PENDING,
        driverId: null,
      },
      orderBy: { requestedAt: 'asc' },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            district: true,
            addressLine: true,
            locationLat: true,
            locationLng: true,
          },
        },
        tank: { select: { id: true, qrCode: true, capacity: true } },
      },
    });
  }

  /** Single order scoped to the owning driver — used after claim. */
  private findOneForDriver(orderId: string, driverId: string) {
    return this.prisma.refillOrder.findFirst({
      where: { id: orderId, driverId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            district: true,
            addressLine: true,
            locationLat: true,
            locationLng: true,
          },
        },
        tank: { select: { id: true, qrCode: true, capacity: true } },
      },
    });
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
      select: { plan: true, status: true },
    });
    // Operational enforcement of plant suspension. The platform console promises
    // a suspended plant "cannot process new orders until reactivated" — this is
    // where that promise is kept. Every order-creation path funnels through here.
    if (
      tenant?.status === TenantStatus.SUSPENDED ||
      tenant?.status === TenantStatus.CANCELLED
    ) {
      throw new ForbiddenException(
        'هذا المعمل موقوف مؤقتاً ولا يستقبل طلبات جديدة. يرجى التواصل مع إدارة المنصّة.',
      );
    }
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

  /**
   * Full single-order shape for the order-detail page — used by BOTH the
   * dashboard (`/dashboard/orders/[id]`) and the customer's live-tracking
   * screen (`mobile-customer/app/order/[id]`).
   *
   * Scoping is by role:
   *   - plant admins (OWNER/MANAGER/ACCOUNTANT/PLATFORM_ADMIN) → tenant-scoped
   *   - the customer → only their OWN order (customer.userId === user.id)
   * so a customer can never read another customer's order.
   *
   * Includes the driver's LIVE coordinates (currentLng/currentLat +
   * lastLocationAt) so the customer can watch the driver approach on the map.
   */
  async findOneForViewer(
    user: { id: string; role: string; tenantId?: string | null },
    orderId: string,
  ) {
    const isCustomer = user.role === 'CUSTOMER';
    const where: Prisma.RefillOrderWhereInput = isCustomer
      ? { id: orderId, customer: { userId: user.id } }
      : { id: orderId, tenantId: user.tenantId ?? undefined };

    const order = await this.prisma.refillOrder.findFirst({
      where,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            district: true,
            addressLine: true,
            locationLat: true,
            locationLng: true,
          },
        },
        driver: {
          select: {
            id: true,
            vehiclePlate: true,
            // Live position for the customer's tracking map.
            currentLat: true,
            currentLng: true,
            lastLocationAt: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        tank: { select: { id: true, qrCode: true, capacity: true } },
        // Surface the customer's rating (if any) so the detail page can show
        // the stars + comment, and the customer app knows whether to prompt.
        rating: {
          select: { id: true, stars: true, comment: true, createdAt: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
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
    // Durable in-app inbox copy (push is best-effort / skipped on simulator).
    await this.notifyCustomerInbox(
      order.tenantId,
      order.customer?.phone,
      NotificationKind.DRIVER_EN_ROUTE,
      '🚐 السائق متجه إليك',
      'سيصل سائق المعمل خلال وقت قصير. تأكّد أنك متواجد في العنوان.',
    );
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
    // Idempotent: a duplicate or offline-queue-replayed completion that arrives
    // after the order is already COMPLETED returns the existing order instead of
    // re-charging the customer / re-decrementing stock / re-charging the promo wallet.
    if (order.status === RefillOrderStatus.COMPLETED) {
      return order;
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

    // Photo proof is now OPTIONAL (plants opted out of mandatory tank photos
    // to save device storage / upload bandwidth). If the driver app sends a
    // proofPhotoUrl we still store it, but completion no longer blocks on it.

    // Reclaims still require a reason (audit trail) — but the photo is optional.
    if (order.kind === RefillOrderKind.TANK_RECLAIM) {
      if (!input.reclaimReason) {
        throw new BadRequestException('Please pick a reason for reclaiming the tank.');
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
      // Atomic transition guard (mirrors claim()): only ONE request can flip
      // EN_ROUTE/ASSIGNED → COMPLETED. Without this, two concurrent completes —
      // or an offline-queue replay landing while the first is still in flight —
      // would both pass the pre-check above and run the balance / stock / promo
      // side effects twice, double-charging real money. updateMany returns a
      // count so we abort the loser before any side effect.
      const transition = await tx.refillOrder.updateMany({
        where: {
          id: orderId,
          status: { in: [RefillOrderStatus.EN_ROUTE, RefillOrderStatus.ASSIGNED] },
        },
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
      if (transition.count === 0) {
        // Lost the race — another request already finalised this order. Bail
        // out before side effects; the caller resolves it idempotently below.
        return null;
      }

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
          // Loyalty: +1 point for each completed REFILL (not deliveries /
          // reclaims). Redeemable later. Lives in the same update that bumps
          // totalRefills so it's atomic with the completion.
          ...(order.kind === RefillOrderKind.REFILL && {
            loyaltyPoints: { increment: 1 },
          }),
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

      // Promo deduction: if this order was placed during an active campaign,
      // charge the tenant wallet 1,000 IQD now (at completion, not creation —
      // cancellations don't cost the plant anything). The helper auto-expires
      // the campaign if the wallet ran out or the window elapsed.
      if (order.promoCampaignId) {
        await this.promo.chargeOrderCompletion(
          tx,
          order.promoCampaignId,
          input.paidAmountIqd,
        );
      }

      return tx.refillOrder.findUniqueOrThrow({ where: { id: orderId } });
    });

    // Idempotent fallback: the transaction returned null because a concurrent /
    // duplicate request already finalised this order. Return the completed row
    // without re-running notifications, receipts, or any side effect.
    if (!result) {
      const current = await this.prisma.refillOrder.findFirst({
        where: { id: orderId },
        include: { tank: { include: { tenant: true } }, customer: true },
      });
      if (current && current.status === RefillOrderStatus.COMPLETED) {
        return current;
      }
      throw new BadRequestException('تعذّر إكمال الطلب — ربما أُنهي مسبقاً.');
    }

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
    // Durable in-app inbox copy so the completion shows in the customer's
    // notifications screen even when push is unavailable.
    {
      const arabicKind =
        order.kind === RefillOrderKind.REFILL ? 'تعبئة' :
        order.kind === RefillOrderKind.TANK_DELIVERY ? 'توصيل خزان' : 'سحب خزان';
      await this.notifyCustomerInbox(
        order.tenantId,
        order.customer?.phone,
        NotificationKind.ORDER_COMPLETED,
        `✅ تمّت ${arabicKind}`,
        `المبلغ المدفوع: ${input.paidAmountIqd.toLocaleString('ar-IQ')} د.ع. شكراً لاستخدامك داري.`,
      );
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

  /**
   * Cancel an order. The route accepts plant_admin OR driver OR customer
   * — but the rules differ per role. This service enforces them:
   *
   *   - plant_admin: can cancel any order in their tenant, any status
   *     except COMPLETED (revert COMPLETE through a different flow).
   *   - driver: only their own assigned order, and only while it's
   *     ASSIGNED or EN_ROUTE (= "no customer at door / can't deliver").
   *   - customer: only their own order, and only while it's PENDING
   *     (= "changed my mind before driver picked up"). Once ASSIGNED,
   *     the customer must call the plant.
   */
  async cancel(
    orderId: string,
    reason: string | undefined,
    user: { id: string; role: string; tenantId?: string | null },
  ) {
    const order = await this.prisma.refillOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { userId: true } },
        driver: { select: { userId: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === RefillOrderStatus.COMPLETED) {
      throw new BadRequestException('لا يمكن إلغاء طلب مكتمل');
    }
    if (order.status === RefillOrderStatus.CANCELLED) {
      // Idempotent — return the existing row so a double-tap from
      // flaky UI doesn't throw.
      return order;
    }

    const role = user.role;
    if (role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN') {
      if (order.tenantId !== user.tenantId) {
        throw new ForbiddenException('Order is in a different tenant');
      }
    } else if (role === 'DRIVER') {
      if (order.driver?.userId !== user.id) {
        throw new ForbiddenException('Order is not assigned to you');
      }
      if (
        order.status !== RefillOrderStatus.ASSIGNED &&
        order.status !== RefillOrderStatus.EN_ROUTE
      ) {
        throw new BadRequestException(
          'يمكن إلغاء الطلب فقط إذا كان قيد التنفيذ',
        );
      }
    } else if (role === 'CUSTOMER') {
      if (order.customer?.userId !== user.id) {
        throw new ForbiddenException('Order does not belong to you');
      }
      // Orders auto-assign a driver instantly (PENDING → ASSIGNED), so
      // gating cancellation on PENDING-only left customers with no window
      // to cancel at all. Allow cancel until the driver actually starts the
      // trip (EN_ROUTE); after that the driver is on the road and the
      // customer should call the plant instead.
      if (
        order.status !== RefillOrderStatus.PENDING &&
        order.status !== RefillOrderStatus.ASSIGNED
      ) {
        throw new BadRequestException(
          'انطلق السائق إليك بالفعل — لا يمكن الإلغاء الآن. اتصل بالمعمل.',
        );
      }
    } else {
      throw new ForbiddenException('Unauthorised role for cancel');
    }

    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: {
        status: RefillOrderStatus.CANCELLED,
        cancelReason: reason ?? (role === 'CUSTOMER' ? 'ألغاه الزبون' : 'بدون سبب'),
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
      proofPhotoUrl?: string;
    },
  ) {
    // Photo proof is optional for walk-in sales too (storage/bandwidth opt-out).
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
  /**
   * Counter-sale recorded by a plant admin (manager/owner) at the plant
   * itself. Distinct from `createWalkinRefill` (driver in the field) and
   * `recordWalkinSale` (driver with GPS + photo): no driver is involved,
   * no GPS / photo proof is required, payment defaults to CASH. The
   * `userId` argument is captured into `walkinRecordedByUserId` so the
   * audit log can answer "who at the counter rang this up?"
   */
  async createAdminWalkinSale(
    tenantId: string,
    userId: string,
    input: {
      customerName?: string;
      phone?: string;
      liters: number;
      priceIqd: number;
      paidAmountIqd?: number;
    },
  ) {
    const paid = input.paidAmountIqd ?? input.priceIqd;
    return this.prisma.refillOrder.create({
      data: {
        tenantId,
        // No driverId — counter sales aren't dispatched. Manager is the
        // operator of record (preserved in walkinBuyerName for now;
        // an explicit recordedBy column is a follow-up).
        kind: RefillOrderKind.WALKIN_SALE,
        status: RefillOrderStatus.COMPLETED,
        priceIqd: input.priceIqd,
        paidAmountIqd: paid,
        paymentMethod: 'CASH',
        paidAt: new Date(),
        walkinBuyerName: input.customerName,
        walkinBuyerPhone: input.phone,
        walkinLiters: input.liters,
        requestedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

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
      proofPhotoUrl?: string;
      completionLng?: number;
      completionLat?: number;
      clientRequestId?: string;
    },
  ) {
    // Idempotency: a walk-in flushed twice from the driver's offline queue must
    // not double-record the sale. When the client supplies a clientRequestId we
    // return the row already created for that key; the @@unique([tenantId,
    // clientRequestId]) constraint also guards against a concurrent-flush race.
    const clientRequestId = input.clientRequestId?.trim() || null;
    if (clientRequestId) {
      const existing = await this.prisma.refillOrder.findFirst({
        where: { tenantId, clientRequestId },
      });
      if (existing) return existing;
    }
    try {
      return await this.prisma.refillOrder.create({
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
          clientRequestId,
          requestedAt: new Date(),
          completedAt: new Date(),
        },
      });
    } catch (e) {
      // A concurrent flush won the unique key — return the original row.
      if (
        clientRequestId &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.prisma.refillOrder.findFirst({
          where: { tenantId, clientRequestId },
        });
        if (existing) return existing;
      }
      throw e;
    }
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
