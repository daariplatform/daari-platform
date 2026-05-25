import * as SecureStore from 'expo-secure-store';

/**
 * JWT tokens live in the iOS keychain / Android keystore, never in plain
 * AsyncStorage. SecureStore handles encryption transparently.
 */
const ACCESS_KEY = 'maa.access';
const REFRESH_KEY = 'maa.refresh';

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
