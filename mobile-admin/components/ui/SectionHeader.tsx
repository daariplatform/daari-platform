/**
 * SectionHeader — the small all-caps label that introduces a content
 * section ("الأعضاء النشطون", "نظرة سريعة", "آخر النشاط").
 *
 * Consistent typography (labelLg, slate-500), consistent vertical
 * rhythm (12pt below the previous block, 8pt above the next), and an
 * optional trailing count chip — that's all this is. Use it everywhere
 * a screen needs to introduce a logical group of cards or rows.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '@/lib/theme';

export interface SectionHeaderProps {
  title: string;
  /** Optional count chip ("12 عضو") rendered after the title. */
  count?: number | string;
  /** Optional sub-text (e.g. "هذا الشهر"). */
  subtitle?: string;
  /** Optional right-side action (text link). */
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, count, subtitle, action }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.space.lg,
        marginBottom: theme.space.sm,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: theme.space.sm }}>
        <Text
          style={{
            ...theme.font.headingMd,
            color: theme.color.text.primary,
            textAlign: 'right',
          }}
        >
          {title}
        </Text>
        {count !== undefined && (
          <View
            style={{
              backgroundColor: theme.color.accent.tint,
              borderRadius: theme.radius.pill,
              paddingHorizontal: 8,
              minWidth: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ ...theme.font.labelMd, color: theme.color.accent.primary }}>
              {count}
            </Text>
          </View>
        )}
        {subtitle && (
          <Text
            style={{
              ...theme.font.bodySm,
              color: theme.color.text.tertiary,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <Text
          onPress={action.onPress}
          style={{
            ...theme.font.labelLg,
            color: theme.color.accent.primary,
          }}
        >
          {action.label}
        </Text>
      )}
    </View>
  );
}
