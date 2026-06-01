import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/common.dart';

/// شاشة الدعم والمساعدة — بطاقات تواصل (اتصال/واتساب) + أسئلة شائعة.
class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  static const String _phone = '07752222558';

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
                  onTap: () => Launchers.whatsapp(
                    _phone,
                    text: 'مرحباً، أحتاج مساعدة',
                  ),
                ),
              ),
            ],
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
          const SizedBox(height: 24),
          _StillNeedHelp(
            onTap: () => Launchers.whatsapp(
              _phone,
              text: 'مرحباً، أحتاج مساعدة',
            ),
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
