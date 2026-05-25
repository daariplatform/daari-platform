/**
 * Haptic feedback wrapper — اهتزاز خفيف عند الضغط.
 * يصمت بأمان على المحاكي أو الـ web.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const hap = {
  /** عند الضغط على زر عادي */
  tap() {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  },
  /** عند ضغطة مهمة (تأكيد، تنفيذ) */
  press() {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** عند نجاح حدث (طلب أُكّد، حفظ بنجاح) */
  success() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** عند خطأ */
  error() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  /** تحذير */
  warning() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
