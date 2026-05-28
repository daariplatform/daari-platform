import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import {
  usePlantStock,
  useRefillStock,
  useUpdateStockSettings,
} from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button, Card, IconBadge } from '@/components/ui';
import { theme } from '@/lib/theme';

/**
 * Stock screen — hero gauge, last-top-up info, refill action, settings
 * (capacity + low threshold). Settings live behind a collapsed section so
 * the daily glance is fast and uncluttered.
 */
export default function StockScreen() {
  const stockQuery = usePlantStock();
  const refill = useRefillStock();
  const updateSettings = useUpdateStockSettings();

  const [refillOpen, setRefillOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refillInput, setRefillInput] = useState('');
  const [capacityInput, setCapacityInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');

  const stock = stockQuery.data;

  const pct =
    stock && stock.capacityLiters > 0
      ? Math.min(100, Math.round((stock.currentLiters / stock.capacityLiters) * 100))
      : 0;

  // Colour pipeline: green when comfortable, amber once we're past the
  // halfway mark down, red when below the low threshold (visually distinct
  // from "20%" so the admin notices even mid-scroll). Sourced from the
  // theme's semantic state palette so the gauge matches every other
  // green/amber/red surface in the app.
  const colorPair: [string, string] =
    pct > 50
      ? [theme.color.state.success.solid, theme.color.raw.emerald[600]]
      : pct > 20
        ? [theme.color.raw.amber[500], theme.color.raw.amber[600]]
        : [theme.color.state.danger.solid, theme.color.raw.rose[600]];

  async function submitRefill() {
    const n = parseInt(refillInput, 10);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('تحقّق', 'أدخل عدد لترات صحيح أكبر من صفر');
      return;
    }
    try {
      await refill.mutateAsync(n);
      setRefillOpen(false);
      setRefillInput('');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر التزويد');
    }
  }

  async function submitSettings() {
    const cap = parseInt(capacityInput, 10);
    const thr = parseInt(thresholdInput, 10);
    const body: { capacityLiters?: number; lowThresholdLiters?: number } = {};
    if (Number.isFinite(cap) && cap > 0) body.capacityLiters = cap;
    if (Number.isFinite(thr) && thr >= 0) body.lowThresholdLiters = thr;
    if (Object.keys(body).length === 0) {
      Alert.alert('لا تغييرات', 'لم تُدخل أي قيمة جديدة');
      return;
    }
    try {
      await updateSettings.mutateAsync(body);
      setCapacityInput('');
      setThresholdInput('');
      Alert.alert('تم', 'حُدّثت الإعدادات');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الحفظ');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface.page }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.surface.card }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm + 2,
            paddingBottom: theme.space.md,
            backgroundColor: theme.color.surface.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.border.subtle,
          }}
        >
          <Text
            style={{
              ...theme.font.displaySm,
              color: theme.color.text.primary,
              textAlign: 'right',
            }}
          >
            المخزون
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          padding: theme.space.md + 2,
          paddingBottom: theme.space['4xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={stockQuery.isFetching && !stockQuery.isLoading}
            onRefresh={() => stockQuery.refetch()}
          />
        }
      >
        {stockQuery.isLoading && (
          <>
            <Skeleton height={170} borderRadius={theme.radius['2xl']} style={{ marginBottom: theme.space.md }} />
            <Skeleton height={70} borderRadius={theme.radius.lg + 2} style={{ marginBottom: 10 }} />
            <Skeleton height={56} borderRadius={theme.radius.lg} style={{ marginBottom: 10 }} />
          </>
        )}

        {stockQuery.isError && !stock && (
          <EmptyState
            icon="cloud-off"
            title="تعذّر تحميل المخزون"
            actionLabel="إعادة المحاولة"
            onAction={() => stockQuery.refetch()}
          />
        )}

        {stock && (
          <>
            {/* Hero gauge — raised Card wrapping the gradient so the gauge
                inherits the same shadow + radius rhythm as every other
                raised tile in the app. The gradient lives inside the card
                so it still pops, but no longer floats in its own visual
                container. */}
            <Card variant="raised" padding="none" style={{ marginBottom: theme.space.md }}>
              <LinearGradient
                colors={colorPair}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: theme.radius.lg,
                  padding: theme.space.lg + 2,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                      المخزون الحالي
                    </Text>
                    <Text
                      style={{
                        color: theme.color.text.onAccent,
                        fontWeight: '900',
                        fontSize: 38,
                        marginTop: 4,
                        lineHeight: 44,
                      }}
                    >
                      {(stock.currentLiters ?? 0).toLocaleString('en-US')}{' '}
                      <Text style={{ fontSize: 14, opacity: 0.85, fontWeight: '700' }}>
                        / {(stock.capacityLiters ?? 0).toLocaleString('en-US')} لتر
                      </Text>
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: theme.radius.lg + 2,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons name="water-drop" size={32} color={theme.color.text.onAccent} />
                  </View>
                </View>

                {/* Progress bar */}
                <View
                  style={{
                    marginTop: theme.space.lg,
                    height: 12,
                    borderRadius: theme.radius.pill,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: theme.color.text.onAccent,
                      borderRadius: theme.radius.pill,
                    }}
                  />
                </View>
                <Text
                  style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 6 }}
                >
                  {pct.toLocaleString('en-US')}% من السعة · تنبيه عند{' '}
                  {(stock.lowThresholdLiters ?? 0).toLocaleString('en-US')} لتر
                </Text>
              </LinearGradient>
            </Card>

            {/* Last top-up info */}
            {stock.lastRefillAt && (
              <Card
                variant="flat"
                padding="sm"
                style={{
                  marginBottom: theme.space.md,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: theme.space.md,
                }}
              >
                <IconBadge icon="history" tone="teal" size="md" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: theme.color.text.secondary }}>
                    آخر تزويد
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: theme.color.text.primary,
                      marginTop: 2,
                    }}
                  >
                    {formatDistanceToNow(new Date(stock.lastRefillAt), {
                      addSuffix: true,
                      locale: arSA,
                    })}
                  </Text>
                </View>
              </Card>
            )}

            {/* Refill CTA — shared primary Button. Replaces a one-off
                gradient Pressable that used to live here, so this CTA now
                shares the exact same visual language as every other
                "primary action" in the app. */}
            <Button
              label="تزويد المخزون"
              icon="add"
              size="lg"
              fullWidth
              onPress={() => setRefillOpen(true)}
              style={{ marginBottom: theme.space.md + 2 }}
            />

            {/* Settings collapsed */}
            <View
              style={{
                backgroundColor: theme.color.surface.card,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: theme.color.border.subtle,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setSettingsOpen((s) => !s)}
                style={({ pressed }) => ({
                  paddingVertical: theme.space.md + 2,
                  paddingHorizontal: theme.space.md + 2,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                >
                  <MaterialIcons name="settings" size={18} color={theme.color.accent.primary} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: theme.color.text.primary,
                    }}
                  >
                    الإعدادات
                  </Text>
                </View>
                <MaterialIcons
                  name={settingsOpen ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={theme.color.text.secondary}
                />
              </Pressable>

              {settingsOpen && (
                <View
                  style={{
                    padding: theme.space.md + 2,
                    borderTopWidth: 1,
                    borderTopColor: theme.color.raw.slate[100],
                  }}
                >
                  <SettingsField
                    label="السعة الكاملة (لتر)"
                    placeholder={`الحالي: ${(stock.capacityLiters ?? 0).toLocaleString('en-US')}`}
                    value={capacityInput}
                    onChangeText={setCapacityInput}
                  />
                  <SettingsField
                    label="حدّ التنبيه (لتر)"
                    placeholder={`الحالي: ${(stock.lowThresholdLiters ?? 0).toLocaleString('en-US')}`}
                    value={thresholdInput}
                    onChangeText={setThresholdInput}
                  />
                  <Button
                    label="حفظ"
                    icon="check"
                    onPress={submitSettings}
                    loading={updateSettings.isPending}
                    fullWidth
                    style={{ marginTop: 10 }}
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Refill modal */}
      <Modal
        visible={refillOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRefillOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(15,23,42,0.55)',
          }}
        >
          <View
            style={{
              backgroundColor: theme.color.surface.card,
              borderTopLeftRadius: theme.radius['2xl'],
              borderTopRightRadius: theme.radius['2xl'],
              padding: theme.space.xl,
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: theme.space.md + 2,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: '900', color: theme.color.text.primary }}
              >
                تزويد المخزون
              </Text>
              <Pressable
                onPress={() => setRefillOpen(false)}
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 6,
                  borderRadius: theme.radius.sm + 2,
                  backgroundColor: theme.color.raw.slate[100],
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MaterialIcons name="close" size={18} color={theme.color.text.primary} />
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: theme.color.text.secondary,
                marginBottom: theme.space.sm,
                textAlign: 'right',
              }}
            >
              عدد اللترات المضافة
            </Text>
            <View
              style={{
                backgroundColor: theme.color.surface.page,
                borderRadius: theme.radius.lg - 2,
                borderWidth: 1,
                borderColor: theme.color.border.subtle,
                paddingHorizontal: theme.space.md,
                paddingVertical: 10,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: theme.space.sm,
              }}
            >
              <MaterialIcons name="water-drop" size={20} color={theme.color.accent.primary} />
              <TextInput
                value={refillInput}
                onChangeText={setRefillInput}
                placeholder="مثلاً 5000"
                placeholderTextColor={theme.color.text.disabled}
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '900',
                  color: theme.color.text.primary,
                  textAlign: 'right',
                  paddingVertical: 4,
                }}
              />
              <Text style={{ color: theme.color.text.secondary, fontSize: 12 }}>لتر</Text>
            </View>

            <Button
              label="تأكيد التزويد"
              icon="check"
              size="lg"
              fullWidth
              onPress={submitRefill}
              loading={refill.isPending}
              style={{ marginTop: theme.space.lg }}
            />
            <SafeAreaView edges={['bottom']} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SettingsField({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 12,
          color: theme.color.raw.slate[600],
          fontWeight: '700',
          textAlign: 'right',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: theme.color.surface.page,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.color.border.subtle,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.color.text.disabled}
          keyboardType="number-pad"
          style={{
            fontSize: 14,
            color: theme.color.text.primary,
            textAlign: 'right',
            paddingVertical: 2,
          }}
        />
      </View>
    </View>
  );
}
