import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import {
  useNotificationsInbox,
  useMarkNotificationRead,
  useMarkAllRead,
  type InboxNotification,
} from '@/lib/queries';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface KindMeta {
  icon: MaterialIconName;
  bg: string;
  fg: string;
}

/**
 * Per-kind styling for the inbox row icon. Falls back to the generic
 * "info" badge for any kind the backend invents later — we don't want
 * a future addition to crash the list.
 */
const KIND_META: Record<string, KindMeta> = {
  'low-stock': { icon: 'water-drop', bg: '#fee2e2', fg: '#dc2626' },
  'new-lead': { icon: 'person-add', bg: '#fef3c7', fg: '#b45309' },
  'new-order': { icon: 'local-mall', bg: '#dcfce7', fg: '#15803d' },
  system: { icon: 'info', bg: '#dbeafe', fg: '#1d4ed8' },
};

const FALLBACK_META: KindMeta = { icon: 'notifications', bg: '#e0f2fe', fg: '#0369a1' };

/**
 * Notifications inbox — the persistent record of every push the backend
 * tried to deliver. Two filter pills (all / unread), bold title for
 * unread, teal dot indicator, and tap-to-route based on the payload's
 * own `kind` (a `data.kind` override wins if the backend ever sends a
 * link-only notification with no top-level kind).
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const inboxQuery = useNotificationsInbox({ page, pageSize: 50, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const items = inboxQuery.data?.items ?? [];
  const unreadCount = inboxQuery.data?.unreadCount ?? 0;
  const totalPages = inboxQuery.data?.totalPages ?? 0;

  function handleTap(item: InboxNotification) {
    // Mark read first so the unread dot clears immediately — the
    // mutation is optimistic so this is instant from the user's POV.
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    // Route based on kind: top-level kind wins, then data.kind, then
    // any data.orderId / data.customerId we recognize. If nothing
    // matches we stay on the inbox (which is the safe default — we'd
    // rather do nothing than push a 404 route).
    const kind = item.kind || (item.data?.kind as string | undefined);
    const orderId = item.data?.orderId as string | undefined;
    const customerId = item.data?.customerId as string | undefined;

    if (kind === 'low-stock') {
      router.push('/(tabs)/stock' as any);
    } else if (kind === 'new-lead') {
      router.push('/(tabs)/customers' as any);
    } else if (kind === 'new-order' && orderId) {
      router.push(`/order/${orderId}` as any);
    } else if (orderId) {
      router.push(`/order/${orderId}` as any);
    } else if (customerId) {
      router.push(`/customer/${customerId}` as any);
    }
  }

  async function handleMarkAll() {
    if (unreadCount === 0) return;
    try {
      await markAll.mutateAsync();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر تحديث الحالة');
    }
  }

  const renderItem: ListRenderItem<InboxNotification> = ({ item }) => (
    <NotificationRow item={item} onPress={() => handleTap(item)} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#0f172a" />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
              التنبيهات
            </Text>
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAll}
              disabled={markAll.isPending}
              hitSlop={6}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                opacity: pressed || markAll.isPending ? 0.6 : 1,
              })}
            >
              {markAll.isPending ? (
                <ActivityIndicator color="#0e9384" size="small" />
              ) : (
                <MaterialIcons name="done-all" size={16} color="#0e9384" />
              )}
              <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 12 }}>
                قراءة الكل
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filter pills */}
        <View
          style={{
            flexDirection: 'row-reverse',
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <FilterPill
            label="الكل"
            active={!unreadOnly}
            onPress={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
          />
          <FilterPill
            label={
              unreadCount > 0
                ? `غير مقروءة (${unreadCount.toLocaleString('en-US')})`
                : 'غير مقروءة'
            }
            active={unreadOnly}
            onPress={() => {
              setUnreadOnly(true);
              setPage(1);
            }}
          />
        </View>
      </SafeAreaView>

      {inboxQuery.isLoading && (
        <View style={{ padding: 14 }}>
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      )}

      {inboxQuery.isError && !inboxQuery.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل التنبيهات"
          actionLabel="إعادة المحاولة"
          onAction={() => inboxQuery.refetch()}
        />
      )}

      {/* Empty state is mutually exclusive with the error state — if the
          query errored, query.data is undefined and items === [], which
          would otherwise trigger BOTH the error card AND the empty card
          at once. Gate on !isError so only the error renders. */}
      {!inboxQuery.isLoading && !inboxQuery.isError && items.length === 0 && (
        <EmptyState
          icon="notifications-none"
          title={unreadOnly ? 'لا توجد تنبيهات غير مقروءة' : 'لا توجد تنبيهات'}
          subtitle={
            unreadOnly
              ? 'كل التنبيهات قُرئت — تابع عملك.'
              : 'سيظهر هنا أي تنبيه يصلك من النظام.'
          }
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={inboxQuery.isFetching && !inboxQuery.isLoading}
              onRefresh={() => inboxQuery.refetch()}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? '#0e9384' : '#f1f5f9',
        borderWidth: 1,
        borderColor: active ? '#0e9384' : '#e2e8f0',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: active ? '#fff' : '#475569',
          fontWeight: '800',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: InboxNotification;
  onPress: () => void;
}) {
  const meta = useMemo(() => KIND_META[item.kind] ?? FALLBACK_META, [item.kind]);
  const unread = !item.readAt;
  const when = useMemo(
    () =>
      formatDistanceToNow(new Date(item.createdAt), {
        addSuffix: true,
        locale: arSA,
      }),
    [item.createdAt],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: unread ? '#99f6e4' : '#e2e8f0',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: meta.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={meta.icon} size={22} color={meta.fg} />
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              alignSelf: 'stretch',
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 6,
                flex: 1,
              }}
            >
              {unread && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#0e9384',
                  }}
                />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: unread ? '900' : '700',
                  color: '#0f172a',
                  textAlign: 'right',
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{when}</Text>
          </View>
          {item.body ? (
            <Text
              style={{
                fontSize: 12,
                color: '#475569',
                marginTop: 4,
                textAlign: 'right',
                lineHeight: 18,
              }}
              numberOfLines={3}
            >
              {item.body}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 6,
      }}
    >
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: prevDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : prevDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={prevDisabled ? '#cbd5e1' : '#0e9384'}
        />
      </Pressable>
      <Text style={{ fontWeight: '700', color: '#475569', fontSize: 13 }}>
        صفحة {page.toLocaleString('en-US')} من {totalPages.toLocaleString('en-US')}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: nextDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : nextDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-left"
          size={22}
          color={nextDisabled ? '#cbd5e1' : '#0e9384'}
        />
      </Pressable>
    </View>
  );
}
