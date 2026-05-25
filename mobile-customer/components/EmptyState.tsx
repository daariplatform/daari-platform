/**
 * Empty state — يُستعمل لما القائمة فارغة (لا طلبات، لا إشعارات، …).
 * بديل عن نص "لا توجد بيانات" البارد.
 *
 * يدعم نوعين من الأيقونات:
 *   - افتراضي: MaterialIcons (الأكثر استخداماً عبر الـ codebase)
 *   - بديل: Ionicons (للحفاظ على التوافق مع الاستدعاءات القديمة)
 *
 * مرّر `iconSet="ionicons"` للأيقونات من Ionicons بدلاً من MaterialIcons.
 * يمكن أيضاً تمرير `actionLabel` + `onAction` لزر إجراء (مثل "ارجع للرئيسية").
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;
type IoniconName = keyof typeof Ionicons.glyphMap;

interface EmptyStateProps {
  /** Icon name — defaults to MaterialIcons. Set iconSet="ionicons" to use Ionicons. */
  icon: MaterialIconName | IoniconName;
  iconSet?: 'material' | 'ionicons';
  title: string;
  subtitle?: string;
  /** أزرار اختيارية: استعمل actionLabel+onAction للأبسط، أو مرّر action كـ ReactNode. */
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  iconSet = 'material',
  title,
  subtitle,
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
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
        {iconSet === 'ionicons' ? (
          <Ionicons name={icon as IoniconName} size={56} color="#0891b2" />
        ) : (
          <MaterialIcons name={icon as MaterialIconName} size={56} color="#0891b2" />
        )}
      </LinearGradient>
      <Text className="text-base font-bold text-slate-700 mb-1">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-slate-500 text-center px-8 leading-5">{subtitle}</Text>
      )}
      {action && <View style={{ marginTop: 16 }}>{action}</View>}
      {!action && actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 18,
            backgroundColor: '#0284c7',
            paddingHorizontal: 22,
            paddingVertical: 10,
            borderRadius: 12,
            shadowColor: '#0284c7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      )}
    </MotiView>
  );
}
