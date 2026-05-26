/**
 * IconBadge — the small rounded-square icon container used in every
 * stat tile, list-row leading slot, and inline metric.
 *
 * Three sizes (sm/md/lg) all use the same 1:1 aspect + tinted background
 * pattern (`accent` colour at 10% opacity → solid icon at the same hue).
 * Keep the pattern consistent so the icon set reads as one family across
 * the app instead of a parade of styles.
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type IconBadgeTone = keyof typeof theme.color.chart | 'neutral';
export type IconBadgeSize = 'sm' | 'md' | 'lg';

export interface IconBadgeProps {
  icon: IconName;
  tone?: IconBadgeTone;
  size?: IconBadgeSize;
  style?: ViewStyle;
}

export function IconBadge({
  icon,
  tone = 'teal',
  size = 'md',
  style,
}: IconBadgeProps) {
  const dim = {
    sm: { container: 28, radius: theme.radius.sm, icon: 14 },
    md: { container: 40, radius: theme.radius.md, icon: 20 },
    lg: { container: 52, radius: theme.radius.lg, icon: 26 },
  }[size];

  // Pick the colour: chart palette when a named tone is passed, neutral
  // slate otherwise (used when there's no semantic meaning, just a
  // visual anchor — e.g. settings rows).
  const accentColor =
    tone === 'neutral' ? theme.color.text.secondary : theme.color.chart[tone];

  return (
    <View
      style={[
        {
          width: dim.container,
          height: dim.container,
          borderRadius: dim.radius,
          // 10% tint of the accent colour. The hex+1A suffix is the
          // alpha channel — RN doesn't accept rgba() directly so we
          // bake it into the hex.
          backgroundColor: accentColor + '1A',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <MaterialIcons name={icon} size={dim.icon} color={accentColor} />
    </View>
  );
}
