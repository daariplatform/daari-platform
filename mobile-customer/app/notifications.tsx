/**
 * Notifications inbox — يعرض كل الإشعارات المخزّنة في DB للزبون.
 * تصل من backend/notifications.
 */

import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { api } from '@/lib/api';
import { fmtArabicDate } from '@/lib/format';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

interface Notif {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type: 'order' | 'payment' | 'system' | 'promo';
}

const typeIcon: Record<Notif['type'], keyof typeof Ionicons.glyphMap> = {
  order: 'receipt',
  payment: 'cash',
  system: 'information-circle',
  promo: 'gift',
};
const typeColor: Record<Notif['type'], string> = {
  order: '#0891b2',
  payment: '#059669',
  system: '#64748b',
  promo: '#d97706',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<Notif[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications/me')).data,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-4 pb-3 flex-row-reverse items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'white',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 4,
            }}
          >
            <Ionicons name="arrow-forward" size={20} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-bold">الإشعارات</Text>
        </View>
        {unreadCount > 0 && (
          <View className="px-5 pb-2 flex-row-reverse items-center justify-between">
            <Text className="text-xs text-slate-500">{unreadCount} غير مقروء</Text>
            <Pressable onPress={() => markAllRead.mutate()}>
              <Text className="text-aqua-700 text-xs font-bold">تحديد الكل كمقروء</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0891b2" />
        }
      >
        {isLoading ? (
          <>
            <SkeletonCard height={80} />
            <SkeletonCard height={80} />
            <SkeletonCard height={80} />
          </>
        ) : data?.length === 0 ? (
          <EmptyState
            icon="notifications-off"
            title="لا توجد إشعارات"
            subtitle="سنخطرك عند تحديث طلبك أو ورود إشعار جديد"
          />
        ) : (
          data?.map((n, idx) => (
            <MotiView
              key={n.id}
              from={{ opacity: 0, translateX: 20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', delay: idx * 40, duration: 300 }}
            >
              <Pressable
                onPress={() => !n.read && markRead.mutate(n.id)}
                style={{
                  backgroundColor: n.read ? 'white' : '#ecfeff',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 8,
                  borderLeftWidth: n.read ? 0 : 3,
                  borderLeftColor: '#0891b2',
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                }}
              >
                <View className="flex-row-reverse items-start">
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: `${typeColor[n.type]}15`,
                      alignItems: 'center', justifyContent: 'center',
                      marginLeft: 12,
                    }}
                  >
                    <Ionicons name={typeIcon[n.type]} size={20} color={typeColor[n.type]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      className={`text-sm text-right ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}
                    >
                      {n.title}
                    </Text>
                    <Text className="text-xs text-slate-500 text-right mt-0.5 leading-5">
                      {n.body}
                    </Text>
                    <Text className="text-[10px] text-slate-400 text-right mt-1">
                      {fmtArabicDate(n.createdAt)}
                    </Text>
                  </View>
                  {!n.read && (
                    <View
                      style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: '#0891b2',
                        marginTop: 6,
                      }}
                    />
                  )}
                </View>
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>
    </View>
  );
}
