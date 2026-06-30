import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// شاشة «البيع الفوري» للسائق — وضعان:
/// (أ) بحث عن زبون مسجّل ثم تعبئة فورية (walk-in refill).
/// (ب) تسجيل زبون جديد ميدانياً يراجعه المعمل لاحقاً.
class WalkinScreen extends ConsumerStatefulWidget {
  const WalkinScreen({super.key});

  @override
  ConsumerState<WalkinScreen> createState() => _WalkinScreenState();
}

class _WalkinScreenState extends ConsumerState<WalkinScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('بيع فوري'),
        bottom: TabBar(
          controller: _tab,
          tabs: const [
            Tab(icon: Icon(Icons.water_drop_outlined), text: 'تعبئة زبون'),
            Tab(
                icon: Icon(Icons.person_add_alt_1_outlined),
                text: 'تسجيل جديد'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: const [
          _LookupTab(),
          _RegisterTab(),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// (أ) تبويب التعبئة الفورية لزبون مسجّل
// ════════════════════════════════════════════════════════════════════════

class _LookupTab extends ConsumerStatefulWidget {
  const _LookupTab();

  @override
  ConsumerState<_LookupTab> createState() => _LookupTabState();
}

class _LookupTabState extends ConsumerState<_LookupTab> {
  final _searchController = TextEditingController();
  String _query = '';
  CustomerProfile? _selected;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _pick(CustomerProfile c) {
    FocusScope.of(context).unfocus();
    setState(() => _selected = c);
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    if (selected != null) {
      return _WalkinForm(
        customer: selected,
        onBack: () => setState(() => _selected = null),
      );
    }

    final results = ref.watch(customerSearchProvider(_query));

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const Text(
          'ابحث عن الزبون بالاسم أو الهاتف أو رقم الخزّان ثم اختره لإتمام التعبئة.',
          style: TextStyle(fontSize: 13, color: AppColors.slate),
        ),
        const SizedBox(height: 8),
        // نصيحة: البحث برقم الخزّان يميّز الزبائن المتشابهين بالاسم (يطابق Expo).
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.water100,
            borderRadius: BorderRadius.circular(AppTheme.radiusInput),
          ),
          child: const Row(
            children: [
              Icon(Icons.lightbulb_outline,
                  size: 16, color: AppColors.water700),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'نصيحة: ابحث برقم الخزّان لتمييز الزبائن المتشابهين بالاسم.',
                  style: TextStyle(fontSize: 12, color: AppColors.water700),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _searchController,
          textInputAction: TextInputAction.search,
          onChanged: (v) => setState(() => _query = v),
          decoration: InputDecoration(
            hintText: 'مثال: أم محمد أو 0770... أو رقم الخزّان',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _query.isEmpty
                ? null
                : IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _query = '');
                    },
                  ),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusInput),
              borderSide: const BorderSide(color: AppColors.line),
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (_query.trim().length < 2)
          const EmptyState(
            icon: Icons.person_search_outlined,
            title: 'ابدأ البحث',
            message: 'اكتب حرفين على الأقل لعرض الزبائن المطابقين.',
          )
        else
          AsyncView<List<CustomerProfile>>(
            value: results,
            onRetry: () => ref.invalidate(customerSearchProvider(_query)),
            skeleton: const SkeletonList(count: 3, padding: EdgeInsets.zero),
            data: (list) {
              if (list.isEmpty) {
                return const EmptyState(
                  icon: Icons.person_off_outlined,
                  title: 'لا يوجد زبون مطابق',
                  message: 'جرّب الاسم أو رقم الهاتف، أو سجّل زبوناً جديداً.',
                );
              }
              return Column(
                children: [
                  for (final c in list)
                    _CustomerTile(customer: c, onTap: () => _pick(c)),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _CustomerTile extends StatelessWidget {
  const _CustomerTile({required this.customer, required this.onTap});

  final CustomerProfile customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = customer.fullName.isNotEmpty ? customer.fullName[0] : '؟';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          onTap: onTap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          ),
          leading: CircleAvatar(
            backgroundColor: AppColors.navy50,
            child: Text(
              initial,
              style: const TextStyle(
                color: AppColors.navy600,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          title: Text(
            customer.fullName.isEmpty ? 'بدون اسم' : customer.fullName,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 2),
              Text(
                customer.phone,
                textDirection: TextDirection.ltr,
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
              if (customer.district.isNotEmpty)
                Text(
                  customer.district,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              // رمز QR للخزّان لتمييز الزبائن المتشابهين بالاسم (يطابق Expo).
              if (customer.tanks.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(
                    children: [
                      const Icon(Icons.qr_code_2,
                          size: 12, color: AppColors.muted),
                      const SizedBox(width: 3),
                      Text(
                        customer.tanks.first.qrCode,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
        ),
      ),
    );
  }
}

class _WalkinForm extends ConsumerStatefulWidget {
  const _WalkinForm({required this.customer, required this.onBack});

  final CustomerProfile customer;
  final VoidCallback onBack;

  @override
  ConsumerState<_WalkinForm> createState() => _WalkinFormState();
}

class _WalkinFormState extends ConsumerState<_WalkinForm> {
  late final TextEditingController _amountController;
  final _litersController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(
      text: widget.customer.refillPriceIqd > 0
          ? widget.customer.refillPriceIqd.toString()
          : '',
    );
    // لترات افتراضية 500 وإلزامية — تصحّ تقارير الإيراد/الحجم (يطابق Expo).
    _litersController.text = '500';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _litersController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    FocusScope.of(context).unfocus();
    final amount = int.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      showSnack(context, 'أدخل مبلغاً أكبر من صفر', error: true);
      return;
    }
    // اللترات إلزامية (>0) لصحّة تقارير الإيراد/الحجم لدى المعمل (يطابق Expo).
    final liters = int.tryParse(_litersController.text.trim());
    if (liters == null || liters <= 0) {
      showSnack(context, 'أدخل عدد لترات صحيحاً (أكبر من صفر)', error: true);
      return;
    }

    setState(() => _submitting = true);
    Map<String, dynamic>? pendingBody;
    try {
      final coords = await ref.read(locationServiceProvider).currentCoords();
      if (!mounted) return;
      if (coords == null) {
        showSnack(context, 'الموقع غير متاح — فعّل خدمات الموقع', error: true);
        return;
      }

      final input = WalkinRefillInput(
        customerId: widget.customer.id,
        paymentMethod: PaymentMethod.cash,
        paidAmountIqd: amount,
        completionLng: coords.lng,
        completionLat: coords.lat,
        walkinLiters: liters,
        // مفتاح ثابت للإرسال المباشر وللطابور معاً → الخادم يُزيل أي تكرار.
        clientRequestId: newClientRequestId(),
      );
      pendingBody = input.toJson();
      await ref.read(ordersRepositoryProvider).walkinRefill(input);
      if (!mounted) return;

      ref.invalidate(historyProvider);
      ref.invalidate(cashSummaryProvider);
      ref.invalidate(todayTasksProvider);
      showSnack(context, 'تمّت تعبئة ${widget.customer.fullName} بنجاح');
      widget.onBack();
    } on ApiException catch (e) {
      // فشل شبكة → احفظ البيع في الطابور (لا يُفقَد).
      if (e.isNetwork && pendingBody != null) {
        // مفتاح إزالة التكرار = الزبون + المبلغ → بيعان متطابقان أوفلاين لنفس
        // الزبون لا يُدرَجان مرّتين (منع مزدوج شحن البيع الفوري على العميل).
        await ref.read(offlineQueueProvider).enqueue(
              'POST',
              '/orders/walkin-refill',
              pendingBody,
              dedupeKey: 'walkin:${widget.customer.id}:$amount',
            );
        if (!mounted) return;
        ref.invalidate(historyProvider);
        showSnack(context,
            'لا يوجد اتصال — حُفظ البيع وسيُرسَل تلقائياً عند عودة الشبكة.');
        widget.onBack();
        return;
      }
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: _submitting ? null : widget.onBack,
            icon: const Icon(Icons.arrow_forward, size: 18),
            label: const Text('رجوع للبحث'),
          ),
        ),
        const SizedBox(height: 4),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                c.fullName.isEmpty ? 'بدون اسم' : c.fullName,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                c.phone,
                textDirection: TextDirection.ltr,
                style: const TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              if (c.addressLine.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  c.addressLine,
                  style: const TextStyle(fontSize: 13, color: AppColors.slate),
                ),
              ],
              // رمز QR للخزّان لتأكيد الخزّان الصحيح (يطابق Expo).
              if (c.tanks.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.qr_code_2,
                        size: 15, color: AppColors.slate),
                    const SizedBox(width: 4),
                    Text(
                      c.tanks.map((t) => t.qrCode).join(' · '),
                      style:
                          const TextStyle(fontSize: 13, color: AppColors.slate),
                    ),
                  ],
                ),
              ],
              // آخر تعبئة — سياق للسائق قبل البيع الفوري (يطابق Expo).
              if (c.lastRefillAt != null) ...[
                const SizedBox(height: 4),
                Text(
                  'آخر تعبئة: ${Fmt.arabicDate(c.lastRefillAt!)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
              // نتائج البحث لا تحمل سعر المعمل (refillPriceIqd خاصّ بـ /customers/me)،
              // فلا نعرض «0 د.ع» مضلِّلاً — نُظهر الصفّ فقط حين يتوفّر سعر فعلي.
              if (c.refillPriceIqd > 0) ...[
                const SizedBox(height: 12),
                const Divider(height: 1, color: AppColors.line),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('السعر الافتراضي',
                        style: TextStyle(fontSize: 13, color: AppColors.slate)),
                    Text(Fmt.iqd(c.refillPriceIqd),
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: AppColors.water600)),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          child: Column(
            children: [
              LabeledField(
                label: 'المبلغ المدفوع (د.ع)',
                controller: _amountController,
                hint: '1000',
                keyboardType: TextInputType.number,
                prefixIcon: Icons.payments_outlined,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'عدد اللترات',
                controller: _litersController,
                hint: '500',
                keyboardType: TextInputType.number,
                prefixIcon: Icons.opacity_outlined,
              ),
              const SizedBox(height: 8),
              const Row(
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 16, color: AppColors.success),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'دفع نقدي عند التسليم — يُلتقط الموقع تلقائياً.',
                      style: TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        LoadingButton(
          label: 'أكّد البيع',
          icon: Icons.check,
          loading: _submitting,
          onPressed: _submitting ? null : _confirm,
        ),
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// (ب) تبويب تسجيل زبون جديد ميدانياً
// ════════════════════════════════════════════════════════════════════════

class _RegisterTab extends ConsumerStatefulWidget {
  const _RegisterTab();

  @override
  ConsumerState<_RegisterTab> createState() => _RegisterTabState();
}

class _RegisterTabState extends ConsumerState<_RegisterTab> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _districtController = TextEditingController();
  final _addressController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _districtController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final district = _districtController.text.trim();
    final address = _addressController.text.trim();

    if (name.isEmpty || phone.isEmpty || district.isEmpty || address.isEmpty) {
      showSnack(context, 'يرجى ملء جميع الحقول', error: true);
      return;
    }
    if (!Validators.isPhone(phone)) {
      showSnack(context, 'رقم الهاتف غير صحيح', error: true);
      return;
    }

    setState(() => _submitting = true);
    Map<String, dynamic>? pendingBody;
    try {
      final coords = await ref.read(locationServiceProvider).currentCoords();
      if (!mounted) return;
      if (coords == null) {
        showSnack(context, 'الموقع غير متاح — فعّل خدمات الموقع', error: true);
        return;
      }

      final input = RegisterCustomerInput(
        fullName: name,
        phone: phone,
        district: district,
        addressLine: address,
        locationLng: coords.lng,
        locationLat: coords.lat,
      );
      pendingBody = input.toJson();
      await ref.read(customerRepositoryProvider).registerByDriver(input);
      if (!mounted) return;

      showSnack(context, 'تم إرسال طلب التسجيل — سيراجعه المعمل ويوافق');
      _nameController.clear();
      _phoneController.clear();
      _districtController.clear();
      _addressController.clear();
    } on ApiException catch (e) {
      // فشل شبكة → احفظ التسجيل في الطابور (لا يُفقَد).
      if (e.isNetwork && pendingBody != null) {
        await ref
            .read(offlineQueueProvider)
            .enqueue('POST', '/customers/register-by-driver', pendingBody);
        if (!mounted) return;
        showSnack(context,
            'لا يوجد اتصال — حُفظ التسجيل وسيُرسَل تلقائياً عند عودة الشبكة.');
        _nameController.clear();
        _phoneController.clear();
        _districtController.clear();
        _addressController.clear();
        return;
      }
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const Text(
          'سجّل زبوناً جديداً ميدانياً — يُلتقط موقعه تلقائياً ويراجعه المعمل.',
          style: TextStyle(fontSize: 13, color: AppColors.slate),
        ),
        const SizedBox(height: 12),
        SectionCard(
          child: Column(
            children: [
              LabeledField(
                label: 'الاسم الكامل',
                controller: _nameController,
                hint: 'مثال: أحمد علي',
                prefixIcon: Icons.person_outline,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'رقم الهاتف',
                controller: _phoneController,
                hint: '07XXXXXXXXX',
                keyboardType: TextInputType.phone,
                maxLength: 11,
                prefixIcon: Icons.phone_outlined,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'الحي / المنطقة',
                controller: _districtController,
                hint: 'مثال: الجزائر',
                prefixIcon: Icons.location_city_outlined,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'العنوان التفصيلي',
                controller: _addressController,
                hint: 'أقرب نقطة دالة',
                prefixIcon: Icons.home_outlined,
                textInputAction: TextInputAction.done,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.navy50,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, size: 18, color: AppColors.navy600),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'سيُلتقط الموقع الحالي كعنوان البيت، ويراجع المعمل البيانات '
                  'ثم يوافق ويجدول توصيل الخزان.',
                  style: TextStyle(
                      fontSize: 12, color: AppColors.slate, height: 1.5),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        LoadingButton(
          label: 'أرسل للمعمل',
          icon: Icons.send_outlined,
          loading: _submitting,
          onPressed: _submitting ? null : _submit,
        ),
      ],
    );
  }
}
