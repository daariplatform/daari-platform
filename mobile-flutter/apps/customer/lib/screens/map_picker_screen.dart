import 'package:daari_core/daari_core.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// مدخلات منتقي الموقع (الإحداثية الابتدائية).
class MapPickerArgs {
  const MapPickerArgs({required this.lat, required this.lng});
  final double lat;
  final double lng;
}

/// نتيجة منتقي الموقع — الإحداثية + نصّ العنوان (من reverse-geocode، قد يكون فارغاً).
class MapPickResult {
  const MapPickResult({
    required this.lat,
    required this.lng,
    this.address = '',
  });
  final double lat;
  final double lng;
  final String address;
}

/// منتقي الموقع على الخريطة — يرجع [MapPickResult] عبر context.pop.
///
/// • عند الفتح بلا إحداثية ابتدائية: يجلب موقع GPS تلقائياً (مع شاشة تحميل)،
///   ويتراجع إلى بغداد عند الرفض/الفشل.
/// • عند التأكيد: يعكس الترميز الجغرافي للإحداثية إلى نصّ عنوان عربي.
///
/// يتطلّب ضبط مفتاح خرائط Google (انظر README). بدون مفتاح تظهر الخريطة رمادية
/// لكن المنطق يعمل.
class MapPickerScreen extends StatefulWidget {
  const MapPickerScreen({super.key, this.initial});
  final MapPickerArgs? initial;

  @override
  State<MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends State<MapPickerScreen> {
  // بغداد افتراضياً.
  static const _baghdad = LatLng(33.3152, 44.3661);
  late LatLng _center;
  GoogleMapController? _controller;
  bool _locating = false;
  bool _confirming = false;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _center = LatLng(widget.initial!.lat, widget.initial!.lng);
    } else {
      // بلا إحداثية ابتدائية: حدّد موقع المستخدم تلقائياً قبل عرض الخريطة.
      _center = _baghdad;
      _locating = true;
      _autoLocate();
    }
  }

  Future<LatLng?> _resolveCurrent() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return null;
      }
      final pos = await Geolocator.getCurrentPosition();
      return LatLng(pos.latitude, pos.longitude);
    } catch (_) {
      return null;
    }
  }

  /// جلب تلقائي عند الفتح — يتراجع إلى بغداد إن تعذّر.
  Future<void> _autoLocate() async {
    final target = await _resolveCurrent();
    if (!mounted) return;
    setState(() {
      if (target != null) _center = target;
      _locating = false; // الخريطة تُبنى الآن بالمركز المحسوم.
    });
  }

  Future<void> _useMyLocation() async {
    final target = await _resolveCurrent();
    if (target == null || !mounted) return;
    setState(() => _center = target);
    await _controller?.animateCamera(CameraUpdate.newLatLng(target));
  }

  /// تأكيد الموقع: يعكس الترميز الجغرافي ثم يُرجِع النتيجة.
  Future<void> _confirm() async {
    if (_confirming) return;
    setState(() => _confirming = true);
    var address = '';
    try {
      final marks =
          await placemarkFromCoordinates(_center.latitude, _center.longitude);
      if (marks.isNotEmpty) {
        final p = marks.first;
        final seen = <String>{};
        address = <String?>[
          p.name,
          p.street,
          p.subLocality,
          p.locality,
          p.administrativeArea,
        ]
            .whereType<String>()
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty && seen.add(s))
            .join('، ');
      }
    } catch (_) {
      // فشل الترميز (لا شبكة/لا خدمة) — نُرجِع الإحداثية بلا نصّ عنوان.
    }
    if (!mounted) return;
    context.pop(MapPickResult(
      lat: _center.latitude,
      lng: _center.longitude,
      address: address,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حدّد موقعك')),
      body: _locating ? _loadingView() : _mapView(),
    );
  }

  Widget _loadingView() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('جارٍ تحديد موقعك…',
              style: TextStyle(color: AppColors.slate, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _mapView() {
    return Stack(
      alignment: Alignment.center,
      children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(target: _center, zoom: 15),
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          onMapCreated: (c) => _controller = c,
          onCameraMove: (pos) => setState(() => _center = pos.target),
        ),
        // دبّوس ثابت في المنتصف
        const Padding(
          padding: EdgeInsets.only(bottom: 36),
          child: Icon(Icons.location_on, color: AppColors.danger, size: 48),
        ),
        Positioned(
          bottom: 96,
          right: 16,
          child: FloatingActionButton(
            heroTag: 'myloc',
            backgroundColor: Colors.white,
            foregroundColor: AppColors.navy600,
            onPressed: _useMyLocation,
            child: const Icon(Icons.my_location),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 24,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.ink.withValues(alpha: 0.12),
                        blurRadius: 8),
                  ],
                ),
                child: Text(
                  '${_center.latitude.toStringAsFixed(5)}, ${_center.longitude.toStringAsFixed(5)}',
                  style: const TextStyle(
                      color: AppColors.slate,
                      fontSize: 12,
                      fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                icon: _confirming
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.4, color: Colors.white),
                      )
                    : const Icon(Icons.check),
                label: const Text('تأكيد هذا الموقع'),
                onPressed: _confirming ? null : _confirm,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
