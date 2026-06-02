import 'package:dio/dio.dart';

/// اعتراض «وضع العرض» (DEMO_MODE) — يردّ بيانات وهمية دون خادم، منقول من نمط
/// `demo-data.ts` + الفروع التجريبية في `queries.ts`. يُركَّب **أوّلاً** في سلسلة
/// الـ interceptors فيقصر كل طلب ويعيد fixture مناسباً (2xx). مفيد لمراجعة المتجر
/// والعروض دون باك إند. النماذج تتسامح مع الحقول الناقصة (P.* تعطي افتراضيات).
class DemoInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final data = _resolve(options.method.toUpperCase(), options.path);
    handler.resolve(
      Response<dynamic>(
        requestOptions: options,
        statusCode: 200,
        data: data,
      ),
    );
  }

  dynamic _resolve(String method, String path) {
    // المصادقة
    if (path.contains('/auth/login')) return _tokens;
    if (path.contains('/auth/refresh')) return _tokens;
    if (path.contains('/auth/me')) return _me;
    if (path.contains('/auth/logout')) return _empty;
    if (path.contains('/auth/change-password')) return _empty;

    // الزبون
    if (path.contains('/customers/me/active-promo')) return _empty;
    if (path.contains('/customers/me/addresses')) {
      return method == 'GET' ? _emptyList : _empty;
    }
    if (path.contains('/customers/me/schedules')) {
      return method == 'GET' ? _emptyList : _empty;
    }
    if (path.contains('/customers/me')) return _customer;

    // الإشعارات
    if (path.contains('/notifications/me')) return _notifications;
    if (path.contains('/notifications')) return _empty;

    // المعامل
    if (path.contains('/tenants')) return _plant;

    // الطلبات — مسارات السائق (me/...) أولاً ثم العامّة
    if (path.contains('/orders/me/available')) return _emptyList;
    if (path.contains('/orders/me/today')) return _emptyList;
    if (path.contains('/orders/me/history')) return _orders;
    if (path.contains('/orders/me')) return _orders;
    if (path.contains('/orders')) return _orders.first;

    // السائق
    if (path.contains('/drivers/me/cash-summary')) return _cashSummary;
    if (path.contains('/drivers/me/cash-handover')) {
      return method == 'GET' ? _emptyList : _empty;
    }
    if (path.contains('/drivers/me/shift-summary')) return _shiftSummary;
    if (path.contains('/drivers/me/earnings')) return _emptyList;
    if (path.contains('/drivers/me')) return _driver;

    return _empty;
  }

  // ─── fixtures ───────────────────────────────────────────────────────────
  static const _empty = <String, dynamic>{};
  static const _emptyList = <dynamic>[];

  static const _tokens = <String, dynamic>{
    'accessToken': 'demo-access-token',
    'refreshToken': 'demo-refresh-token',
    'expiresIn': 900,
    'capabilities': ['customer', 'driver'],
  };

  static const _me = <String, dynamic>{
    'id': 'demo-user',
    'phone': '07710000001',
    'role': 'CUSTOMER',
    'tenantId': 'demo-tenant',
    'capabilities': ['customer', 'driver'],
    'fullName': 'أم محمد (تجربة)',
  };

  static const _customer = <String, dynamic>{
    'id': 'demo-customer',
    'fullName': 'أم محمد (تجربة)',
    'phone': '07710000001',
    'district': 'الكرادة',
    'addressLine': 'شارع 62، بيت 14',
    'status': 'ACTIVE',
    'totalRefills': 14,
    'balanceIqd': 0,
    'loyaltyPoints': 120,
    'refillPriceIqd': 1000,
    'lastRefillAt': '2026-04-23T10:00:00Z',
    'acceptedTermsAt': '2025-09-12T10:00:00Z',
    'tanks': [
      {
        'id': 'demo-tank',
        'serialNumber': 'T-1024',
        'qrCode': 'MAA-DEMO-A1B2C3D4',
        'capacity': 'L500',
        'status': 'ASSIGNED',
      },
    ],
  };

  static const _orders = <dynamic>[
    {
      'id': 'r-2026-118',
      'status': 'COMPLETED',
      'kind': 'REFILL',
      'priceIqd': 1000,
      'paidAmountIqd': 1000,
      'requestedAt': '2026-04-23T10:00:00Z',
      'completedAt': '2026-04-23T11:30:00Z',
      'driver': {
        'id': 'd1',
        'user': {'fullName': 'كريم السائق'},
      },
    },
    {
      'id': 'r-2026-101',
      'status': 'COMPLETED',
      'kind': 'REFILL',
      'priceIqd': 1000,
      'paidAmountIqd': 1000,
      'requestedAt': '2026-03-25T09:00:00Z',
      'completedAt': '2026-03-25T10:30:00Z',
    },
    {
      'id': 'r-2026-051',
      'status': 'COMPLETED',
      'kind': 'TANK_DELIVERY',
      'priceIqd': 0,
      'paidAmountIqd': 0,
      'requestedAt': '2026-01-02T11:00:00Z',
      'completedAt': '2026-01-02T13:00:00Z',
    },
  ];

  static const _notifications = <String, dynamic>{
    'items': <dynamic>[],
    'unreadCount': 0,
  };

  static const _plant = <String, dynamic>{
    'id': 'demo-tenant',
    'name': 'معمل التجربة',
    'refillPriceIqd': 1000,
  };

  static const _driver = <String, dynamic>{
    'id': 'demo-driver',
    'fullName': 'كريم السائق (تجربة)',
    'phone': '07700000002',
    'status': 'OFFLINE',
  };

  static const _cashSummary = <String, dynamic>{
    'collectedCashIqd': 0,
    'handedOverIqd': 0,
    'pendingIqd': 0,
  };

  static const _shiftSummary = <String, dynamic>{
    'completedOrders': 0,
    'collectedCashIqd': 0,
    'byKind': <String, dynamic>{},
  };
}
