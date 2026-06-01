/**
 * First-run intro carousel flag — persisted in AsyncStorage so the "how
 * Daari works" slides show exactly once, ever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_SEEN_KEY = 'daari-intro-seen-v1';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1';
  } catch {
    // If storage is unreadable, treat as "seen" so we never trap the user
    // in an intro loop.
    return true;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Best-effort; a failed write just means the intro may show again.
  }
}
