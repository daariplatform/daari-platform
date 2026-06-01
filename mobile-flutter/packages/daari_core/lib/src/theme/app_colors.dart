import 'package:flutter/material.dart';

/// لوحة ألوان «داري» — منقولة حرفياً من `tailwind.config.js`
/// (palette 2026-05-23: أزرق بحري navy + فيروزي turquoise + أخضر ماء water).
///
/// `navy` هو لون التطبيق الرئيسي (hero gradients + CTAs)، اختير لأن إشارة
/// الثقة فيه أقوى من الـ cyan في سياق اشتراك متكرّر.
class AppColors {
  AppColors._();

  // ── navy: اللون الأساسي ──
  static const navy50 = Color(0xFFF0F9FF);
  static const navy100 = Color(0xFFE0F2FE);
  static const navy200 = Color(0xFFBAE6FD);
  static const navy300 = Color(0xFF7DD3FC);
  static const navy400 = Color(0xFF38BDF8);
  static const navy500 = Color(0xFF0EA5E9);
  static const navy600 = Color(0xFF0284C7); // CTA الأساسي
  static const navy700 = Color(0xFF0369A1);
  static const navy800 = Color(0xFF075985);
  static const navy900 = Color(0xFF0C4A6E);

  // ── turquoise: accent للماء + أزرار ثانوية ──
  static const turquoise50 = Color(0xFFF0FDFA);
  static const turquoise100 = Color(0xFFCCFBF1);
  static const turquoise200 = Color(0xFF99F6E4);
  static const turquoise300 = Color(0xFF5EEAD4);
  static const turquoise400 = Color(0xFF2DD4BF);
  static const turquoise500 = Color(0xFF14B8A6);
  static const turquoise600 = Color(0xFF0D9488);
  static const turquoise700 = Color(0xFF0F766E);

  // ── water: نجاح + رصيد موجب + حالة مكتملة ──
  static const water50 = Color(0xFFECFDF5);
  static const water100 = Color(0xFFD1FAE5);
  static const water400 = Color(0xFF34D399);
  static const water500 = Color(0xFF10B981);
  static const water600 = Color(0xFF059669);
  static const water700 = Color(0xFF047857);

  // ── حالات ──
  static const warn400 = Color(0xFFFBBF24);
  static const warn500 = Color(0xFFF59E0B); // قيد الانتظار / EN_ROUTE
  static const warn600 = Color(0xFFD97706);
  static const danger400 = Color(0xFFF87171);
  static const danger500 = Color(0xFFEF4444); // أخطاء / إلغاء / فشل
  static const danger600 = Color(0xFFDC2626);

  // ── محايدات (من تطبيق السائق) ──
  static const ink = Color(0xFF0F172A); // نص أساسي داكن
  static const slate = Color(0xFF475569); // نص ثانوي
  static const muted = Color(0xFF94A3B8); // نص خافت
  static const line = Color(0xFFE2E8F0); // حدود / فواصل
  static const bg = Color(0xFFF6F8FA); // خلفية الشاشات

  // ── أسماء دلالية (استعملها بدل الأرقام) ──
  static const primary = navy600;
  static const accent = turquoise500;
  static const success = water500;
  static const warning = warn500;
  static const danger = danger500;
}
