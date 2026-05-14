import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Force RTL on app start. RN caches the layout direction on first
 * render — if the OS isn't already in an RTL locale we have to flip
 * it and reload once. Subsequent launches see it already true and
 * skip the reload.
 */
export async function ensureRTL() {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // In Expo Go / dev client this throws; live with it for now.
    }
  }
}
