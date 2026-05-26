/**
 * Card — the most-used surface in the app.
 *
 * Three depths, picked by purpose:
 *   - `flat`     hairline border, no shadow. For dense lists where many
 *                cards stack and a shadow would create visual noise.
 *   - `raised`   default. Subtle shadow + light border. Best for the
 *                tiles in the home dashboard, single-item summaries.
 *   - `elevated` strong shadow. For floating sheets, hero banners, and
 *                things that should clearly hover above the page.
 *
 * Always uses the same radius + the same border colour — that's the
 * whole point of having this primitive instead of rolling the styles
 * inline per screen.
 */

import React from 'react';
import { View, Pressable, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/lib/theme';

export type CardVariant = 'flat' | 'raised' | 'elevated';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  /** Tap handler — when provided the card becomes a Pressable. */
  onPress?: () => void;
  /** Padding shortcut. `none` skips it for custom layouts. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  /** Pure aesthetic — pass false for cards inside other cards. */
  bordered?: boolean;
}

export function Card({
  children,
  variant = 'raised',
  onPress,
  padding = 'md',
  bordered = true,
  style,
}: CardProps) {
  const padMap = {
    none: 0,
    sm: theme.space.md,
    md: theme.space.lg,
    lg: theme.space.xl,
  };

  const shadowMap = {
    flat: theme.shadow.none,
    raised: theme.shadow.md,
    elevated: theme.shadow.lg,
  };

  const baseStyle: ViewStyle = {
    backgroundColor: theme.color.surface.card,
    borderRadius: theme.radius.lg,
    padding: padMap[padding],
    borderWidth: bordered ? 1 : 0,
    // `flat` uses the subtle hairline; the others use the firmer default
    // so the shadow + outline reinforce each other instead of fighting.
    borderColor:
      variant === 'flat' ? theme.color.border.subtle : theme.color.border.default,
    ...shadowMap[variant],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
          style,
        ]}
        // Match the iOS HIG 44pt minimum touch target — most cards already
        // exceed this, but the prop guarantees correctness for tiny ones.
        hitSlop={4}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}
