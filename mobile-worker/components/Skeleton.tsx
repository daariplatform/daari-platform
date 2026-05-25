/**
 * Skeleton loader — placeholder متحرك بدل ActivityIndicator.
 * يعطي إحساس "الصفحة تتحمّل، البيانات قادمة" بدلاً من spinner عام.
 */

import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export function Skeleton({
  width,
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius,
          backgroundColor: '#e2e8f0',
        } as any,
        animStyle,
        style,
      ]}
    />
  );
}

/** Skeleton card — بشكل صف مهمّة (avatar + نص + chevron) لتُحاكي قائمة tasks/history. */
export function SkeletonCard({ height = 88 }: { height?: number }) {
  return (
    <View
      style={{
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        height,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      }}
    >
      <View className="flex-row-reverse items-center" style={{ gap: 12 }}>
        <Skeleton width={44} height={44} borderRadius={14} />
        <View style={{ flex: 1 }}>
          <Skeleton width={'60%'} height={14} />
          <Skeleton width={'40%'} height={10} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={20} height={20} borderRadius={6} />
      </View>
    </View>
  );
}
