/**
 * StatusChip — the pill-shaped badge that communicates state.
 *
 * Used on:
 *   - order rows ("مكتمل" / "في الطريق" / "ملغى")
 *   - customer rows ("نشط" / "بانتظار الموافقة")
 *   - team members ("المالك" / "مدير" / "محاسب")
 *   - tank rows ("مع زبون" / "في المعمل")
 *
 * Tone maps to the semantic state palette in theme.ts so the visual
 * language stays consistent: green-ish = good, amber = attention,
 * rose = bad, slate = neutral.
 */

import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ChipSize = 'sm' | 'md';

export interface StatusChipProps {
  label: string;
  tone?: ChipTone;
  size?: ChipSize;
  icon?: IconName;
  style?: ViewStyle;
}

export function StatusChip({
  label,
  tone = 'neutral',
  size = 'md',
  icon,
  style,
}: StatusChipProps) {
  const palette = theme.color.state[tone];

  const dim = {
    sm: { fontSize: 10, paddingV: 3, paddingH: 8, iconSize: 12 },
    md: { fontSize: 11, paddingV: 5, paddingH: 10, iconSize: 14 },
  }[size];

  return (
    <View
      style={[
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: theme.radius.pill,
          paddingVertical: dim.paddingV,
          paddingHorizontal: dim.paddingH,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon && <MaterialIcons name={icon} size={dim.iconSize} color={palette.fg} />}
      <Text
        style={{
          color: palette.fg,
          fontSize: dim.fontSize,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
