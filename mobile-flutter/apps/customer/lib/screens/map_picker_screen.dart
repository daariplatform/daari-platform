import 'package:daari_core/daari_core.dart';
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

/// منتقي الموقع على الخريطة — يرجع LatLng عبر context.pop.
///
/// يتطلّب ضبط مفتاح خرائط Google في AndroidManifest و AppDelegate
/// (انظر README). بدون مفتاح تظهر الخريطة رمادية لكن المنطق يعمل.
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

  @override
  void initState() {
    super.initState();
    _center = widget.initial == null
        ? _baghdad
        : LatLng(widget.initial!.lat, widget.initial!.lng);
  }

  Future<void> _useMyLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      final target = LatLng(pos.latitude, pos.longitude);
      setState(() => _center = target);
      await _controller?.animateCamera(CameraUpdate.newLatLng(target));
    } catch (_) {
      // تجاهل — يبقى المركز الحالي
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حدّد موقعك')),
      body: Stack(
        alignment: Alignment.center,
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(target: _center, zoom: 15),
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            onMapCreated: (c) => _controller = c,
            onCameraMove: (pos) => _center = pos.target,
          ),
          // دبّوس ثابت في المنتصف
          const Padding(
            padding: EdgeInsets.only(bottom: 36),
            child: Icon(Icons.location_on, color: AppColors.danger, size: 48),
          ),
          Positioned(
            bottom: 24,
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
            child: ElevatedButton.icon(
              icon: const Icon(Icons.check),
              label: const Text('تأكيد هذا الموقع'),
              onPressed: () => context.pop(_center),
            ),
          ),
        ],
      ),
    );
  }
}
