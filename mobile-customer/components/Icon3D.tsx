/**
 * Icon3D — أيقونة مع gradient + shadow → إحساس 3D (clay/fluent).
 *
 * تستعمل Ionicons من @expo/vector-icons (موجود مسبقاً، مستقر تماماً).
 * Vector، حجم 0 KB في الـ bundle، تحكّم كامل بالألوان.
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Icon3DProps {
  icon: IoniconName;
  size?: number;
  light?: string;
  dark?: string;
  iconColor?: string;
  style?: ViewStyle;
}

export function Icon3D({
  icon,
  size = 80,
  light = '#22d3ee',
  dark = '#0e7490',
  iconColor = '#ffffff',
  style,
}: Icon3DProps) {
  const id = `icon3d-${size}-${light}-${dark}`.replace(/[^a-zA-Z0-9]/g, '');
  const iconSize = size * 0.55;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: dark,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="1" stopColor={dark} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
        <Circle cx={size / 2} cy={size * 0.35} r={size * 0.3} fill="white" opacity={0.12} />
      </Svg>
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </View>
  );
}
