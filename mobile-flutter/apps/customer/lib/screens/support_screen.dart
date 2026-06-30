import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/common.dart';

/// شاشة الدعم والمساعدة — بطاقات تواصل (اتصال/واتساب) + أسئلة شائعة.
class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  static const String _phone = '07752222558';
  static const String _email = 'info@phi-bit.com';

  Future<void> _whatsapp(BuildContext context, String text) async {
    final ok = await Launchers.whatsapp(_phone, text: text);
    if (!ok && context.mounted) {
      showSnack(context,
          'تعذّر فتح واتساب — تأكّد من تثبيته أو راسلنا عبر البريد.',
          error: true);
    }
  }

  Future<void> _emailSupport(
      BuildContext context, String subject, String body) async {
    final ok = await Launchers.email(_email, subject: subject, body: body);
    if (!ok && context.mounted) {
      showSnack(context, 'تعذّر فتح تطبيق البريد. حاول لاحقاً.', error: true);
    }
  }

  /// «أبلغ عن مشكلة» — ورقة سفلية باختيار القناة (واتساب / بريد).
  void _reportProblem(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text('أبلغ عن مشكلة',
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.chat, color: AppColors.success),
              title: const Text('عبر واتساب'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _whatsapp(context,
                    'أرغب بالإبلاغ عن مشكلة في تطبيق داري:\n\n(صف المشكلة هنا)');
              },
            ),
            ListTile(
              leading: const Icon(Icons.email_outlined,
                  color: AppColors.navy600),
              title: const Text('عبر البريد الإلكتروني'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _emailSupport(context, 'مشكلة في تطبيق داري',
                    'صف المشكلة هنا:\n\n');
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('الدعم والمساعدة')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: _ContactCard(
                  icon: Icons.phone_in_talk,
                  title: 'اتصل بنا',
                  subtitle: _phone,
                  color: AppColors.navy600,
                  onTap: () => Launchers.call(_phone),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ContactCard(
                  icon: Icons.chat,
                  title: 'واتساب',
                  subtitle: 'رد سريع',
                  color: AppColors.success,
                  onTap: () => _whatsapp(context, 'مرحباً، أحتاج مساعدة'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _reportProblem(context),
              icon: const Icon(Icons.report_problem_outlined,
                  color: AppColors.warn600),
              label: const Text('أبلغ عن مشكلة',
                  style: TextStyle(color: AppColors.warn600)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.warn600),
                minimumSize: const Size.fromHeight(48),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'الأسئلة الشائعة',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 12),
          const _FaqCard(
            question: 'كيف أطلب تعبئة الخزان؟',
            answer:
                'من الشاشة الرئيسية اضغط زرّ «اطلب تعبئة الآن». سيصلك سائق إلى '
                'عنوانك المسجّل، ويمكنك متابعة الطلب لحظة بلحظة من شاشة «طلباتي».',
          ),
          const _FaqCard(
            question: 'كيف أدفع ثمن التعبئة؟',
            answer:
                'الدفع نقداً عند استلام التعبئة. سلّم المبلغ للسائق عند وصوله، '
                'وسيظهر السعر على زرّ الطلب في الشاشة الرئيسية قبل التأكيد.',
          ),
          const _FaqCard(
            question: 'كيف أتتبّع السائق؟',
            answer:
                'بعد تعيين سائق لطلبك يظهر تقدير زمني للوصول، ويمكنك متابعة موقعه '
                'على الخريطة من تفاصيل الطلب. يتحدّث التقدير تلقائياً أثناء الطريق.',
          ),
          const _FaqCard(
            question: 'كيف أغيّر عنوان التوصيل؟',
            answer:
                'من «حسابي» → «عناويني المحفوظة» يمكنك إضافة عناوين متعددة (البيت، '
                'العمل) وتعيين العنوان الافتراضي الذي يصل إليه السائق.',
          ),
          const _FaqCard(
            question: 'هل يمكنني إلغاء الطلب؟',
            answer:
                'نعم، ما دام الطلب قيد الانتظار أو قبل وصول السائق. افتح الطلب من '
                '«طلباتي» واضغط «إلغاء الطلب». بعد التسليم لا يمكن الإلغاء.',
          ),
          const _FaqCard(
            question: 'ما هي التعبئة التلقائية؟',
            answer:
                'جدولة تُنشئ طلب تعبئة تلقائياً كل فترة تختارها (أسبوعياً/شهرياً) '
                'حتى لا تنسى. فعّلها من «حسابي» → «الجدولة التلقائية».',
          ),
          const _FaqCard(
            question: 'نسيت كلمة المرور، ماذا أفعل؟',
            answer:
                'من شاشة تسجيل الدخول اضغط «نسيت كلمة السر؟»، أدخل رقمك ليصلك رمز '
                'عبر واتساب/رسالة، ثم عيّن كلمة سر جديدة وستدخل تلقائياً.',
          ),
          const SizedBox(height: 24),
          _StillNeedHelp(
            onTap: () => _whatsapp(context, 'مرحباً، أحتاج مساعدة'),
          ),
        ],
      ),
    );
  }
}

/// بطاقة تواصل ملوّنة (اتصال / واتساب).
class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
          child: Column(
            children: [
              Icon(icon, color: Colors.white, size: 30),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// عنصر سؤال شائع قابل للطيّ.
class _FaqCard extends StatelessWidget {
  const _FaqCard({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          iconColor: AppColors.water600,
          collapsedIconColor: AppColors.muted,
          leading: const Icon(Icons.help_outline, color: AppColors.water600),
          title: Text(
            question,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.ink,
            ),
          ),
          children: [
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                answer,
                style: const TextStyle(
                  color: AppColors.slate,
                  fontSize: 13,
                  height: 1.7,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// بطاقة ختامية: لم تجد إجابتك؟
class _StillNeedHelp extends StatelessWidget {
  const _StillNeedHelp({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.navy50,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      ),
      child: Column(
        children: [
          const Icon(Icons.support_agent, color: AppColors.water600, size: 32),
          const SizedBox(height: 8),
          const Text(
            'لم تجد إجابتك؟',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 15,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'تواصل معنا مباشرة وسنردّ عليك في أسرع وقت',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, fontSize: 13),
          ),
          const SizedBox(height: 16),
          LoadingButton(
            label: 'راسلنا عبر واتساب',
            icon: Icons.chat,
            color: AppColors.success,
            onPressed: onTap,
          ),
        ],
      ),
    );
  }
}
