/**
 * Notifications inbox — يعرض كل الإشعارات المخزّنة في DB للزبون.
 * تصل من backend/notifications/me.
 *
 * تصميم محدّث: شارات أيقونات متدرّجة (بدل الإيموجي)، حركات دخول متتالية
 * (Moti)، عمق/ظلال، وحالة فراغ متحرّكة — حتى لا تكون الصفحة جامدة.
 */

import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { api } from '@/lib/api';
import { fmtArabicDate } from '@/lib/format';
import { SkeletonCard } from '@/components/Skeleton';

interface Notif {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type: 'order' | 'payment' | 'system' | 'promo';
}

// Per-type gradient + glyph for the rounded icon badge. Replaces the old
// flat-color + emoji look with a small "3D-ish" gradient chip.
const TYPE_STYLE: Record<
  Notif['type'],
  { grad: [string, string]; glyph: keyof typeof Ionicons.glyphMap; tint: string; soft: string }
> = {
  order: { grad: ['#22d3ee', '#0891b2'], glyph: 'water', tint: '#0891b2', soft: '#ecfeff' },
  payment: { grad: ['#34d399', '#059669'], glyph: 'cash', tint: '#059669', soft: '#ecfdf5' },
  promo: { grad: ['#fbbf24', '#d97706'], glyph: 'gift', tint: '#d97706', soft: '#fffbeb' },
  system: { grad: ['#94a3b8', '#475569'], glyph: 'notifications', tint: '#475569', soft: '#f1f5f9' },
};

// Strip leading emoji/symbols from a backend title (e.g. "✅ تمّت تعبئة" →
// "تمّت تعبئة") since the gradient badge already conveys the type visually.
function cleanTitle(t: string): string {
  return t
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '')
    .trim();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<Notif[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ items: Notif[]; unreadCount: number }>(
        '/notifications/me',
        { params: { pageSize: 100 } },
      );
      return res.data.items;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/notifications/me/${id}/mark-read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => (await api.post('/notifications/me/mark-all-read')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Gradient header — gives the page a lively top instead of a flat bar */}
      <LinearGradient
        colors={['#0e7490', '#0891b2', '#06b6d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-3 pb-4 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">الإشعارات</Text>
              <Text className="text-cyan-100 text-xs mt-0.5">
                {unreadCount > 0 ? `${unreadCount} غير مقروء` : 'كل شيء محدّث'}
              </Text>
            </View>
          </View>
          {unreadCount > 0 && (
            <View className="px-5 pb-3 flex-row-reverse">
              <Pressable
                onPress={() => markAllRead.mutate()}
                className="bg-white/20 px-3 py-1.5 rounded-full flex-row-reverse items-center gap-1.5"
              >
                <Ionicons name="checkmark-done" size={14} color="#fff" />
                <Text className="text-white text-xs font-bold">تحديد الكل كمقروء</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0891b2" />
        }
      >
        {isLoading ? (
          <>
            <SkeletonCard height={84} />
            <SkeletonCard height={84} />
            <SkeletonCard height={84} />
          </>
        ) : data?.length === 0 ? (
          <EmptyNotifications />
        ) : (
          data?.map((n, idx) => {
            const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.system;
            return (
              <MotiView
                key={n.id}
                from={{ opacity: 0, translateY: 16, scale: 0.97 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'spring', delay: idx * 60, damping: 16 }}
              >
                <Pressable
                  onPress={() => !n.read && markRead.mutate(n.id)}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    backgroundColor: n.read ? '#ffffff' : s.soft,
                    borderRadius: 18,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: n.read ? '#f1f5f9' : `${s.tint}33`,
                    shadowColor: s.tint,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: n.read ? 0.05 : 0.16,
                    shadowRadius: 10,
                    elevation: n.read ? 1 : 3,
                  })}
                >
                  <View className="flex-row-reverse items-start">
                    {/* Gradient icon badge with a soft glow */}
                    <LinearGradient
                      colors={s.grad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 46, height: 46, borderRadius: 15,
                        alignItems: 'center', justifyContent: 'center',
                        marginLeft: 12,
                        shadowColor: s.tint,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.4,
                        shadowRadius: 6,
                      }}
                    >
                      <Ionicons name={s.glyph} size={22} color="#fff" />
                    </LinearGradient>

                    <View style={{ flex: 1 }}>
                      <Text
                        className={`text-sm text-right ${
                          n.read ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'
                        }`}
                      >
                        {cleanTitle(n.title)}
                      </Text>
                      <Text className="text-xs text-slate-500 text-right mt-1 leading-5">
                        {n.body}
                      </Text>
                      <Text className="text-[10px] text-slate-400 text-right mt-1.5">
                        {fmtArabicDate(n.createdAt)}
                      </Text>
                    </View>

                    {!n.read && (
                      <MotiView
                        from={{ scale: 0.6, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ loop: true, type: 'timing', duration: 900 }}
                        style={{
                          width: 10, height: 10, borderRadius: 5,
                          backgroundColor: s.tint, marginTop: 4,
                        }}
                      />
                    )}
                  </View>
                </Pressable>
              </MotiView>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/** Animated empty state — a gently breathing bell instead of a static icon. */
function EmptyNotifications() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
      <MotiView
        from={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1.05, opacity: 1 }}
        transition={{ loop: true, type: 'timing', duration: 1600 }}
      >
        <LinearGradient
          colors={['#cffafe', '#a5f3fc']}
          style={{
            width: 96, height: 96, borderRadius: 32,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="notifications-off-outline" size={44} color="#0891b2" />
        </LinearGradient>
      </MotiView>
      <Text className="text-slate-900 font-bold text-base mt-5">لا توجد إشعارات</Text>
      <Text className="text-slate-500 text-xs mt-1 text-center px-10 leading-5">
        سنخطرك فور تحديث حالة طلبك أو وصول عرض جديد من معملك
      </Text>
    </View>
  );
}
