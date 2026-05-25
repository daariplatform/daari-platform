/**
 * AnimatedLogo — قطرة ماء حية + ripples + lottie + brand name.
 *
 * يستعمل في:
 *   - Splash (auto-play)
 *   - Login hero (auto-play)
 *
 * تصميم:
 *   - قطرة كبيرة تتمايل (bob) للأعلى والأسفل
 *   - 3 ripples تتمدد من حولها بفروقات توقيت
 *   - shine متحرك على القطرة
 *   - النص "داري" يظهر بـ fade + slide-up
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, RadialGradient } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface AnimatedLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

function Ripple({ delay, color = '#bfdbfe' }: { delay: number; color?: string }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }), -1, false),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 200 }),
          withTiming(0, { duration: 2200, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export function AnimatedLogo({
  size = 110,
  showText = true,
  textColor = '#ffffff',
}: AnimatedLogoProps) {
  // Bob (up/down floating)
  const bob = useSharedValue(0);
  // Subtle rotation (sway left/right)
  const sway = useSharedValue(0);
  // Brand text fade
  const textOpacity = useSharedValue(0);
  const textTranslate = useSharedValue(20);

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    textOpacity.value = withDelay(400, withTiming(1, { duration: 700 }));
    textTranslate.value = withDelay(400, withTiming(0, { duration: 700 }));
  }, [bob, sway, textOpacity, textTranslate]);

  const dropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 + bob.value * 16 },
      { rotate: `${-3 + sway.value * 6}deg` },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslate.value }],
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 220,
          height: 220,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ripple delay={0} />
        <Ripple delay={800} />
        <Ripple delay={1600} />

        <Animated.View style={dropStyle}>
          <Svg width={size} height={size * 1.25} viewBox="0 0 100 125">
            <Defs>
              <LinearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#dbeafe" />
                <Stop offset="0.3" stopColor="#60a5fa" />
                <Stop offset="0.7" stopColor="#3b82f6" />
                <Stop offset="1" stopColor="#1d4ed8" />
              </LinearGradient>
              <RadialGradient id="shine" cx="35" cy="40" r="18">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="bottomGreen" x1="0" y1="0.5" x2="0" y2="1">
                <Stop offset="0" stopColor="#3b82f6" stopOpacity="0" />
                <Stop offset="1" stopColor="#10b981" stopOpacity="0.5" />
              </LinearGradient>
            </Defs>

            {/* Drop shape */}
            <Path
              d="M50 6 C50 6, 12 56, 12 80 C12 102, 30 118, 50 118 C70 118, 88 102, 88 80 C88 56, 50 6, 50 6 Z"
              fill="url(#dropGrad)"
            />
            {/* Green water bottom (subtle accent) */}
            <Path
              d="M50 6 C50 6, 12 56, 12 80 C12 102, 30 118, 50 118 C70 118, 88 102, 88 80 C88 56, 50 6, 50 6 Z"
              fill="url(#bottomGreen)"
            />
            {/* Top shine highlight */}
            <Circle cx="38" cy="48" r="20" fill="url(#shine)" />
            {/* Small bright dot */}
            <Circle cx="32" cy="42" r="4" fill="white" fillOpacity="0.9" />
          </Svg>
        </Animated.View>
      </View>

      {showText && (
        <Animated.View style={textStyle}>
          <Text
            style={{
              color: textColor,
              fontSize: 42,
              fontWeight: '900',
              letterSpacing: -1,
              textShadowColor: 'rgba(0,0,0,0.15)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}
          >
            داري
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
