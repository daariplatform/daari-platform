import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../widgets/common.dart';
import '../widgets/otp_field.dart';
import 'map_picker_screen.dart';

enum _Step { locating, pickPlant, info, otp, submitted }

/// معالج تسجيل الزبون الجديد:
/// تحديد الموقع → اختيار المعمل → البيانات → رمز OTP → بانتظار الموافقة.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  _Step _step = _Step.locating;
  bool _loading = false;

  double? _lat;
  double? _lng;
  List<NearestPlant> _plants = const [];
  NearestPlant? _picked;

  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _district = TextEditingController();
  final _address = TextEditingController();
  final _otp = TextEditingController();
  bool _otpError = false;

  @override
  void dispose() {
    _fullName.dispose();
    _phone.dispose();
    _district.dispose();
    _address.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => _loading = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        if (mounted) showSnack(context, 'نحتاج إذن الموقع لإيجاد أقرب معمل', error: true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      _lat = pos.latitude;
      _lng = pos.longitude;
      await _loadPlants();
    } catch (_) {
      if (mounted) showSnack(context, 'تعذّر تحديد الموقع. جرّب الخريطة.', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickOnMap() async {
    final result = await context.push<LatLng>('/map-picker',
        extra: _lat == null ? null : MapPickerArgs(lat: _lat!, lng: _lng!));
    if (result == null) return;
    _lat = result.latitude;
    _lng = result.longitude;
    await _loadPlants();
  }

  Future<void> _loadPlants() async {
    if (_lat == null || _lng == null) return;
    setState(() => _loading = true);
    try {
      final plants =
          await ref.read(tenantsRepositoryProvider).discover(lng: _lng!, lat: _lat!);
      setState(() {
        _plants = plants;
        _step = _Step.pickPlant;
      });
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestOtp() async {
    final phone = _phone.text.trim();
    if (_fullName.text.trim().isEmpty ||
        !Validators.isPhone(phone) ||
        _district.text.trim().isEmpty ||
        _address.text.trim().isEmpty) {
      showSnack(context, 'أكمل كل الحقول والتأكّد من رقم الهاتف', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await ref.read(authRepositoryProvider).requestSignupOtp(phone);
      if (mounted) setState(() => _step = _Step.otp);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyAndSubmit() async {
    if (!Validators.isOtp(_otp.text)) {
      setState(() => _otpError = true);
      return;
    }
    setState(() {
      _loading = true;
      _otpError = false;
    });
    try {
      final auth = ref.read(authRepositoryProvider);
      await auth.verifySignupOtp(phone: _phone.text.trim(), otp: _otp.text.trim());
      await ref.read(tenantsRepositoryProvider).createLead(
            tenantId: _picked!.id,
            fullName: _fullName.text.trim(),
            phone: _phone.text.trim(),
            district: _district.text.trim(),
            addressLine: _address.text.trim(),
            locationLng: _lng!,
            locationLat: _lat!,
          );
      if (mounted) setState(() => _step = _Step.submitted);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _otpError = true);
        showSnack(context, e.message, error: true);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حساب جديد')),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    switch (_step) {
      case _Step.locating:
        return _locatingStep();
      case _Step.pickPlant:
        return _pickPlantStep();
      case _Step.info:
        return _infoStep();
      case _Step.otp:
        return _otpStep();
      case _Step.submitted:
        return _submittedStep();
    }
  }

  Widget _locatingStep() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.my_location, size: 64, color: AppColors.navy600),
          const SizedBox(height: 20),
          const Text('أين نوصّل لك؟',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('نحتاج موقعك لإيجاد أقرب معمل مياه يخدم منطقتك.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate, height: 1.6)),
          const SizedBox(height: 28),
          LoadingButton(
              label: 'استخدم موقعي الحالي',
              icon: Icons.gps_fixed,
              loading: _loading,
              onPressed: _locate),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _loading ? null : _pickOnMap,
            icon: const Icon(Icons.map_outlined),
            label: const Text('اختر على الخريطة'),
          ),
        ],
      ),
    );
  }

  Widget _pickPlantStep() {
    if (_plants.isEmpty) {
      return EmptyState(
        icon: Icons.location_off,
        title: 'لا توجد معامل قريبة',
        message: 'لم نجد معملاً يخدم موقعك الحالي. جرّب موقعاً آخر.',
        actionLabel: 'تغيير الموقع',
        onAction: () => setState(() => _step = _Step.locating),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('اختر معملك',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        const Text('المعامل التي تخدم موقعك:',
            style: TextStyle(color: AppColors.slate)),
        const SizedBox(height: 16),
        ..._plants.map((p) {
          final within = p.isWithinCoverage;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SectionCard(
              child: Row(
                children: [
                  Icon(Icons.factory,
                      color: within ? AppColors.navy600 : AppColors.muted),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name,
                            style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text(
                            '${p.city} · ${p.distanceKm.toStringAsFixed(1)} كم'
                            '${within ? '' : ' · خارج النطاق'}',
                            style: TextStyle(
                                color: within ? AppColors.slate : AppColors.danger,
                                fontSize: 12.5)),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: within
                        ? () => setState(() {
                              _picked = p;
                              _step = _Step.info;
                            })
                        : null,
                    style: ElevatedButton.styleFrom(
                        minimumSize: const Size(72, 40)),
                    child: const Text('اختر'),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _infoStep() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('معملك: ${_picked?.name ?? ''}',
            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy700)),
        const SizedBox(height: 16),
        LabeledField(label: 'الاسم الكامل', controller: _fullName),
        const SizedBox(height: 12),
        LabeledField(
            label: 'رقم الهاتف',
            controller: _phone,
            hint: '07XXXXXXXXX',
            keyboardType: TextInputType.phone,
            maxLength: 11),
        const SizedBox(height: 12),
        LabeledField(label: 'المنطقة / الحيّ', controller: _district),
        const SizedBox(height: 12),
        LabeledField(label: 'العنوان التفصيلي', controller: _address),
        const SizedBox(height: 20),
        LoadingButton(label: 'إرسال رمز التحقّق', loading: _loading, onPressed: _requestOtp),
      ],
    );
  }

  Widget _otpStep() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Icon(Icons.sms_outlined, size: 56, color: AppColors.navy600),
        const SizedBox(height: 16),
        Text('أدخل الرمز المُرسَل إلى ${_phone.text}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.slate, height: 1.6)),
        const SizedBox(height: 20),
        OtpCodeField(
            controller: _otp,
            error: _otpError,
            onCompleted: (_) => _verifyAndSubmit()),
        const SizedBox(height: 16),
        LoadingButton(label: 'تأكيد', loading: _loading, onPressed: _verifyAndSubmit),
        TextButton(
          onPressed: _loading ? null : _requestOtp,
          child: const Text('إعادة إرسال الرمز'),
        ),
      ],
    );
  }

  Widget _submittedStep() {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.hourglass_top, size: 72, color: AppColors.warn500),
          const SizedBox(height: 20),
          const Text('طلبك قيد المراجعة',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const Text(
              'استلم المعمل طلب انضمامك. سيتواصل معك لتسليم الخزان وتفعيل حسابك، '
              'ثم يمكنك تسجيل الدخول والطلب.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate, height: 1.7)),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => context.go('/welcome'),
              child: const Text('حسناً'),
            ),
          ),
        ],
      ),
    );
  }
}
