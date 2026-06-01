import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateAddressInput {
  label: string;
  addressLine: string;
  district: string;
  lng?: number;
  lat?: number;
  isDefault?: boolean;
}

interface UpdateAddressInput {
  label?: string;
  addressLine?: string;
  district?: string;
  lng?: number;
  lat?: number;
  isDefault?: boolean;
}

@Injectable()
export class CustomerAddressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolve the Customer row for the logged-in user. Every address operation
   * is scoped through here so a customer can only ever touch their own
   * addresses — no addressId leak across accounts is possible.
   */
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
    return this.prisma.customerAddress.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, input: CreateAddressInput) {
    const customer = await this.resolveCustomer(userId);

    // If this address is being created as the default, unset any other
    // default in the same transaction so there's never two defaults.
    if (input.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id, isDefault: true },
          data: { isDefault: false },
        });
        return tx.customerAddress.create({
          data: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            label: input.label,
            addressLine: input.addressLine,
            district: input.district,
            lng: input.lng,
            lat: input.lat,
            isDefault: true,
          },
        });
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        label: input.label,
        addressLine: input.addressLine,
        district: input.district,
        lng: input.lng,
        lat: input.lat,
        isDefault: false,
      },
    });
  }

  async update(userId: string, addressId: string, input: UpdateAddressInput) {
    const customer = await this.resolveCustomer(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: customer.id },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const data: {
      label?: string;
      addressLine?: string;
      district?: string;
      lng?: number;
      lat?: number;
      isDefault?: boolean;
    } = {};
    if (input.label !== undefined) data.label = input.label;
    if (input.addressLine !== undefined) data.addressLine = input.addressLine;
    if (input.district !== undefined) data.district = input.district;
    if (input.lng !== undefined) data.lng = input.lng;
    if (input.lat !== undefined) data.lat = input.lat;

    // Flipping isDefault on must unset the others, in a transaction.
    if (input.isDefault === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
        return tx.customerAddress.update({
          where: { id: addressId },
          data: { ...data, isDefault: true },
        });
      });
    }
    if (input.isDefault === false) data.isDefault = false;

    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data,
    });
  }

  async remove(userId: string, addressId: string) {
    const customer = await this.resolveCustomer(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Address not found');
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    return { ok: true };
  }

  async makeDefault(userId: string, addressId: string) {
    const customer = await this.resolveCustomer(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId: customer.id, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
      return tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}
