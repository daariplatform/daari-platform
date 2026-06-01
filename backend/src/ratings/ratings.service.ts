import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefillOrderStatus } from '@prisma/client';

interface RateOrderInput {
  stars: number;
  comment?: string;
}

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Customer rates a COMPLETED order they own. One rating per order — if the
   * customer rates again we upsert (update the existing row). The driverId is
   * copied from the order so the driver's average score can be computed
   * without a join back to the order.
   *
   * Ownership is enforced by matching the order's customer.userId against the
   * calling user's id, so a customer can never rate someone else's order.
   */
  async rateOrder(userId: string, orderId: string, input: RateOrderInput) {
    const order = await this.prisma.refillOrder.findFirst({
      where: { id: orderId },
      include: { customer: { select: { id: true, userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.customer || order.customer.userId !== userId) {
      throw new ForbiddenException('هذا الطلب لا يخصّك');
    }
    if (order.status !== RefillOrderStatus.COMPLETED) {
      throw new BadRequestException('يمكن تقييم الطلبات المكتملة فقط');
    }

    return this.prisma.rating.upsert({
      where: { orderId },
      create: {
        tenantId: order.tenantId,
        orderId,
        customerId: order.customer.id,
        driverId: order.driverId ?? null,
        stars: input.stars,
        comment: input.comment,
      },
      update: {
        stars: input.stars,
        comment: input.comment,
        // Keep driverId in sync in case it changed since first rating.
        driverId: order.driverId ?? null,
      },
    });
  }

  /**
   * Recent ratings for a driver — used by the dashboard driver-detail page.
   * Tenant-scoped so an admin can only see ratings for drivers in their plant.
   */
  async recentForDriver(tenantId: string, driverId: string, limit = 20) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const ratings = await this.prisma.rating.findMany({
      where: { driverId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        stars: true,
        comment: true,
        createdAt: true,
        customer: { select: { fullName: true } },
      },
    });
    return ratings.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: r.customer?.fullName ?? null,
    }));
  }
}
