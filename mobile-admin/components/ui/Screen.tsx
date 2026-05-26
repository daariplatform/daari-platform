/**
 * Screen — the standard scrollable page shell used by every stack
 * screen in the app.
 *
 * Standardises:
 *   - Page background (slate-50 from the theme)
 *   - Header slot (AppBar — passed as prop)
 *   - Scrollable content area with the right safe-area + keyboard
 *     handling
 *   - Optional sticky bottom CTA (e.g. "حفظ", "تسجيل الطلب")
 *
 * Most importantly, it removes the boilerplate that was sprinkled across
 * every screen: SafeAreaView wrappers, KeyboardAvoidingView, scroll
 * config, padding, etc. Screens now read top-to-bottom as "what's the
 * content?" instead of "how do I lay it out?"
 */

import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';

export interface ScreenProps {
  /** The AppBar (or any header). Rendered above the scroll area. */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky bottom CTA — typically a primary Button. */
  footer?: React.ReactNode;
  /** Pull-to-refresh hook. Provide both `refreshing` + `onRefresh`. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Override the standard horizontal padding on the scroll area. */
  contentPadding?: 'none' | 'sm' | 'md' | 'lg';
  /** Override the standard background. */
  background?: string;
  contentContainerStyle?: ViewStyle;
}

export function Screen({
  header,
  children,
  footer,
  refreshing,
  onRefresh,
  contentPadding = 'lg',
  background,
  contentContainerStyle,
}: ScreenProps) {
  const padMap = { none: 0, sm: theme.space.sm, md: theme.space.md, lg: theme.space.lg };
  const padding = padMap[contentPadding];

  return (
    <View style={{ flex: 1, backgroundColor: background ?? theme.color.surface.page }}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            {
              paddingHorizontal: padding,
              paddingTop: padding,
              // Bottom padding reserves space for the sticky footer +
              // the iOS home-bar inset so the last item never gets
              // covered by the CTA.
              paddingBottom: footer ? 100 : theme.space.xl,
            },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                tintColor={theme.color.accent.primary}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.color.surface.card,
              borderTopWidth: 1,
              borderTopColor: theme.color.border.subtle,
              paddingHorizontal: theme.space.lg,
              paddingTop: theme.space.md,
            }}
          >
            <SafeAreaView edges={['bottom']}>{footer}</SafeAreaView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
