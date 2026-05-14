// Types mirror the backend's Prisma schema. Keep these in sync with
// /backend/prisma/schema.prisma — or share via a published npm package
// once the codebase grows.

export type Capability =
  | 'customer'
  | 'driver'
  | 'vendor'
  | 'plant_admin'
  | 'platform_admin';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  capabilities: Capability[];
}

export interface MeResponse {
  id: string;
  phone: string;
  role: string;
  tenantId: string | null;
  capabilities: Capability[];
}

export type TankCapacity = 'L350' | 'L500';

export type TankStatus =
  | 'IN_PLANT'
  | 'ASSIGNED'
  | 'AT_RISK'
  | 'RECLAIMED'
  | 'DAMAGED';

export type CustomerStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'AT_RISK'
  | 'INACTIVE'
  | 'CHURNED';

export interface CustomerProfile {
  id: string;
  fullName: string;
  phone: string;
  district: string;
  addressLine: string;
  status: CustomerStatus;
  totalRefills: number;
  balanceIqd: number;
  lastRefillAt: string | null;
  acceptedTermsAt: string | null;
  movedAt: string | null;
  tanks: Tank[];
}

export interface Tank {
  id: string;
  serialNumber: string;
  qrCode: string;
  capacity: TankCapacity;
  status: TankStatus;
  lastRefillAt: string | null;
}

export type RefillOrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type RefillOrderKind =
  | 'REFILL'
  | 'TANK_DELIVERY'
  | 'TANK_RECLAIM'
  | 'WALKIN_SALE';

export interface RefillOrder {
  id: string;
  status: RefillOrderStatus;
  kind: RefillOrderKind;
  priceIqd: number;
  paidAmountIqd: number;
  requestedAt: string;
  completedAt: string | null;
  driver: { id: string; user: { fullName: string } } | null;
}

export interface NearestPlant {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  coverageKm: number;
}
