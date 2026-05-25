/**
 * Push notifications setup — يطلب صلاحية، يجلب FCM token، يرسله للـ backend.
 *
 * يُستدعى عند:
 *   - أول login (في auth-store)
 *   - بعد onboarding
 *   - reload app (للتأكد أن الـ token الحالي محدّث)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * يطلب صلاحية + يجلب push token + يرسله للسيرفر.
 * يُرجع true لو نجح، false لو الصلاحية رُفضت أو فشل شيء.
 */
export async function registerForPushNotifications(): Promise<boolean> {
  // الـ simulator على iOS لا يدعم push — تجاوزه بصمت
  if (!Device.isDevice) {
    console.log('[push] simulator detected, skipping');
    return false;
  }

  // تحضير قناة Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'الإشعارات العامة',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0891b2',
    });
  }

  // طلب الصلاحية إن لم تكن مُعطاة
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') {
    console.log('[push] permission denied');
    return false;
  }

  // جلب الـ token
  try {
    // Expo push token works on both iOS + Android via Expo's relay → APNs/FCM.
    // Simpler than juggling FCM credentials per-platform.
    const result = await Notifications.getExpoPushTokenAsync();
    const token = result.data;
    console.log('[push] expo token acquired');
    await api
      .post('/notifications/push-token', {
        token,
        platform: Platform.OS as 'ios' | 'android',
      })
      .catch((err) => {
        console.warn('[push] failed to register token with server:', err?.message);
      });
    return true;
  } catch (err) {
    console.error('[push] getExpoPushTokenAsync failed:', err);
    return false;
  }
}

/** Listener — يُستدعى لما الإشعار يصل والـ app في foreground */
export function setupNotificationListener(
  onReceive: (notification: Notifications.Notification) => void,
  onTap: (response: Notifications.NotificationResponse) => void,
) {
  const subReceive = Notifications.addNotificationReceivedListener(onReceive);
  const subTap = Notifications.addNotificationResponseReceivedListener(onTap);
  return () => {
    subReceive.remove();
    subTap.remove();
  };
}
