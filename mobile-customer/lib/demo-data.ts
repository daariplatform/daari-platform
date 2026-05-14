// Mock data used when the app runs in "demo mode" (no real backend).
// The login screen has a demo button that flips state.cust.demo = true
// and queries.ts then returns these instead of hitting the API.

import type { CustomerProfile, RefillOrder } from './types';

export const DEMO_PROFILE: CustomerProfile = {
  id: 'demo-customer',
  fullName: 'أم محمد (تجربة)',
  phone: '07710000001',
  district: 'الكرادة',
  addressLine: 'شارع 62، بيت 14',
  status: 'ACTIVE',
  totalRefills: 14,
  balanceIqd: 0,
  lastRefillAt: '2026-04-23T10:00:00Z',
  acceptedTermsAt: '2025-09-12T10:00:00Z',
  movedAt: null,
  tanks: [
    {
      id: 'demo-tank',
      serialNumber: 'T-1024',
      qrCode: 'MAA-DEMO-A1B2C3D4',
      capacity: 'L500',
      status: 'ASSIGNED',
      lastRefillAt: '2026-04-23T10:00:00Z',
    },
  ],
};

export const DEMO_ORDERS: RefillOrder[] = [
  {
    id: 'r-2026-118',
    status: 'COMPLETED',
    kind: 'REFILL',
    priceIqd: 1000,
    paidAmountIqd: 1000,
    requestedAt: '2026-04-23T10:00:00Z',
    completedAt: '2026-04-23T11:30:00Z',
    driver: { id: 'd1', user: { fullName: 'كريم السائق' } },
  },
  {
    id: 'r-2026-101',
    status: 'COMPLETED',
    kind: 'REFILL',
    priceIqd: 1000,
    paidAmountIqd: 1000,
    requestedAt: '2026-03-25T09:00:00Z',
    completedAt: '2026-03-25T10:30:00Z',
    driver: { id: 'd1', user: { fullName: 'كريم السائق' } },
  },
  {
    id: 'r-2026-082',
    status: 'COMPLETED',
    kind: 'REFILL',
    priceIqd: 1000,
    paidAmountIqd: 1000,
    requestedAt: '2026-02-26T08:30:00Z',
    completedAt: '2026-02-26T10:00:00Z',
    driver: { id: 'd2', user: { fullName: 'حسين' } },
  },
  {
    id: 'r-2026-051',
    status: 'COMPLETED',
    kind: 'TANK_DELIVERY',
    priceIqd: 0,
    paidAmountIqd: 0,
    requestedAt: '2026-01-02T11:00:00Z',
    completedAt: '2026-01-02T13:00:00Z',
    driver: { id: 'd1', user: { fullName: 'كريم السائق' } },
  },
];
