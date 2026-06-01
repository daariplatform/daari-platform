import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// حقل إدخال رمز OTP من 6 خانات — حقل واحد مُنسَّق بفراغ أحرف واسع.
/// عند اكتمال 6 أرقام يستدعي [onCompleted].
class OtpCodeField extends StatelessWidget {
  const OtpCodeField({
    super.key,
    required this.controller,
    this.error = false,
    this.onChanged,
    this.onCompleted,
  });

  final TextEditingController controller;
  final bool error;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onCompleted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      autofocus: true,
      maxLength: 6,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      style: const TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.w800,
        letterSpacing: 14,
        color: AppColors.ink,
      ),
      decoration: InputDecoration(
        counterText: '',
        hintText: '------',
        filled: true,
        fillColor: Colors.white,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusInput),
          borderSide: BorderSide(color: error ? AppColors.danger : AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusInput),
          borderSide: BorderSide(
              color: error ? AppColors.danger : AppColors.navy600, width: 1.5),
        ),
      ),
      onChanged: (v) {
        onChanged?.call(v);
        if (v.length == 6) onCompleted?.call(v);
      },
    );
  }
}
