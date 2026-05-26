/**
 * AppBar — the consistent header for every stack screen.
 *
 * Standardises:
 *   - back arrow placement (left in RTL → visually on the screen's left)
 *   - title typography (always headingLg, slate-900)
 *   - optional right-side action (e.g. "حفظ", "تحديث", filter icon)
 *   - safe-area top inset so the title doesn't sit under the notch
 *
 * Use this on every non-tab screen. The bottom-tab screens have their
 * own GreetingHeader instead, since those have a different visual style
 * (welcome / role chip / date).
 */

import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { safeBack } from '@/lib/nav';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface AppBarProps {
  title: string;
  /** Optional secondary line below the title (e.g. "هذا الشهر"). */
  subtitle?: string;
  /** Right-side action button. */
  rightAction?: {
    icon: IconName;
    onPress: () => void;
    label?: string;
  };
  /** Override the back behaviour — default: safeBack(router). */
  onBack?: () => void;
  /** Hide the back arrow entirely (e.g. modal). */
  hideBack?: boolean;
  style?: ViewStyle;
}

export function AppBar({
  title,
  subtitle,
  rightAction,
  onBack,
  hideBack = false,
  style,
}: AppBarProps) {
  const router = useRouter();

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: theme.color.surface.card }}
    >
      <View
        style={[
          {
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.md,
            backgroundColor: theme.color.surface.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.border.subtle,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: theme.space.md,
          },
          style,
        ]}
      >
        {/* Title block — sits on the screen's right (RTL leading edge). */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text
            style={{
              ...theme.font.headingLg,
              color: theme.color.text.primary,
              textAlign: 'right',
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{
                ...theme.font.bodySm,
                color: theme.color.text.tertiary,
                marginTop: theme.space.xxs,
                textAlign: 'right',
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Optional right action — surfaces secondary nav (filter, save). */}
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: theme.space.sm,
              borderRadius: theme.radius.md,
              backgroundColor: pressed
                ? theme.color.surface.sunken
                : 'transparent',
            })}
          >
            <MaterialIcons
              name={rightAction.icon}
              size={22}
              color={theme.color.text.primary}
            />
          </Pressable>
        )}

        {/* Back arrow — sits on the screen's left (RTL trailing edge).
            Arrow direction is "forward" because in Arabic RTL the
            "back" arrow points right. */}
        {!hideBack && (
          <Pressable
            onPress={onBack ?? (() => safeBack(router))}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: theme.space.sm,
              borderRadius: theme.radius.md,
              backgroundColor: pressed
                ? theme.color.surface.sunken
                : 'transparent',
              minWidth: 40,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <MaterialIcons
              name="arrow-forward"
              size={22}
              color={theme.color.text.primary}
            />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
