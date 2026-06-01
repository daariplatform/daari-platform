/// التعدادات — منقولة من string-unions في `lib/types.ts` ومن `schema.prisma`.
/// كلٌّ منها يحمل `value` (قيمة JSON الخام) و`label` عربي للعرض حيث يلزم.
library;

/// قدرات المستخدم (تُحسَب في الباك إند وتُرسَل في JWT و /auth/me).
enum Capability {
  customer('customer'),
  driver('driver'),
  vendor('vendor'),
  plantAdmin('plant_admin'),
  platformAdmin('platform_admin');

  const Capability(this.value);
  final String value;

  static Capability? fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return null;
  }
}

/// يحوّل مصفوفة JSON إلى قائمة قدرات (يتجاهل غير المعروف).
List<Capability> capabilitiesFromJson(Object? raw) {
  if (raw is! List) return const [];
  final out = <Capability>[];
  for (final e in raw) {
    final c = Capability.fromValue(e?.toString());
    if (c != null) out.add(c);
  }
  return out;
}

/// حالة الطلب — الدورة: PENDING → ASSIGNED → EN_ROUTE → COMPLETED.
enum RefillOrderStatus {
  pending('PENDING', 'قيد الانتظار'),
  assigned('ASSIGNED', 'تم الإسناد'),
  enRoute('EN_ROUTE', 'في الطريق'),
  completed('COMPLETED', 'مكتمل'),
  cancelled('CANCELLED', 'ملغى'),
  failed('FAILED', 'فشل');

  const RefillOrderStatus(this.value, this.label);
  final String value;
  final String label;

  /// قيمة افتراضية آمنة (pending) عند ورود حالة غير معروفة.
  static RefillOrderStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return RefillOrderStatus.pending;
  }

  /// طلب «حيّ» لم يُغلَق بعد (يُظهَر زر المتابعة/التتبّع).
  bool get isActive => this == pending || this == assigned || this == enRoute;
}

/// نوع الطلب.
enum RefillOrderKind {
  refill('REFILL', 'تعبئة'),
  tankDelivery('TANK_DELIVERY', 'توصيل خزان'),
  tankReclaim('TANK_RECLAIM', 'استرجاع خزان'),
  walkinSale('WALKIN_SALE', 'بيع فوري');

  const RefillOrderKind(this.value, this.label);
  final String value;
  final String label;

  static RefillOrderKind fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return RefillOrderKind.refill;
  }
}

/// سعة الخزان.
enum TankCapacity {
  l350('L350', '٣٥٠ لتر'),
  l500('L500', '٥٠٠ لتر');

  const TankCapacity(this.value, this.label);
  final String value;
  final String label;

  static TankCapacity fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return TankCapacity.l500;
  }
}

/// حالة الخزان.
enum TankStatus {
  inPlant('IN_PLANT', 'في المعمل'),
  assigned('ASSIGNED', 'مُسنَد'),
  atRisk('AT_RISK', 'معرّض للخطر'),
  reclaimed('RECLAIMED', 'مُسترجَع'),
  damaged('DAMAGED', 'تالف');

  const TankStatus(this.value, this.label);
  final String value;
  final String label;

  static TankStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return TankStatus.inPlant;
  }
}

/// حالة الزبون.
enum CustomerStatus {
  pendingApproval('PENDING_APPROVAL', 'بانتظار الموافقة'),
  active('ACTIVE', 'نشط'),
  atRisk('AT_RISK', 'معرّض للخطر'),
  inactive('INACTIVE', 'غير نشط'),
  churned('CHURNED', 'منسحب');

  const CustomerStatus(this.value, this.label);
  final String value;
  final String label;

  static CustomerStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return CustomerStatus.active;
  }
}
