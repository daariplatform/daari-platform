/**
 * RainBackground — خلفية متحركة بقطرات ماء تنزل من فوق.
 * يستعمل في Login + Home لإضافة "حياة" للشاشة.
 *
 * Pure SVG + Reanimated، خفيف جداً (~12 قطرة، 60fps).
 */

import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

function Drop({ delay, leftPct, size, duration, opacity }: {
  delay: number;
  leftPct: number;
  size: number;
  duration: number;
  opacity: number;
}) {
  const translateY = useSharedValue(-50);
  const dropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(height + 50, { duration, easing: Easing.in(Easing.quad) }),
        -1,
        false,
      ),
    );
    dropOpacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(opacity, { duration: duration * 0.3 }),
        -1,
        true,
      ),
    );
  }, [delay, duration, opacity, translateY, dropOpacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: dropOpacity.value,
  }));

  const id = `drop-${size}-${leftPct}`;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${leftPct}%`,
          top: 0,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width={size} height={size * 1.4} viewBox="0 0 20 28">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
          </LinearGradient>
        </Defs>
        <Path d="M10 0 C10 0, 2 12, 2 18 C2 23, 6 27, 10 27 C14 27, 18 23, 18 18 C18 12, 10 0, 10 0 Z" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Rain layer — ١٢ قطرة متفاوتة الحجم والسرعة، تتجدد بشكل لانهائي.
 */
export function RainBackground({ density = 'medium' }: { density?: 'light' | 'medium' | 'heavy' }) {
  const count = density === 'light' ? 8 : density === 'heavy' ? 18 : 12;

  // توزيع شبه عشوائي (deterministic لتفادي flicker على re-render)
  const drops = Array.from({ length: count }, (_, i) => ({
    leftPct: ((i * 37) % 100),
    size: 6 + ((i * 13) % 8),
    delay: (i * 350) % 4000,
    duration: 2800 + ((i * 470) % 2000),
    opacity: 0.18 + ((i * 7) % 4) * 0.04,
  }));

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      pointerEvents="none"
    >
      {drops.map((d, i) => (
        <Drop
          key={i}
          delay={d.delay}
          leftPct={d.leftPct}
          size={d.size}
          duration={d.duration}
          opacity={d.opacity}
        />
      ))}
    </View>
  );
}
