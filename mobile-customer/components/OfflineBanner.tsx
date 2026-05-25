/**
 * Slim red strip at the top of the app indicating "you are offline; data
 * shown is from cache". Auto-hides when the connection returns.
 *
 * Mounted in app/_layout.tsx so it overlays every screen.
 */

import { useEffect, useState } from 'react';
import { View, Text, Platform, StatusBar } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // NetInfo reports `isConnected = null` during the very first event;
    // we only flag offline when we have a definitive `false`.
    const handle = (state: NetInfoState) => {
      const isOnline =
        state.isConnected !== false &&
        state.isInternetReachable !== false;
      setOffline(!isOnline);
    };
    const unsub = NetInfo.addEventListener(handle);
    NetInfo.fetch().then(handle).catch(() => {});
    return () => unsub();
  }, []);

  if (!offline) return null;

  // Sit below the OS status bar on Android (no SafeAreaView edge here —
  // mounted outside of one. iOS handles via paddingTop matching status bar.)
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <View
      style={{
        paddingTop: topPad,
        backgroundColor: '#dc2626',
        zIndex: 9999,
      }}
    >
      <Text
        style={{
          color: 'white',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '700',
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}
        numberOfLines={1}
      >
        أنت غير متصل بالإنترنت — تعرض بيانات محفوظة
      </Text>
    </View>
  );
}
