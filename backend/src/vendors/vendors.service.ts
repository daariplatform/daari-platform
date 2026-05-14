import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeliveryOrderStatus,
  PaymentMethod,
  VehicleType,
  VendorStatus,
  WalletEntryKind,
} from '@prisma/client';

interface RegisterVendorInput {
  userId: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  maxCapacityLiters?: number;
}

interface CreateDeliveryOrderInput {
  customerId: string;
  liters: number;
  dropLng: number;
  dropLat: number;
  dropAddress: string;
  paymentMethod?: PaymentMethod;
}

const COMMISSION_RATE = 0.08; // 8% platform cut
const PRICE_PER_LITER_IQD = 250; // ~tunable per market study

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  register(input: RegisterVendorInput) {
    return this.prisma.vendor.create({
      data: {
        userId: input.userId,
        vehicleType: input.vehicleType,
        vehiclePlate: input.vehiclePlate,
        maxCapacityLiters: input.maxCapacityLiters ?? 25,
        status: VendorStatus.PENDING_APPROVAL,
      },
    });
  }

  async approve(vendorId: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.ACTIVE },
    });
  }

  async setAvailability(userId: string, isAvailable: boolean, lng?: number, lat?: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new NotFoundException('Vendor profile not found');
    return this.prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        isAvailable,
        ...(lng !== undefined && { currentLng: lng }),
        ...(lat !== undefined && { currentLat: lat }),
        ...(lng !== undefined && lat !== undefined && { lastLocationAt: new Date() }),
      },
    });
  }

  /**
   * Customer creates a delivery order (5–25 L). The order enters SEARCHING.
   * The matching engine (separate worker) finds the closest available vendor.
   */
  async createDeliveryOrder(input: CreateDeliveryOrderInput) {
    if (input.liters < 5 || input.liters > 25) {
      throw new BadRequestException('Liters must be between 5 and 25');
    }
    const priceIqd = input.liters * PRICE_PER_LITER_IQD;
    const commissionIqd = Math.round(priceIqd * COMMISSION_RATE);

    return this.prisma.deliveryOrder.create({
      data: {
        customerId: input.customerId,
        liters: input.liters,
        priceIqd,
        commissionIqd,
        dropLng: input.dropLng,
        dropLat: input.dropLat,
        dropAddress: input.dropAddress,
        paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
      },
    });
  }

  /**
   * Naive matching using Haversine. For production, use PostGIS ST_DWithin
   * + ST_Distance against an indexed geography column.
   */
  async findCandidatesForOrder(orderId: string, radiusKm = 5) {
    const order = await this.prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const candidates = await this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.ACTIVE,
        isAvailable: true,
        maxCapacityLiters: { gte: order.liters },
        currentLat: { not: null },
        currentLng: { not: null },
      },
      take: 50,
    });

    const withDistance = candidates
      .map((v) => ({
        vendor: v,
        distanceKm: haversineKm(v.currentLat!, v.currentLng!, order.dropLat, order.dropLng),
      }))
      .filter((c) => c.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

    return { order, candidates: withDistance };
  }

  async acceptOrder(vendorUserId: string, orderId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.deliveryOrder.update({
      where: { id: orderId, status: DeliveryOrderStatus.SEARCHING },
      data: {
        status: DeliveryOrderStatus.ACCEPTED,
        vendorId: vendor.id,
        acceptedAt: new Date(),
      },
    });
  }

  async markDelivered(vendorUserId: string, orderId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.deliveryOrder.update({
        where: { id: orderId, vendorId: vendor.id },
        data: { status: DeliveryOrderStatus.DELIVERED, deliveredAt: new Date() },
      });

      const earning = order.priceIqd - order.commissionIqd;

      await tx.vendorWalletEntry.create({
        data: {
          vendorId: vendor.id,
          kind: WalletEntryKind.EARNING,
          amountIqd: earning,
          reference: order.id,
          note: `Delivery ${order.liters}L`,
        },
      });
      await tx.vendorWalletEntry.create({
        data: {
          vendorId: vendor.id,
          kind: WalletEntryKind.COMMISSION,
          amountIqd: -order.commissionIqd,
          reference: order.id,
          note: 'Platform commission',
        },
      });
      await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          walletBalanceIqd: { increment: earning - order.commissionIqd },
          totalDeliveries: { increment: 1 },
        },
      });

      return order;
    });
  }

  async wallet(vendorUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
      include: {
        walletEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return {
      balanceIqd: vendor.walletBalanceIqd,
      totalDeliveries: vendor.totalDeliveries,
      rating: vendor.rating,
      entries: vendor.walletEntries,
    };
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
