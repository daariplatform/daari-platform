/// داري — الحزمة المشتركة (daari_core).
///
/// صدّر كل الواجهات العامة: الإعدادات، التصميم، التنسيق، النماذج،
/// طبقة الـ API، المصادقة، والخدمات. التطبيقات تستورد
/// `package:daari_core/daari_core.dart`.
library;

// الإعدادات
export 'src/config/env.dart';

// التصميم
export 'src/theme/app_colors.dart';
export 'src/theme/app_theme.dart';

// التنسيق + التحقّق
export 'src/format/format.dart';
export 'src/format/validators.dart';

// أدوات
export 'src/util/local_flags.dart';

// النماذج
export 'src/models/enums.dart';
export 'src/models/parse.dart';
export 'src/models/auth_response.dart';
export 'src/models/me_response.dart';
export 'src/models/tank.dart';
export 'src/models/customer_profile.dart';
export 'src/models/refill_order.dart';
export 'src/models/order_rating.dart';
export 'src/models/order_inputs.dart';
export 'src/models/active_promo.dart';
export 'src/models/saved_address.dart';
export 'src/models/refill_schedule.dart';
export 'src/models/nearest_plant.dart';
export 'src/models/driver_profile.dart';
export 'src/models/driver_task.dart';
export 'src/models/live_driver.dart';
export 'src/models/cash.dart';
export 'src/models/earnings.dart';
export 'src/models/app_notification.dart';
// نماذج الإدارة (لوحة المعمل)
export 'src/models/paged_result.dart';
export 'src/models/plant_kpis.dart';
export 'src/models/water_stock.dart';
export 'src/models/plant_usage.dart';
export 'src/models/audit_log.dart';
export 'src/models/driver_performance.dart';
export 'src/models/activity_event.dart';
export 'src/models/promo_notification.dart';
export 'src/models/promo_campaign.dart';
export 'src/models/plant_reports.dart';
export 'src/models/team_member.dart';
export 'src/models/onboarding_status.dart';

// طبقة الـ API
export 'src/api/api_exception.dart';
export 'src/api/api_client.dart';
export 'src/api/response_cache.dart';
export 'src/api/orders_repository.dart';
export 'src/api/customer_repository.dart';
export 'src/api/driver_repository.dart';
export 'src/api/tenants_repository.dart';
export 'src/api/notifications_repository.dart';
// repositories الإدارة (لوحة المعمل)
export 'src/api/plant_repository.dart';
export 'src/api/promo_repository.dart';
export 'src/api/reports_repository.dart';
export 'src/api/team_repository.dart';
export 'src/api/onboarding_repository.dart';

// المصادقة
export 'src/auth/token_storage.dart';
export 'src/auth/auth_repository.dart';
export 'src/auth/auth_state.dart';
export 'src/auth/auth_controller.dart';

// الخدمات
export 'src/services/biometric_service.dart';
export 'src/services/location_service.dart';
export 'src/services/push_service.dart';
export 'src/services/launchers.dart';
export 'src/services/offline_queue.dart';
export 'src/services/crash_reporting.dart';
export 'src/services/haptics.dart';
export 'src/services/analytics.dart';

// عناصر واجهة مشتركة
export 'src/widgets/animated_counter.dart';
export 'src/widgets/rain_background.dart';
export 'src/widgets/refill_status_strip.dart';
export 'src/widgets/skeleton.dart';

// المزوّدات
export 'src/providers/core_providers.dart';
