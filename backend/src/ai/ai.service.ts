import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PeakWindow {
  dayOfWeek: number; // 0 = Sunday
  hourStart: number; // 0..23
  hourEnd: number;
  expectedOrders: number;
  recommendedDrivers: number;
  label: string;
}

export interface DemandForecast {
  matrix: number[][]; // [7][24]
  peakWindows: PeakWindow[];
  trendFactor: number;
  sampleSize: number;
}

export interface ChurnItem {
  customerId: string;
  fullName: string;
  phone: string;
  district: string;
  typicalCadenceDays: number;
  daysSinceLastOrder: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  lastOrderAt: string;
  totalSpendIqd: number;
}

export interface ChurnReport {
  items: ChurnItem[];
  totalAtRisk: number;
  estimatedRevenueAtRiskIqd: number;
}

export interface OrderCluster {
  id: string;
  district: string;
  centerLng: number | null;
  centerLat: number | null;
  orderIds: string[];
  orderCount: number;
  totalLitersDelivered: number;
  avgDistanceKm: number;
  recommendedDriverId: string | null;
}

export interface OrderClustersReport {
  clusters: OrderCluster[];
  totalPendingOrders: number;
  clusteredOrders: number;
  unclusterableOrders: number;
}

export interface DriverScorecardItem {
  driverId: string;
  fullName: string;
  phone: string;
  score: number;
  breakdown: {
    completionRate: number;
    avgMinutesPerOrder: number;
    gpsVerifiedRate: number;
    bonusRate: number;
    disputeRate: number;
    completedOrders: number;
  };
  rank: 'top' | 'good' | 'average' | 'poor';
}

export interface DriverScorecardReport {
  items: DriverScorecardItem[];
  tenantAverageMinutesPerOrder: number;
}

// ─── Helpers (module-private) ──────────────────────────────────────────────

/**
 * Haversine distance in kilometres. Duplicated here (not imported) because
 * the original lives in orders.service.ts in *metres* and isn't exported;
 * pulling in OrdersService just for one pure helper would bloat the DI tree.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Arabic short day names (0=Sunday in JS Date.getDay)
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Format an hour 0..23 into an Arabic AM/PM token, e.g. "٧ص" / "٧م". */
function formatHourLabel(h: number): string {
  // We use western digits in the hour; Arabic suffix indicates morning/evening.
  // Examples: 0 -> "12ص", 7 -> "7ص", 13 -> "1م", 19 -> "7م".
  const suffix = h < 12 ? 'ص' : 'م';
  const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return `${display}${suffix}`;
}

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  // ─── 1. Demand forecast ────────────────────────────────────────────────

  /**
   * Predict completed-order volume by day-of-week × hour over the next 7 days.
   *
   * Approach: pull last-30-days of completed orders, average each cell of a
   * 7×24 matrix, multiply by a recent-vs-baseline trend factor, then surface
   * any cells exceeding 150 % of overall mean as "peak windows" for staffing.
   *
   * Caveats: pure historical extrapolation — does NOT account for holidays,
   * weather, or campaigns. New tenants with <50 completed orders get a noisy
   * forecast; the `sampleSize` field lets callers warn the user. Time bucketing
   * uses local server time (the API host runs in Baghdad TZ).
   */
  async demandForecast(tenantId: string): Promise<DemandForecast> {
    const now = new Date();
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: start30 },
      },
      select: { completedAt: true },
    });

    // Distinct day buckets observed per (dow, hour) so we average over the
    // *number of times* that bucket actually occurred in the lookback window,
    // not over the constant 30. For a 30-day window each dow occurs ~4-5 times.
    const counts: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const dowBucketsSeen: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());

    let last7Count = 0;
    for (const o of orders) {
      if (!o.completedAt) continue;
      const d = o.completedAt;
      const dow = d.getDay();
      const hour = d.getHours();
      counts[dow][hour] += 1;
      // Track which calendar days were present, per dow — divisor for mean.
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dowBucketsSeen[dow].add(dayKey);
      if (d >= start7) last7Count += 1;
    }

    // Average orders per (dow, hour) over the number of times that dow appeared.
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (let dow = 0; dow < 7; dow += 1) {
      const divisor = Math.max(dowBucketsSeen[dow].size, 1);
      for (let hour = 0; hour < 24; hour += 1) {
        matrix[dow][hour] = counts[dow][hour] / divisor;
      }
    }

    // Trend factor: recent 7-day daily-rate vs full-30-day daily-rate.
    const dailyAvg30 = orders.length / 30;
    const dailyAvg7 = last7Count / 7;
    const trendFactor =
      dailyAvg30 > 0 ? Number((dailyAvg7 / dailyAvg30).toFixed(3)) : 1;

    // Apply trend factor to every cell.
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        matrix[dow][hour] = Number((matrix[dow][hour] * trendFactor).toFixed(3));
      }
    }

    // Peak detection: cells > 150 % of overall mean.
    let total = 0;
    let cellsCounted = 0;
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        total += matrix[dow][hour];
        cellsCounted += 1;
      }
    }
    const overallMean = cellsCounted > 0 ? total / cellsCounted : 0;
    const peakThreshold = overallMean * 1.5;

    const peakWindows: PeakWindow[] = [];
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const expected = matrix[dow][hour];
        if (expected > peakThreshold && expected > 0) {
          peakWindows.push({
            dayOfWeek: dow,
            hourStart: hour,
            hourEnd: hour + 1,
            expectedOrders: Number(expected.toFixed(2)),
            recommendedDrivers: Math.max(1, Math.ceil(expected / 3)),
            label: `${AR_DAYS[dow]} ${formatHourLabel(hour)}-${formatHourLabel(
              (hour + 1) % 24,
            )}`,
          });
        }
      }
    }
    peakWindows.sort((a, b) => b.expectedOrders - a.expectedOrders);

    return {
      matrix,
      peakWindows,
      trendFactor,
      sampleSize: orders.length,
    };
  }

  // ─── 2. Churn risk ─────────────────────────────────────────────────────

  /**
   * Flag active customers whose refill cadence has stalled.
   *
   * Approach: per-customer, compute the average gap (in days) between their
   * completed historical orders. Compare days-since-last-order against that
   * baseline and bucket into HIGH (>2×), MEDIUM (>1.5×), LOW (>1.2×).
   *
   * Caveats: requires ≥3 historical orders for a stable cadence — newer
   * customers are silently skipped. The estimated-revenue-at-risk figure
   * extrapolates each at-risk customer's monthly spend from their historical
   * spend rate, so seasonal businesses will see noisy numbers.
   */
  async churnRisk(tenantId: string): Promise<ChurnReport> {
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'AT_RISK'] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        district: true,
        refillOrders: {
          where: { status: 'COMPLETED' },
          select: { completedAt: true, paidAmountIqd: true },
          orderBy: { completedAt: 'asc' },
        },
      },
    });

    const now = Date.now();
    const items: ChurnItem[] = [];
    let estimatedRevenueAtRiskIqd = 0;

    for (const c of customers) {
      const orders = c.refillOrders.filter((o) => o.completedAt != null);
      if (orders.length < 3) continue;

      // Compute gaps between consecutive completed orders (sorted asc).
      let gapSum = 0;
      let gapCount = 0;
      for (let i = 1; i < orders.length; i += 1) {
        const prev = orders[i - 1].completedAt!.getTime();
        const cur = orders[i].completedAt!.getTime();
        const days = (cur - prev) / (24 * 60 * 60 * 1000);
        if (days > 0) {
          gapSum += days;
          gapCount += 1;
        }
      }
      if (gapCount === 0) continue;
      const typicalCadenceDays = gapSum / gapCount;

      const lastOrder = orders[orders.length - 1].completedAt!;
      const daysSinceLast = (now - lastOrder.getTime()) / (24 * 60 * 60 * 1000);

      let risk: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;
      if (daysSinceLast > 2.0 * typicalCadenceDays) risk = 'HIGH';
      else if (daysSinceLast > 1.5 * typicalCadenceDays) risk = 'MEDIUM';
      else if (daysSinceLast > 1.2 * typicalCadenceDays) risk = 'LOW';

      if (!risk) continue;

      const totalSpendIqd = orders.reduce((s, o) => s + (o.paidAmountIqd ?? 0), 0);

      // Monthly extrapolation: (totalSpend / historical_span_days) * 30
      // where historical_span_days uses the first-to-last gap.
      const firstAt = orders[0].completedAt!.getTime();
      const spanDays = Math.max(1, (lastOrder.getTime() - firstAt) / (24 * 60 * 60 * 1000));
      const monthlyRevenue = (totalSpendIqd / spanDays) * 30;
      if (risk === 'HIGH' || risk === 'MEDIUM') {
        estimatedRevenueAtRiskIqd += monthlyRevenue;
      }

      items.push({
        customerId: c.id,
        fullName: c.fullName,
        phone: c.phone,
        district: c.district,
        typicalCadenceDays: Number(typicalCadenceDays.toFixed(2)),
        daysSinceLastOrder: Number(daysSinceLast.toFixed(2)),
        risk,
        lastOrderAt: lastOrder.toISOString(),
        totalSpendIqd,
      });
    }

    // Sort: HIGH first, then by totalSpend desc so the manager triages
    // the high-value churners at the top.
    const riskOrder: Record<'HIGH' | 'MEDIUM' | 'LOW', number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    items.sort((a, b) => {
      if (riskOrder[a.risk] !== riskOrder[b.risk]) return riskOrder[a.risk] - riskOrder[b.risk];
      return b.totalSpendIqd - a.totalSpendIqd;
    });

    return {
      items,
      totalAtRisk: items.length,
      estimatedRevenueAtRiskIqd: Math.round(estimatedRevenueAtRiskIqd),
    };
  }

  // ─── 3. Order clusters ─────────────────────────────────────────────────

  /**
   * Group open (PENDING/ASSIGNED) refill orders into routing batches.
   *
   * Approach: first partition by `customer.district` (cheap string bucket),
   * then within each district run a greedy 2 km haversine clusterer so a
   * district that spans many neighbourhoods can still split into multiple
   * runs. Each cluster suggests the nearest AVAILABLE driver based on the
   * driver's last reported GPS — falls back to null if no driver is online.
   *
   * Caveats: orders without GPS (no customer location, no completionLng)
   * are reported as `unclusterableOrders`, not silently dropped. 2 km is a
   * Baghdad-tuned radius; larger cities may want it parameterised later.
   */
  async orderClusters(tenantId: string): Promise<OrderClustersReport> {
    const orders = await this.prisma.refillOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
      select: {
        id: true,
        customerId: true,
        walkinLiters: true,
        tank: { select: { capacity: true } },
        customer: {
          select: {
            district: true,
            locationLng: true,
            locationLat: true,
          },
        },
      },
    });

    type Loaded = {
      id: string;
      district: string;
      lng: number | null;
      lat: number | null;
      liters: number;
    };

    const loaded: Loaded[] = orders.map((o) => {
      let liters = 0;
      if (o.tank?.capacity === 'L350') liters = 350;
      else if (o.tank?.capacity === 'L500') liters = 500;
      else if (o.walkinLiters) liters = o.walkinLiters;
      return {
        id: o.id,
        district: o.customer?.district ?? '— غير محدد',
        lng: o.customer?.locationLng ?? null,
        lat: o.customer?.locationLat ?? null,
        liters,
      };
    });

    const unclusterable = loaded.filter((l) => l.lng == null || l.lat == null);
    const geocoded = loaded.filter((l) => l.lng != null && l.lat != null);

    // Group by district.
    const byDistrict = new Map<string, Loaded[]>();
    for (const l of geocoded) {
      const arr = byDistrict.get(l.district) ?? [];
      arr.push(l);
      byDistrict.set(l.district, arr);
    }

    // Available drivers (with GPS) for the recommendation step.
    const drivers = await this.prisma.driver.findMany({
      where: {
        tenantId,
        status: { in: ['AVAILABLE', 'ON_BREAK'] },
        currentLng: { not: null },
        currentLat: { not: null },
      },
      select: { id: true, currentLng: true, currentLat: true },
    });

    const clusters: OrderCluster[] = [];

    for (const [district, items] of byDistrict) {
      // Greedy 2 km cluster: pick first unclustered, sweep all within 2 km,
      // repeat. Quadratic but n is small (open orders per district is dozens
      // at most in steady state).
      const RADIUS_KM = 2;
      const used = new Set<string>();
      let clusterIndex = 0;
      for (const seed of items) {
        if (used.has(seed.id)) continue;
        used.add(seed.id);
        const members: Loaded[] = [seed];
        for (const other of items) {
          if (used.has(other.id)) continue;
          const dist = haversineKm(seed.lat!, seed.lng!, other.lat!, other.lng!);
          if (dist <= RADIUS_KM) {
            used.add(other.id);
            members.push(other);
          }
        }

        // Cluster centre = arithmetic mean of member coords. Avg pairwise
        // distance gives a sense of cluster tightness for the UI.
        const centerLng = members.reduce((s, m) => s + m.lng!, 0) / members.length;
        const centerLat = members.reduce((s, m) => s + m.lat!, 0) / members.length;
        let pairSum = 0;
        let pairCount = 0;
        for (let i = 0; i < members.length; i += 1) {
          for (let j = i + 1; j < members.length; j += 1) {
            pairSum += haversineKm(members[i].lat!, members[i].lng!, members[j].lat!, members[j].lng!);
            pairCount += 1;
          }
        }
        const avgDistanceKm = pairCount > 0 ? Number((pairSum / pairCount).toFixed(3)) : 0;

        // Nearest available driver.
        let recommendedDriverId: string | null = null;
        let bestDist = Infinity;
        for (const d of drivers) {
          const dist = haversineKm(centerLat, centerLng, d.currentLat!, d.currentLng!);
          if (dist < bestDist) {
            bestDist = dist;
            recommendedDriverId = d.id;
          }
        }

        clusters.push({
          id: `${district}-${clusterIndex}`,
          district,
          centerLng,
          centerLat,
          orderIds: members.map((m) => m.id),
          orderCount: members.length,
          totalLitersDelivered: members.reduce((s, m) => s + m.liters, 0),
          avgDistanceKm,
          recommendedDriverId,
        });
        clusterIndex += 1;
      }
    }

    clusters.sort((a, b) => b.orderCount - a.orderCount);

    return {
      clusters,
      totalPendingOrders: orders.length,
      clusteredOrders: geocoded.length,
      unclusterableOrders: unclusterable.length,
    };
  }

  // ─── 4. Driver scorecard ───────────────────────────────────────────────

  /**
   * Compute a 0-100 quality score per driver from the last 30 days of work.
   *
   * Approach: weighted blend of completion rate (30 pts), avg-time-per-order
   * vs tenant-average (20 pts, lower is better), GPS-verified completion
   * rate (20 pts), bonus-earning rate (10 pts), volume (20 pts capped at
   * 30 orders), minus a 20 pt penalty scaled by customer dispute rate.
   * Final score is clamped to [0, 100].
   *
   * Caveats: drivers with zero completed orders score 0 (no signal). The
   * time-per-order normalisation uses tenant mean — a single underloaded
   * driver in a tiny tenant will skew the baseline. Disputes are weighted
   * heavily so one bad week tanks a driver until older disputes age out.
   */
  async driverScorecard(tenantId: string): Promise<DriverScorecardReport> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const drivers = await this.prisma.driver.findMany({
      where: { tenantId },
      include: { user: { select: { fullName: true, phone: true } } },
    });

    // First pass: gather per-driver raw stats and accumulate tenant total minutes.
    type Raw = {
      driverId: string;
      fullName: string;
      phone: string;
      completed: number;
      cancelled: number;
      avgMinutes: number;
      gpsVerifiedCount: number;
      bonusCount: number;
      disputeCount: number;
    };

    const rawStats: Raw[] = [];
    let tenantMinutesSum = 0;
    let tenantMinutesCount = 0;

    for (const d of drivers) {
      const orders = await this.prisma.refillOrder.findMany({
        where: {
          driverId: d.id,
          tenantId,
          OR: [
            { status: 'COMPLETED', completedAt: { gte: since } },
            { status: 'CANCELLED', completedAt: { gte: since } },
          ],
        },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          gpsVerified: true,
          bonusIqd: true,
          customerDisputedAt: true,
        },
      });

      let completed = 0;
      let cancelled = 0;
      let minutesSum = 0;
      let minutesCount = 0;
      let gpsVerifiedCount = 0;
      let bonusCount = 0;
      let disputeCount = 0;
      for (const o of orders) {
        if (o.status === 'COMPLETED') {
          completed += 1;
          if (o.startedAt && o.completedAt) {
            const m = (o.completedAt.getTime() - o.startedAt.getTime()) / 60000;
            if (m > 0 && m < 24 * 60) {
              // Drop outliers > 24 h (likely stuck/forgotten orders).
              minutesSum += m;
              minutesCount += 1;
            }
          }
          if (o.gpsVerified) gpsVerifiedCount += 1;
          if ((o.bonusIqd ?? 0) > 0) bonusCount += 1;
          if (o.customerDisputedAt) disputeCount += 1;
        } else if (o.status === 'CANCELLED') {
          cancelled += 1;
        }
      }
      const avgMinutes = minutesCount > 0 ? minutesSum / minutesCount : 0;
      tenantMinutesSum += minutesSum;
      tenantMinutesCount += minutesCount;

      rawStats.push({
        driverId: d.id,
        fullName: d.user.fullName,
        phone: d.user.phone,
        completed,
        cancelled,
        avgMinutes,
        gpsVerifiedCount,
        bonusCount,
        disputeCount,
      });
    }

    const tenantAvgMinutes = tenantMinutesCount > 0 ? tenantMinutesSum / tenantMinutesCount : 0;

    const items: DriverScorecardItem[] = rawStats.map((r) => {
      const completionRate =
        r.completed + r.cancelled > 0 ? r.completed / (r.completed + r.cancelled) : 0;
      const gpsVerifiedRate = r.completed > 0 ? r.gpsVerifiedCount / r.completed : 0;
      const bonusRate = r.completed > 0 ? r.bonusCount / r.completed : 0;
      const disputeRate = r.completed > 0 ? r.disputeCount / r.completed : 0;

      // Time-per-order component: full 20 pts when this driver is at or below
      // the tenant mean. Score degrades linearly to 0 at 2× the mean. If we
      // don't have a baseline yet, give half credit.
      let timePts = 10;
      if (tenantAvgMinutes > 0 && r.avgMinutes > 0) {
        const ratio = r.avgMinutes / tenantAvgMinutes;
        if (ratio <= 1) timePts = 20;
        else if (ratio >= 2) timePts = 0;
        else timePts = 20 * (1 - (ratio - 1));
      } else if (r.avgMinutes === 0) {
        timePts = 0; // No completions, no credit.
      }

      // Volume: cap influence at 30 orders/month so a single high-volume
      // driver doesn't crowd out quality on the leaderboard.
      const volumePts = Math.min(20, (r.completed / 30) * 20);

      const raw =
        30 * completionRate +
        timePts +
        20 * gpsVerifiedRate +
        10 * bonusRate +
        volumePts -
        20 * disputeRate;

      const score = Math.max(0, Math.min(100, Math.round(raw)));

      let rank: 'top' | 'good' | 'average' | 'poor';
      if (score >= 80) rank = 'top';
      else if (score >= 65) rank = 'good';
      else if (score >= 50) rank = 'average';
      else rank = 'poor';

      return {
        driverId: r.driverId,
        fullName: r.fullName,
        phone: r.phone,
        score,
        breakdown: {
          completionRate: Number(completionRate.toFixed(3)),
          avgMinutesPerOrder: Number(r.avgMinutes.toFixed(1)),
          gpsVerifiedRate: Number(gpsVerifiedRate.toFixed(3)),
          bonusRate: Number(bonusRate.toFixed(3)),
          disputeRate: Number(disputeRate.toFixed(3)),
          completedOrders: r.completed,
        },
        rank,
      };
    });

    items.sort((a, b) => b.score - a.score);

    return {
      items,
      tenantAverageMinutesPerOrder: Number(tenantAvgMinutes.toFixed(1)),
    };
  }
}
