/**
 * AdminTool — the tappable icon+label tile used in the admin home's
 * "أدوات الإدارة" grid (شاشات، التقارير، الفريق، الخريطة الحيّة…).
 *
 * Two-up grid sizing (~48.5% width with row gap) so we always get a tidy
 * 2-column rhythm on every phone width. Visually:
 *   - flat Card (no shadow — there are 10+ of these, shadows would fight)
 *   - IconBadge on the leading (RTL right) edge
 *   - bold label on the trailing edge, single line, truncates gracefully
 *
 * Intentionally NOT a big CTA — those belong to the customer app's
 * "اطلب الآن" pulse button. Admin tools are management shortcuts.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { Card } from './Card';
import { IconBadge, IconBadgeTone } from './IconBadge';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface AdminToolProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Tile accent. Defaults to brand teal. */
  tone?: IconBadgeTone;
}

export function AdminTool({ icon, label, onPress, tone = 'teal' }: AdminToolProps) {
  return (
    <Card
      variant="flat"
      padding="sm"
      onPress={onPress}
      style={{
        width: '48.5%',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: theme.space.sm,
      }}
    >
      <IconBadge icon={icon} tone={tone} size="sm" />
      <Text
        style={{
          ...theme.font.bodyMd,
          color: theme.color.text.primary,
          fontWeight: '700',
          flex: 1,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Card>
  );
}
