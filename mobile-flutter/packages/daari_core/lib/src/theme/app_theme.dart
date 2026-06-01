import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// ثيم «داري» الموحّد — خط Cairo + ألوان العلامة + زوايا ناعمة.
/// يُطبَّق في كلا التطبيقين عبر `MaterialApp(theme: AppTheme.light())`.
class AppTheme {
  AppTheme._();

  /// نصف قطر موحّد للحاويات (من tailwind: cards=16، inputs=14، hero=26).
  static const double radiusCard = 16;
  static const double radiusInput = 14;
  static const double radiusHero = 26;

  static ThemeData light() {
    final base = ThemeData(useMaterial3: true, brightness: Brightness.light);

    final textTheme = GoogleFonts.cairoTextTheme(base.textTheme).apply(
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    );

    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.navy600,
      primary: AppColors.navy600,
      secondary: AppColors.turquoise500,
      error: AppColors.danger,
      brightness: Brightness.light,
    );

    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.bg,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        foregroundColor: AppColors.ink,
        titleTextStyle: GoogleFonts.cairo(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.ink,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.navy600,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusHero),
          ),
          textStyle: GoogleFonts.cairo(
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: _inputBorder(AppColors.line),
        enabledBorder: _inputBorder(AppColors.line),
        focusedBorder: _inputBorder(AppColors.navy600, width: 1.5),
        errorBorder: _inputBorder(AppColors.danger),
        hintStyle: const TextStyle(color: AppColors.muted),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.line,
        thickness: 1,
        space: 1,
      ),
    );
  }

  static OutlineInputBorder _inputBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(radiusInput),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  /// تدرّج الـ hero الأزرق (headers + CTA الرئيسي).
  static const LinearGradient skyGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [AppColors.navy500, AppColors.navy700],
  );

  /// تدرّج فيروزي (شاشات ثانوية: العناوين، المحفظة...).
  static const LinearGradient tealGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [AppColors.turquoise400, AppColors.turquoise600],
  );
}
