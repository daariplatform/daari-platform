import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';

import '../api/driver_repository.dart';
import '../models/driver_profile.dart';

/// إحداثية بسيطة (lng/lat) — تطابق ترتيب الباك إند.
class Coords {
  const Coords({required this.lng, required this.lat});
  final double lng;
  final double lat;
}

/// خدمة الموقع — منقولة من `worker/lib/location.ts`.
///
/// foreground فقط عمداً (لا تتبّع خلفية → نتفادى مراجعة Google Play الخاصة).
/// السائق يُبقي التطبيق مفتوحاً أثناء الجولة، فمؤقّت كل 30 ثانية يكفي.
class LocationService {
  LocationService(this._drivers);

  final DriverRepository _drivers;
  Timer? _timer;

  bool get isTracking => _timer != null;

  /// يطلب صلاحية foreground فقط. يرجع true إن مُنحت.
  Future<bool> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  /// نبضة واحدة: يجلب الموقع ويرسله للخادم.
  Future<Coords?> pingOnce() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      await _drivers.pushLocation(lng: pos.longitude, lat: pos.latitude);
      return Coords(lng: pos.longitude, lat: pos.latitude);
    } catch (_) {
      return null;
    }
  }

  /// بدء تتبّع الوردية: صلاحية + AVAILABLE + نبضة فورية + مؤقّت 30 ثانية.
  Future<bool> startShift() async {
    if (!await ensurePermission()) return false;
    try {
      await _drivers.setStatus(DriverStatus.available);
    } catch (_) {
      // best effort
    }
    await pingOnce();
    _timer ??= Timer.periodic(const Duration(seconds: 30), (_) => pingOnce());
    return true;
  }

  /// إنهاء الوردية: إيقاف المؤقّت + OFFLINE.
  Future<void> stopShift() async {
    _timer?.cancel();
    _timer = null;
    try {
      await _drivers.setStatus(DriverStatus.offline);
    } catch (_) {
      // best effort
    }
  }

  /// إيقاف مؤقّت التتبّع **فقط** بلا أي نداء خادم — يُستدعى عند انتهاء الجلسة.
  /// (لا نستدعي `setStatus` هنا لأنّ التوكن ميّت: نداء آخر سيرجع 401 فيُعيد
  /// إشعال حلقة التجديد الفاشل التي تستنزف الـ GPS/البطارية.)
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
  }

  /// نبضة لمرّة (لفحص الوصول / تسجيل البيع الفوري) — لا تبثّ للخادم.
  Future<Coords?> currentCoords() async {
    if (!await ensurePermission()) return null;
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      return Coords(lng: pos.longitude, lat: pos.latitude);
    } catch (_) {
      return null;
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }

  /// مسافة Haversine بالأمتار — لفحص وصول السائق.
  static double distanceMetres(Coords a, Coords b) {
    double toRad(double d) => d * math.pi / 180;
    const r = 6371000.0;
    final dLat = toRad(b.lat - a.lat);
    final dLon = toRad(b.lng - a.lng);
    final sa = math.pow(math.sin(dLat / 2), 2) +
        math.cos(toRad(a.lat)) * math.cos(toRad(b.lat)) * math.pow(math.sin(dLon / 2), 2);
    return 2 * r * math.asin(math.sqrt(sa.toDouble()));
  }
}
