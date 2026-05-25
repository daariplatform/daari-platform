/**
 * Lottie-powered animated water drop hero.
 *
 * يلعب JSON animation من assets/lottie/water-drop.json — قطرة ماء تتحرّك
 * عمودياً مع ripples تتمدد حولها. Vector، loops تلقائياً.
 *
 * يستعمل في:
 *   - Splash screen (شاشة بداية)
 *   - Login screen (Hero)
 *   - Onboarding
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

export function WaterDropHero({
  size = 200,
  autoPlay = true,
  loop = true,
  style,
}: {
  size?: number;
  autoPlay?: boolean;
  loop?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <LottieView
        source={require('../assets/lottie/water-drop.json')}
        autoPlay={autoPlay}
        loop={loop}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
