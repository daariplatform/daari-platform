/**
 * Empty state — يُستعمل لما القائمة فارغة (لا طلبات، لا إشعارات، …).
 * بديل عن نص "لا توجد بيانات" البارد.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 500 }}
      style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}
    >
      <LinearGradient
        colors={['#ecfeff', '#cffafe']}
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={56} color="#0891b2" />
      </LinearGradient>
      <Text className="text-base font-bold text-slate-700 mb-1">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-slate-500 text-center px-8 leading-5">{subtitle}</Text>
      )}
      {action && <View style={{ marginTop: 16 }}>{action}</View>}
    </MotiView>
  );
}
