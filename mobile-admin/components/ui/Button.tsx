/**
 * Button — the single tap-able primitive in the app.
 *
 * Variants cover the four "verbs" of an interface:
 *   - `primary`   solid teal. The single most important action on a
 *                 screen (تسجيل الطلب، حفظ، تأكيد).
 *   - `secondary` outlined teal. A complementary action on the same
 *                 screen as a primary (إلغاء بجوار حفظ).
 *   - `ghost`     no fill, no border, just text. Tertiary actions inside
 *                 lists or under fields.
 *   - `danger`    solid rose. Destructive actions — flush at use site.
 *
 * Sizes follow Apple HIG: `lg` is the 56pt sticky bottom CTA; `md` is
 * the standard 44pt button; `sm` is the 36pt compact (toolbar / chip).
 * Never go smaller than 36pt; below that the touch target violates HIG.
 */

import React from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Show a spinner instead of the label and disable taps. */
  loading?: boolean;
  /** Disabled-but-not-loading state. */
  disabled?: boolean;
  /** Stretches the button to fill its parent's width. */
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const sizeMap = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13, iconSize: 16 },
    md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: 14, iconSize: 18 },
    lg: { paddingVertical: 16, paddingHorizontal: 22, fontSize: 15, iconSize: 20 },
  };
  const dim = sizeMap[size];
  const isDisabled = disabled || loading;

  const baseStyle: ViewStyle = {
    paddingVertical: dim.paddingVertical,
    paddingHorizontal: dim.paddingHorizontal,
    borderRadius: theme.radius.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    opacity: isDisabled ? 0.55 : 1,
    ...(fullWidth && { width: '100%' }),
  };

  // For `primary` we layer a soft linear-gradient over the brand teal —
  // it gives the button a small amount of dimensional polish without
  // looking gimmicky. The other variants stay flat.
  if (variant === 'primary') {
    return (
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          { borderRadius: theme.radius.lg, ...theme.shadow.md },
          pressed && { transform: [{ scale: 0.98 }] },
          style,
        ]}
      >
        <LinearGradient
          colors={[theme.color.raw.teal[500], theme.color.raw.teal[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={baseStyle}
        >
          {loading ? (
            <ActivityIndicator color={theme.color.text.onAccent} />
          ) : (
            <ButtonInner
              label={label}
              icon={icon}
              iconSize={dim.iconSize}
              fontSize={dim.fontSize}
              color={theme.color.text.onAccent}
            />
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  // Secondary / ghost / danger share the flat path.
  const palette = {
    secondary: {
      bg: theme.color.surface.card,
      fg: theme.color.accent.primary,
      borderColor: theme.color.accent.primary,
      borderWidth: 1,
    },
    ghost: {
      bg: 'transparent',
      fg: theme.color.text.primary,
      borderColor: 'transparent',
      borderWidth: 0,
    },
    danger: {
      bg: theme.color.state.danger.solid,
      fg: theme.color.text.onAccent,
      borderColor: theme.color.state.danger.solid,
      borderWidth: 0,
    },
  }[variant as Exclude<ButtonVariant, 'primary'>];

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        baseStyle,
        {
          backgroundColor: palette.bg,
          borderWidth: palette.borderWidth,
          borderColor: palette.borderColor,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        variant === 'danger' && theme.shadow.sm,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <ButtonInner
          label={label}
          icon={icon}
          iconSize={dim.iconSize}
          fontSize={dim.fontSize}
          color={palette.fg}
        />
      )}
    </Pressable>
  );
}

function ButtonInner({
  label,
  icon,
  iconSize,
  fontSize,
  color,
}: {
  label: string;
  icon?: IconName;
  iconSize: number;
  fontSize: number;
  color: string;
}) {
  return (
    <>
      {icon && <MaterialIcons name={icon} size={iconSize} color={color} />}
      <Text style={{ color, fontWeight: '800', fontSize }}>{label}</Text>
    </>
  );
}
