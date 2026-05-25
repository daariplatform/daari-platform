/**
 * Deterministic fixture builder. Each suite calls seedTwoTenants() right
 * after truncateAll() so we start from a known shape every time.
 *
 * Why we don't reuse prisma/seed.ts:
 *   - the seed is for dev convenience (one tenant, one driver) — tests
 *     need TWO tenants to exercise cross-tenant isolation.
 *   - the seed isn't isolated; running it inside a Jest worker would
 *     drag in console.log noise and `process.exit` patterns.
 */
import * as argon2 from 'argon2';
import {
  PrismaClient,
  TankCapacity,
  UserRole,
  CustomerStatus,
  DriverStatus,
  SubscriptionPlan,
  TenantStatus,
} from '@prisma/client';

export interface SeededTenant {
  tenantId: string;
  ownerUserId: string;
  ownerPhone: string;
  ownerPassword: string;
  customerId: string;
  customerUserId: string;
  customerPhone: string;
  customerPassword: string;
  driverId: string;
  driverUserId: string;
  driverPhone: string;
  driverPassword: string;
  tankId: string;
}

export interface TwoTenants {
  t1: SeededTenant;
  t2: SeededTenant;
}

const PASSWORD = 'pass1234';

async function seedOneTenant(
  prisma: PrismaClient,
  tag: 'T1' | 'T2',
  passwordHash: string,
): Promise<SeededTenant> {
  const ownerPhone = tag === 'T1' ? '07700000101' : '07700000201';
  const driverPhone = tag === 'T1' ? '07700000102' : '07700000202';
  const customerPhone = tag === 'T1' ? '07700000103' : '07700000203';

  const tenant = await prisma.tenant.create({
    data: {
      name: `Plant ${tag}`,
      ownerName: `Owner ${tag}`,
      ownerPhone,
      city: 'Baghdad',
      plan: SubscriptionPlan.PRO,
      status: TenantStatus.ACTIVE,
      refillBonusIqd: 50,
      refillPriceIqd: 1000,
    },
  });

  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      phone: ownerPhone,
      passwordHash,
      fullName: `Owner ${tag}`,
      role: UserRole.OWNER,
    },
  });

  const driverUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      phone: driverPhone,
      passwordHash,
      fullName: `Driver ${tag}`,
      role: UserRole.DRIVER,
    },
  });

  const driver = await prisma.driver.create({
    data: {
      tenantId: tenant.id,
      userId: driverUser.id,
      status: DriverStatus.AVAILABLE,
      baseSalaryIqd: 0,
      commissionPerRefillIqd: 0,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      phone: customerPhone,
      passwordHash,
      fullName: `Customer ${tag}`,
      role: UserRole.CUSTOMER,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      userId: customerUser.id,
      fullName: `Customer ${tag}`,
      phone: customerPhone,
      whatsapp: customerPhone,
      district: tag === 'T1' ? 'Karrada' : 'Mansour',
      addressLine: `${tag} Address`,
      // Coords placed inside the geofence so a refill completion at this
      // exact lat/lng will pass the 50 m check.
      locationLng: tag === 'T1' ? 44.4156 : 44.3000,
      locationLat: tag === 'T1' ? 33.3033 : 33.3500,
      status: CustomerStatus.ACTIVE,
    },
  });

  const tank = await prisma.tank.create({
    data: {
      tenantId: tenant.id,
      serialNumber: `${tag}-TANK-001`,
      qrCode: `${tag}-QR-001`,
      capacity: TankCapacity.L500,
      customerId: customer.id,
    },
  });

  return {
    tenantId: tenant.id,
    ownerUserId: owner.id,
    ownerPhone,
    ownerPassword: PASSWORD,
    customerId: customer.id,
    customerUserId: customerUser.id,
    customerPhone,
    customerPassword: PASSWORD,
    driverId: driver.id,
    driverUserId: driverUser.id,
    driverPhone,
    driverPassword: PASSWORD,
    tankId: tank.id,
  };
}

export async function seedTwoTenants(prisma: PrismaClient): Promise<TwoTenants> {
  const passwordHash = await argon2.hash(PASSWORD);
  const t1 = await seedOneTenant(prisma, 'T1', passwordHash);
  const t2 = await seedOneTenant(prisma, 'T2', passwordHash);
  return { t1, t2 };
}

/**
 * Bulk-seed N customers in a single tenant so pagination tests can verify
 * page cuts. Phone numbers are deterministic (07700001000 + i) so two
 * runs in the same suite don't collide.
 */
export async function seedManyCustomers(
  prisma: PrismaClient,
  tenantId: string,
  count: number,
): Promise<void> {
  const rows = Array.from({ length: count }, (_, i) => ({
    tenantId,
    fullName: `Bulk Customer ${String(i).padStart(3, '0')}`,
    phone: `077${String(10_000_000 + i).padStart(8, '0')}`,
    whatsapp: `077${String(10_000_000 + i).padStart(8, '0')}`,
    district: 'Karrada',
    addressLine: `Street ${i}`,
    status: CustomerStatus.ACTIVE,
  }));
  await prisma.customer.createMany({ data: rows });
}
