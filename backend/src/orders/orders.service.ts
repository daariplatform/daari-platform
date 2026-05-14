import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerStatus,
  PaymentMethod,
  RefillOrderKind,
  RefillOrderStatus,
  TankStatus,
} from '@prisma/client';

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
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateOrderInput) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, tenantId },
      include: { tanks: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const tankId = input.tankId ?? customer.tanks[0]?.id;
    if ((input.kind ?? RefillOrderKind.REFILL) === RefillOrderKind.REFILL && !tankId) {
      throw new BadRequestException('Customer has no tank assigned for a refill');
    }

    return this.prisma.refillOrder.create({
      data: {
        tenantId,
        customerId: input.customerId,
        tankId,
        kind: input.kind ?? RefillOrderKind.REFILL,
        priceIqd: input.priceIqd ?? 1000,
        scheduledFor: input.scheduledFor,
      },
    });
  }

  list(tenantId: string, status?: RefillOrderStatus, driverId?: string) {
    return this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        ...(status && { status }),
        ...(driverId && { driverId }),
      },
      include: {
        customer: { select: { fullName: true, phone: true, district: true, locationLat: true, locationLng: true } },
        driver: { select: { id: true, user: { select: { fullName: true } } } },
        tank: { select: { qrCode: true, capacity: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
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
    });
    if (!order) throw new NotFoundException('Order not found or not assigned to you');
    if (order.status !== RefillOrderStatus.ASSIGNED) {
      throw new BadRequestException(`Order is ${order.status}`);
    }
    return this.prisma.refillOrder.update({
      where: { id: orderId },
      data: { status: RefillOrderStatus.EN_ROUTE, startedAt: new Date() },
    });
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

    return this.prisma.$transaction(async (tx) => {
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

      return completed;
    });
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
    if (order.customer.userId !== customerUserId) {
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
    if (order.customer.userId !== customerUserId) {
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
