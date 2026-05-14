// Mock dataset used when there's no backend wired up — the demo button
// on the role picker drops the user straight into the worker UX with
// realistic tasks so the design can be reviewed end-to-end.

import type { DriverTask } from './queries';

export const DEMO_TASKS: DriverTask[] = [
  {
    id: 't1',
    status: 'EN_ROUTE',
    kind: 'REFILL',
    customer: {
      id: 'c1',
      fullName: 'أم محمد',
      phone: '07710000001',
      district: 'الكرادة',
      addressLine: 'شارع ٦٢، بيت ١٤',
      locationLng: 44.4156,
      locationLat: 33.3033,
    },
    tank: { id: 'tk1', qrCode: 'MAA-DEMO-A1B2C3D4', capacity: 'L500' },
    scheduledFor: '9:30',
    priceIqd: 1000,
  },
  {
    id: 't2',
    status: 'ASSIGNED',
    kind: 'REFILL',
    customer: {
      id: 'c2',
      fullName: 'أبو حسن',
      phone: '07710000002',
      district: 'الكاظمية',
      addressLine: 'حي الحسين ٢٢',
      locationLng: 44.3444,
      locationLat: 33.3786,
    },
    tank: { id: 'tk2', qrCode: 'MAA-DEMO-E5F6G7H8', capacity: 'L350' },
    scheduledFor: '10:15',
    priceIqd: 1000,
  },
  {
    id: 't3',
    status: 'ASSIGNED',
    kind: 'TANK_DELIVERY',
    customer: {
      id: 'c3',
      fullName: 'حيدر جواد',
      phone: '07710000003',
      district: 'الجادرية',
      addressLine: 'شارع ١٤ رمضان',
      locationLng: 44.4250,
      locationLat: 33.2867,
    },
    tank: { id: 'tk3', qrCode: 'MAA-DEMO-NEW00001', capacity: 'L500' },
    scheduledFor: '11:00',
    priceIqd: 0,
  },
  {
    id: 't4',
    status: 'ASSIGNED',
    kind: 'REFILL',
    customer: {
      id: 'c4',
      fullName: 'أم زينب',
      phone: '07710000010',
      district: 'المنصور',
      addressLine: 'حي المعلمين ١٠٢',
      locationLng: 44.3417,
      locationLat: 33.3247,
    },
    tank: { id: 'tk4', qrCode: 'MAA-DEMO-K9L0M1N2', capacity: 'L500' },
    scheduledFor: '13:30',
    priceIqd: 1000,
  },
  {
    id: 't5',
    status: 'ASSIGNED',
    kind: 'TANK_RECLAIM',
    customer: {
      id: 'c5',
      fullName: 'أبو فاطمة',
      phone: '07710000005',
      district: 'البياع',
      addressLine: 'محلة ٨٢٤',
      locationLng: 44.3033,
      locationLat: 33.2733,
    },
    tank: { id: 'tk5', qrCode: 'MAA-DEMO-OLD0099X', capacity: 'L350' },
    scheduledFor: '15:00',
    priceIqd: 0,
  },
];

export const DEMO_HISTORY = [
  { id: 'h1', kind: 'REFILL', customer: { fullName: 'أم محمد' }, completedAt: '2026-05-13T10:24:00Z', paidAmountIqd: 1000 },
  { id: 'h2', kind: 'REFILL', customer: { fullName: 'أبو علي' }, completedAt: '2026-05-13T09:55:00Z', paidAmountIqd: 1000 },
  { id: 'h3', kind: 'TANK_DELIVERY', customer: { fullName: 'حيدر' }, completedAt: '2026-05-12T14:10:00Z', paidAmountIqd: 0 },
  { id: 'h4', kind: 'REFILL', customer: { fullName: 'كاظم' }, completedAt: '2026-05-12T11:30:00Z', paidAmountIqd: 1000 },
];

export const DEMO_SEARCH_CUSTOMERS = [
  { id: 'c1', fullName: 'أم محمد',  phone: '07710000001', district: 'الكرادة',   addressLine: 'شارع 62 بيت 14', status: 'ACTIVE' as const, totalRefills: 14, balanceIqd: 0, lastRefillAt: '2026-04-23T10:00:00Z', acceptedTermsAt: '2025-09-12T00:00:00Z', movedAt: null,
    tanks: [{ id: 'tk1', serialNumber: 'T-1024', qrCode: 'MAA-DEMO-A1B2C3D4', capacity: 'L500' as const, status: 'ASSIGNED' as const, lastRefillAt: '2026-04-23T10:00:00Z' }] },
  { id: 'c2', fullName: 'أبو حسن', phone: '07710000002', district: 'الكاظمية', addressLine: 'حي الحسين 22', status: 'ACTIVE' as const, totalRefills: 11, balanceIqd: 0, lastRefillAt: '2026-04-18T10:00:00Z', acceptedTermsAt: '2025-10-04T00:00:00Z', movedAt: null,
    tanks: [{ id: 'tk2', serialNumber: 'T-1023', qrCode: 'MAA-DEMO-E5F6G7H8', capacity: 'L350' as const, status: 'ASSIGNED' as const, lastRefillAt: '2026-04-18T10:00:00Z' }] },
  { id: 'c3', fullName: 'سارة محمد', phone: '07710000004', district: 'المنصور', addressLine: 'حي المعلمين 102', status: 'AT_RISK' as const, totalRefills: 8, balanceIqd: -1000, lastRefillAt: '2026-04-09T10:00:00Z', acceptedTermsAt: '2025-12-22T00:00:00Z', movedAt: null,
    tanks: [{ id: 'tk6', serialNumber: 'T-1022', qrCode: 'MAA-DEMO-XYZ12345', capacity: 'L500' as const, status: 'AT_RISK' as const, lastRefillAt: '2026-04-09T10:00:00Z' }] },
  { id: 'c4', fullName: 'كاظم علي', phone: '07710000006', district: 'الدورة',   addressLine: 'محلة 832', status: 'ACTIVE' as const, totalRefills: 13, balanceIqd: 0, lastRefillAt: '2026-04-22T10:00:00Z', acceptedTermsAt: null, movedAt: null,
    tanks: [{ id: 'tk7', serialNumber: 'T-1024', qrCode: 'T-1024', capacity: 'L500' as const, status: 'ASSIGNED' as const, lastRefillAt: '2026-04-22T10:00:00Z' }] },
];

export const DEMO_SALARY = {
  baseSalaryIqd: 500_000,
  commissionIqd: 18_200,
  performanceBonusIqd: 9_100,
};
