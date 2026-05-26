/**
 * StatTile — the KPI tile used on the home dashboard's 2×2 grid.
 *
 * Extracted from `app/(tabs)/home.tsx` so it can be reused on any
 * dashboard surface (reports overview, settings stats, etc.) with
 * guaranteed consistent visual weight. Wrapping it in `Card` (variant
 * `raised`) gives us the same shadow + border + radius the rest of the
 * app uses.
 *
 * Layout: icon top-leading (RTL → top-right ends up at top-left), then
 * value on a second line in display type, then a label caption. A
 * trailing `delta` slot is reserved for trend indicators (e.g. "+12%
 * عن أمس") — when present, it renders as a small chip beside the value.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { IconBadge, IconBadgeTone } from './IconBadge';
import { Card } from './Card';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface StatTileProps {
  icon: IconName;
  label: string;
  value: string;
  /** Tile accent. Defaults to brand teal. */
  tone?: IconBadgeTone;
  /** Optional sub-text under the value (e.g. "هذا الشهر"). */
  hint?: string;
  /** Optional delta chip (e.g. "+12%") with colour by direction. */
  delta?: {
    value: string;
    direction: 'up' | 'down' | 'flat';
  };
  onPress?: () => void;
}

export function StatTile({
  icon,
  label,
  value,
  tone = 'teal',
  hint,
  delta,
  onPress,
}: StatTileProps) {
  return (
    <Card
      variant="raised"
      padding="md"
      onPress={onPress}
      style={{ flex: 1, minHeight: 124 }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <IconBadge icon={icon} tone={tone} size="md" />
        {delta && <DeltaChip {...delta} />}
      </View>
      <Text
        style={{
          ...theme.font.displaySm,
          color: theme.color.text.primary,
          marginTop: theme.space.md,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          ...theme.font.bodySm,
          color: theme.color.text.secondary,
          marginTop: theme.space.xxs,
          textAlign: 'right',
          fontWeight: '600',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      {hint && (
        <Text
          style={{
            ...theme.font.labelSm,
            color: theme.color.text.tertiary,
            marginTop: theme.space.xs,
            textAlign: 'right',
          }}
        >
          {hint}
        </Text>
      )}
    </Card>
  );
}

function DeltaChip({
  value,
  direction,
}: {
  value: string;
  direction: 'up' | 'down' | 'flat';
}) {
  const tone =
    direction === 'up'
      ? theme.color.state.success
      : direction === 'down'
        ? theme.color.state.danger
        : theme.color.state.neutral;
  const arrow =
    direction === 'up' ? 'trending-up' : direction === 'down' ? 'trending-down' : 'trending-flat';
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 2,
        backgroundColor: tone.bg,
        borderRadius: theme.radius.pill,
        paddingVertical: 2,
        paddingHorizontal: 6,
      }}
    >
      <MaterialIcons name={arrow} size={12} color={tone.fg} />
      <Text style={{ ...theme.font.labelSm, color: tone.fg }}>{value}</Text>
    </View>
  );
}
