import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// خريطة الأسطول الحيّة — مواقع سائقي المعمل (`GET /drivers/live`، استقصاء كل ١٥ث).
/// بلا مفتاح خرائط تظهر الخريطة رمادية دون تعطّل؛ يُضبط المفتاح للإنتاج.
class FleetMapScreen extends ConsumerWidget {
  const FleetMapScreen({super.key});

  // مركز افتراضي (بغداد) حين لا يوجد سائق بموقع.
  static const _fallback =
      CameraPosition(target: LatLng(33.3152, 44.3661), zoom: 11);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final live = ref.watch(liveDriversProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('خريطة الأسطول'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(liveDriversProvider),
          ),
        ],
      ),
      body: AsyncView<List<LiveDriver>>(
        value: live,
        onRetry: () => ref.invalidate(liveDriversProvider),
        data: (drivers) {
          final located = drivers.where((d) => d.hasLocation).toList();
          final noLocation = drivers.length - located.length;
          final inactive = drivers.where((d) => d.inactive).length;

          if (drivers.isEmpty) {
            return const EmptyState(
              icon: Icons.local_shipping_outlined,
              title: 'لا سائقون',
              message: 'لم يُسجَّل سائقون لهذا المعمل بعد.',
            );
          }

          final markers = <Marker>{
            for (final d in located)
              Marker(
                markerId: MarkerId(d.id),
                position: LatLng(d.currentLat!, d.currentLng!),
                icon: BitmapDescriptor.defaultMarkerWithHue(_hue(d)),
                infoWindow: InfoWindow(
                  title: d.fullName,
                  snippet:
                      '${d.status.label}${d.lastSeenMinutesAgo != null ? ' · قبل ${d.lastSeenMinutesAgo} د' : ''}',
                ),
              ),
          };

          final initial = located.isNotEmpty
              ? CameraPosition(
                  target: LatLng(
                      located.first.currentLat!, located.first.currentLng!),
                  zoom: 12)
              : _fallback;

          return Stack(
            children: [
              GoogleMap(
                initialCameraPosition: initial,
                markers: markers,
                myLocationButtonEnabled: false,
                myLocationEnabled: false,
                zoomControlsEnabled: false,
                mapToolbarEnabled: false,
              ),
              Positioned(
                top: 12,
                left: 12,
                right: 12,
                child: _StatusBar(
                  total: drivers.length,
                  onMap: located.length,
                  inactive: inactive,
                  noLocation: noLocation,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  double _hue(LiveDriver d) {
    if (d.inactive) return BitmapDescriptor.hueOrange;
    if (d.status.isOnShift) return BitmapDescriptor.hueGreen;
    return BitmapDescriptor.hueAzure;
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.total,
    required this.onMap,
    required this.inactive,
    required this.noLocation,
  });

  final int total;
  final int onMap;
  final int inactive;
  final int noLocation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _Pill(label: 'الكل', value: '$total', color: AppColors.navy600),
          _Pill(
              label: 'على الخريطة', value: '$onMap', color: AppColors.water600),
          _Pill(label: 'خامل', value: '$inactive', color: AppColors.warning),
          _Pill(
              label: 'بلا موقع', value: '$noLocation', color: AppColors.muted),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        Text(label,
            style: const TextStyle(fontSize: 11, color: AppColors.slate)),
      ],
    );
  }
}
