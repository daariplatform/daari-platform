/**
 * AlertBanner — the standard top-of-screen alert tile.
 *
 * Used to surface conditions that need the admin's attention but aren't
 * blocking (over plan limit, low stock, pending leads, generic info).
 * Tone maps to the semantic state palette in `theme.ts` so the visual
 * language stays consistent with StatusChip / Toast / etc.
 *
 * Tones:
 *   - `danger`   red — hard problems (stock empty, plan exceeded).
 *   - `warning`  amber — soft alerts (low stock, pending leads).
 *   - `info`     sky — neutral notices.
 *
 * The whole tile can be made tappable via `onPress`; when set, a leading
 * chevron is rendered to signal navigation.
 */

import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type AlertBannerTone = 'danger' | 'warning' | 'info';

export interface AlertBannerProps {
  tone: AlertBannerTone;
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function AlertBanner({
  tone,
  icon,
  title,
  subtitle,
  onPress,
  style,
}: AlertBannerProps) {
  // Map tone to the semantic state palette. We use the solid colour for
  // the leading icon container (so it pops against the soft bg) and the
  // bg/border/fg for the surface + text — mirrors how StatusChip works.
  const paletteKey: 'danger' | 'warning' | 'info' = tone;
  const palette = theme.color.state[paletteKey];

  const containerStyle: ViewStyle = {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.space.md,
  };

  const inner = (
    <>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          backgroundColor: palette.solid,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={22} color={theme.color.text.onAccent} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          style={{
            ...theme.font.headingSm,
            color: palette.fg,
            textAlign: 'right',
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              ...theme.font.bodySm,
              color: palette.fg,
              marginTop: 2,
              textAlign: 'right',
              opacity: 0.85,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && (
        <MaterialIcons name="chevron-left" size={22} color={palette.fg} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle,
          pressed && { opacity: 0.85 },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{inner}</View>;
}
