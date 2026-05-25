import { PrismaClient, UserRole, TankCapacity, TankStatus, SubscriptionPlan, TenantStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('password123');

  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: 'معمل النقاء',
      ownerName: 'أبو علي',
      ownerPhone: '07700000001',
      city: 'بغداد',
      plan: SubscriptionPlan.PRO,
      status: TenantStatus.ACTIVE,
      coverageLng: 44.4156,
      coverageLat: 33.3033,
      coverageKm: 7,
      refillBonusIqd: 50,
      newCustomerBonusIqd: 5000,
    },
  });

  const owner = await prisma.user.upsert({
    where: { phone: '07700000001' },
    update: {},
    create: {
      phone: '07700000001',
      passwordHash,
      fullName: 'أبو علي',
      role: UserRole.OWNER,
      tenantId: tenant.id,
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { phone: '07700000002' },
    update: {},
    create: {
      phone: '07700000002',
      passwordHash,
      fullName: 'كريم السائق',
      role: UserRole.DRIVER,
      tenantId: tenant.id,
    },
  });

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      tenantId: tenant.id,
      vehiclePlate: '12345 بغداد',
      baseSalaryIqd: 500_000,
      commissionPerRefillIqd: 100,
    },
  });

  // a couple of customers
  const customers = [
    { name: 'أم محمد', phone: '07710000001', district: 'الكرادة', lng: 44.4156, lat: 33.3033 },
    { name: 'أبو حسن', phone: '07710000002', district: 'الكاظمية', lng: 44.3444, lat: 33.3786 },
  ];

  for (const c of customers) {
    // Each demo customer also gets a User row so they can log into the
    // mobile customer app with the standard demo password. Without this
    // the seeded customers only exist as Customer records — they couldn't
    // sign in, and the dashboard's "reset password" button would error
    // out with "Customer has no login account yet".
    const customerUser = await prisma.user.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        phone: c.phone,
        passwordHash,
        fullName: c.name,
        role: UserRole.CUSTOMER,
        tenantId: tenant.id,
      },
    });
    await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: c.phone } },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: customerUser.id,
        fullName: c.name,
        phone: c.phone,
        whatsapp: c.phone,
        district: c.district,
        addressLine: `${c.district}, شارع رئيسي`,
        locationLng: c.lng,
        locationLat: c.lat,
      },
    });
  }

  // a few tanks — now scoped per-tenant since qrCode is composite-unique
  // on (tenantId, qrCode). Two seeded plants can use T-1001 independently.
  for (let i = 1; i <= 3; i++) {
    const serial = `T-${1000 + i}`;
    await prisma.tank.upsert({
      where: { tenantId_qrCode: { tenantId: tenant.id, qrCode: serial } },
      update: {},
      create: {
        tenantId: tenant.id,
        serialNumber: serial,
        qrCode: serial,
        capacity: i % 2 === 0 ? TankCapacity.L500 : TankCapacity.L350,
        status: TankStatus.IN_PLANT,
      },
    });
  }

  console.log('Seed complete:', { tenant: tenant.name, owner: owner.phone });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
