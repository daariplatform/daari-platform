import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// تدفّق الإعداد الأول (٤ خطوات) — منقول من `onboarding.tsx`:
///   ١) إذن الموقع  ٢) المعمل المغطّي  ٣) شرح وصول السائق  ٤) قبول الشروط.
///
/// ملاحظة: نقطة `POST /customers/me/onboard` غير موجودة في الباك إند (كانت
/// مكسورة في Expo أيضاً)، فنحفظ الموقع عبر `POST /customers/:id/move` الموجود،
/// ونعلّم اكتمال التدفّق محلياً (LocalFlags) بدل استدعاء نقطة غير موجودة.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 1;
  Coords? _coords;
  bool _accepted = false;
  bool _busy = false;

  Future<void> _requestLocation() async {
    setState(() => _busy = true);
    try {
      final coords = await ref.read(locationServiceProvider).currentCoords();
      if (coords == null) {
        if (mounted) {
          await showDialog<void>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('الموقع مطلوب'),
              content: const Text(
                'نحتاج موقعك مرّة واحدة فقط لمعرفة المعمل الذي يخدم منطقتك. '
                'لن نتتبّعك بعد ذلك. فعّل خدمة الموقع وامنح الإذن ثم حاول مجدّداً.',
                style: TextStyle(height: 1.6),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('حسناً')),
              ],
            ),
          );
        }
        return;
      }
      setState(() {
        _coords = coords;
        _step = 2;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish() async {
    if (!_accepted || _coords == null) return;
    setState(() => _busy = true);
    // أفضل جهد: نحفظ موقع المنزل عبر نقطة النقل الموجودة (لا نقطة onboard).
    try {
      final profile = ref.read(myProfileProvider).asData?.value;
      final coords = _coords;
      if (profile != null && coords != null) {
        await ref
            .read(customerRepositoryProvider)
            .move(profile.id, lng: coords.lng, lat: coords.lat);
        ref.invalidate(myProfileProvider);
      }
    } on ApiException catch (_) {
      // لا نوقف الإعداد إن فشل الحفظ — يمكن تحديث الموقع لاحقاً من «حسابي».
    }
    await LocalFlags.markOnboardingSeen();
    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _header(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              child: switch (_step) {
                1 => _step1(),
                2 => _step2(),
                3 => _step3(),
                _ => _step4(),
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _header() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 52, 20, 24),
      decoration: const BoxDecoration(gradient: AppTheme.skyGradient),
      child: Column(
        children: [
          const Text('أهلاً بك في داري',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text('إعداد سريع لمدة دقيقة',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9), fontSize: 12)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var n = 1; n <= 4; n++) ...[
                if (n > 1) const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: n <= _step ? 1 : 0.3),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) {
    return Transform.translate(
      offset: const Offset(0, -12),
      child: SectionCard(
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      ),
    );
  }

  Widget _step1() {
    return _card(
      children: [
        const Icon(Icons.location_on, size: 48, color: AppColors.navy600),
        const SizedBox(height: 8),
        const Text('أين تسكن؟',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text(
          'نحتاج موقعك لنعرف أي معمل يخدم منطقتك. ستظهر لك المعامل المتاحة في حيّك فقط.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.slate, height: 1.6, fontSize: 13),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Text(
            '• يحفظ موقع بيتك للتوصيل لاحقاً\n• لا يُستخدم لتتبّعك\n• يُحدَّث فقط لو انتقلت لبيت جديد',
            style: TextStyle(color: AppColors.slate, height: 1.8, fontSize: 12),
          ),
        ),
        const SizedBox(height: 18),
        LoadingButton(
          label: 'السماح بالوصول للموقع',
          icon: Icons.my_location,
          loading: _busy,
          onPressed: _busy ? null : _requestLocation,
        ),
      ],
    );
  }

  Widget _step2() {
    final coords = _coords;
    if (coords == null) return _step1();
    final plantAsync =
        ref.watch(nearestPlantProvider((lng: coords.lng, lat: coords.lat)));
    return plantAsync.when(
      loading: () => _card(
        children: const [
          SizedBox(height: 20),
          Center(child: CircularProgressIndicator()),
          SizedBox(height: 14),
          Text('نبحث عن أقرب معمل…',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate)),
          SizedBox(height: 20),
        ],
      ),
      error: (_, __) => _noPlantCard(),
      data: (plant) {
        if (plant == null) return _noPlantCard();
        return _card(
          children: [
            const Icon(Icons.factory_outlined,
                size: 44, color: AppColors.navy600),
            const SizedBox(height: 8),
            const Text('المعمل الذي يخدم منطقتك',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.navy50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.navy200),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.navy600,
                    child: Icon(Icons.water_drop, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(plant.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                color: AppColors.navy900)),
                        const SizedBox(height: 2),
                        Text(
                          '${plant.city} • ${plant.distanceKm.toStringAsFixed(1)} كم • يخدم منطقتك ✓',
                          style: const TextStyle(
                              color: AppColors.navy700, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _StatCell(label: 'تعبئة', value: Fmt.iqd(1000))),
                Expanded(
                    child: _StatCell(label: 'سعة الخزان', value: '٥٠٠ لتر')),
                Expanded(
                    child: _StatCell(label: 'التركيب', value: 'مجاناً')),
              ],
            ),
            const SizedBox(height: 12),
            const _AmberNote(
              text:
                  'بسبب اتفاقية المعامل، يُسمح لك بالتسجيل في المعمل الذي يخدم منطقتك فقط.',
            ),
            const SizedBox(height: 18),
            LoadingButton(
              label: 'متابعة',
              onPressed: () => setState(() => _step = 3),
            ),
          ],
        );
      },
    );
  }

  Widget _noPlantCard() {
    return _card(
      children: [
        const Icon(Icons.sentiment_dissatisfied_outlined,
            size: 44, color: AppColors.muted),
        const SizedBox(height: 8),
        const Text('لا يوجد معمل في منطقتك بعد',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text('نحن نتوسّع باستمرار — سنبلغك عند توفّر معمل قريب.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, fontSize: 12.5)),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () => setState(() => _step = 1),
          child: const Text('رجوع'),
        ),
      ],
    );
  }

  Widget _step3() {
    return _card(
      children: [
        const Icon(Icons.local_shipping_outlined,
            size: 48, color: AppColors.water600),
        const SizedBox(height: 8),
        const Text('السائق في الطريق',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text(
          'بعد طلبك، يقبله سائق المعمل وتراه يتحرّك على الخريطة حتى يصل بابك. '
          'الدفع نقداً عند التسليم فقط.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.slate, height: 1.7, fontSize: 13),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text('ماذا سيحدث عند وصوله:',
                    style: TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 13.5)),
              ),
              SizedBox(height: 8),
              _CheckItem('يضع الخزان في المكان المناسب لك'),
              _CheckItem('يساعدك في تسجيل الدخول للتطبيق'),
              _CheckItem('يشرح لك كيف تطلب التعبئة في المستقبل'),
              _CheckItem('يملأ الخزان مجاناً في أوّل مرّة'),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _step = 2),
                child: const Text('رجوع'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LoadingButton(
                label: 'فهمت',
                onPressed: () => setState(() => _step = 4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _step4() {
    return _card(
      children: [
        const Icon(Icons.description_outlined,
            size: 48, color: AppColors.navy600),
        const SizedBox(height: 8),
        const Text('شروط استلام الخزان',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        Container(
          constraints: const BoxConstraints(maxHeight: 240),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.line),
          ),
          child: const SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TermItem(
                    n: 1,
                    text:
                        'الخزان ملكٌ للمعمل ويبقى في عهدتك للحفظ والاستخدام، وأنت مسؤول عن سلامته.'),
                _TermItem(
                    n: 2,
                    text:
                        'تلتزم بتعبئة الخزان شهرياً (مرّة كل شهر على الأقل) بسعر ١٠٠٠ د.ع تُدفع نقداً عند وصول السائق.'),
                _TermItem(
                    n: 3,
                    text:
                        'يحقّ للمعمل سحب الخزان إذا تأخّرت عن التعبئة أكثر من ٤٥ يوماً دون عذر.'),
                _TermItem(
                    n: 4,
                    text: 'تُبلِغ المعمل عبر التطبيق إذا انتقلت إلى عنوان جديد.'),
                _TermItem(
                    n: 5,
                    text:
                        'يمكنك إلغاء الخدمة في أي وقت بإعادة الخزان سليماً إلى المعمل.'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        CheckboxListTile(
          value: _accepted,
          onChanged: (v) => setState(() => _accepted = v ?? false),
          activeColor: AppColors.navy600,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text('أوافق على الشروط أعلاه وأقرّ باستلام خزان ٥٠٠ لتر في عهدتي',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : () => setState(() => _step = 3),
                child: const Text('رجوع'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LoadingButton(
                label: 'ابدأ الآن',
                icon: Icons.check_circle_outline,
                loading: _busy,
                onPressed: (!_accepted || _busy) ? null : _finish,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// خانة إحصائية صغيرة (قيمة فوق تسمية) — لصفّ معلومات المعمل في الخطوة 2.
class _StatCell extends StatelessWidget {
  const _StatCell({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontWeight: FontWeight.w900,
                color: AppColors.navy700,
                fontSize: 13.5)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(color: AppColors.slate, fontSize: 11)),
      ],
    );
  }
}

/// صندوق تنبيه كهرماني (معلومة مهمّة غير حاجبة).
class _AmberNote extends StatelessWidget {
  const _AmberNote({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warn500.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warn500.withValues(alpha: 0.30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: AppColors.warn600, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    color: AppColors.warn600, height: 1.6, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}

/// بند بعلامة صحّ — لقائمة «ماذا سيحدث عند وصوله» في الخطوة 3.
class _CheckItem extends StatelessWidget {
  const _CheckItem(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: AppColors.success, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    color: AppColors.slate, height: 1.6, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}

/// بند شروط مرقّم — لصندوق الشروط في الخطوة 4.
class _TermItem extends StatelessWidget {
  const _TermItem({required this.n, required this.text});
  final int n;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$n. ',
              style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  color: AppColors.navy700,
                  fontSize: 12.5)),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    color: AppColors.slate, height: 1.7, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
