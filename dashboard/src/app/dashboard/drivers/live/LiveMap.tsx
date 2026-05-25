'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LiveDriver {
  id: string;
  fullName: string;
  phone: string;
  vehiclePlate: string | null;
  status: string;
  currentLng: number | null;
  currentLat: number | null;
  lastLocationAt: string | null;
  lastSeenMinutesAgo: number | null;
  inactive: boolean;
}

export interface RoutePoint {
  lng: number;
  lat: number;
  recordedAt: string;
}

interface Props {
  drivers: LiveDriver[];
  /** المسار لسائق محدد (لو null، ما نرسم خط). */
  selectedRoute: RoutePoint[] | null;
  selectedDriverId: string | null;
  onSelectDriver: (id: string) => void;
}

// مركز بغداد افتراضياً
const BAGHDAD_CENTER: [number, number] = [33.3152, 44.3661];

function colorForStatus(d: LiveDriver) {
  if (d.inactive) return '#dc2626'; // أحمر
  switch (d.status) {
    case 'AVAILABLE':
      return '#10b981'; // أخضر
    case 'ON_ROUTE':
      return '#0284c7'; // أزرق
    case 'BREAK':
    case 'ON_BREAK':
      return '#d97706'; // برتقالي
    default:
      return '#64748b'; // رمادي (offline)
  }
}

/** Build a divIcon for a driver. Memoised per color to avoid Leaflet
 *  re-creating DOM on every poll cycle.
 */
const ICON_CACHE = new Map<string, L.DivIcon>();
function driverIcon(color: string): L.DivIcon {
  const hit = ICON_CACHE.get(color);
  if (hit) return hit;
  const icon = L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        width:34px;height:34px;border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;
        font-size:18px;color:white;
      ">🚛</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
  ICON_CACHE.set(color, icon);
  return icon;
}

/** Fit بداية فقط — ما نريد reset zoom على المستخدم كل مرة. */
function FitBoundsOnce({ drivers }: { drivers: LiveDriver[] }) {
  const map = useMap();
  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current) return;
    const positioned = drivers.filter(
      (d) =>
        typeof d.currentLat === 'number' &&
        typeof d.currentLng === 'number' &&
        !Number.isNaN(d.currentLat) &&
        !Number.isNaN(d.currentLng),
    );
    if (positioned.length === 0) return;
    didFitRef.current = true;
    try {
      if (positioned.length === 1) {
        map.setView([positioned[0].currentLat!, positioned[0].currentLng!], 14);
      } else {
        const bounds = L.latLngBounds(
          positioned.map((d) => [d.currentLat!, d.currentLng!] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } catch (e) {
      // safety net — never crash the map page over a bad fitBounds
      console.warn('[LiveMap] fitBounds skipped:', e);
    }
  }, [drivers, map]);
  return null;
}

export function LiveMap({ drivers, selectedRoute, selectedDriverId, onSelectDriver }: Props) {
  // الـ icon hack يجب أن يعمل client-side فقط، ولمرّة واحدة.
  // إذا حطّيتها top-level قد ترمي خطأ مع react-leaflet v5 + Next 14
  // dynamic-import lifecycle.
  useEffect(() => {
    try {
      // @ts-expect-error — _getIconUrl is internal Leaflet plumbing
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    } catch (e) {
      console.warn('[LiveMap] icon fix skipped:', e);
    }
  }, []);

  const positionedDrivers = useMemo(
    () =>
      drivers.filter(
        (d) =>
          typeof d.currentLat === 'number' &&
          typeof d.currentLng === 'number' &&
          !Number.isNaN(d.currentLat) &&
          !Number.isNaN(d.currentLng),
      ),
    [drivers],
  );

  const safeRoute = useMemo(() => {
    if (!selectedRoute) return null;
    return selectedRoute
      .filter(
        (p) =>
          typeof p.lat === 'number' &&
          typeof p.lng === 'number' &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng),
      )
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [selectedRoute]);

  return (
    <MapContainer
      center={BAGHDAD_CENTER}
      zoom={11}
      style={{ height: '100%', width: '100%', borderRadius: 12 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBoundsOnce drivers={positionedDrivers} />

      {positionedDrivers.map((d) => (
        <Marker
          key={d.id}
          position={[d.currentLat as number, d.currentLng as number]}
          icon={driverIcon(colorForStatus(d))}
          eventHandlers={{
            click: () => onSelectDriver(d.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: 180, direction: 'rtl', textAlign: 'right' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.fullName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{d.phone}</div>
              {d.vehiclePlate && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  لوحة: {d.vehiclePlate}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 11 }}>
                <span
                  style={{
                    background: colorForStatus(d),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontWeight: 700,
                  }}
                >
                  {d.inactive
                    ? 'غير نشط'
                    : d.status === 'AVAILABLE'
                      ? 'متاح'
                      : d.status === 'ON_ROUTE'
                        ? 'في جولة'
                        : d.status === 'BREAK' || d.status === 'ON_BREAK'
                          ? 'استراحة'
                          : 'غير متصل'}
                </span>
              </div>
              {d.lastSeenMinutesAgo != null && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                  آخر تحديث: قبل {d.lastSeenMinutesAgo} دقيقة
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* رسم المسار للسائق المختار */}
      {safeRoute && safeRoute.length > 1 && selectedDriverId && (
        <Polyline
          positions={safeRoute}
          pathOptions={{ color: '#0284c7', weight: 4, opacity: 0.7 }}
        />
      )}
    </MapContainer>
  );
}
