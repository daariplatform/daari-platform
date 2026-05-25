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
  // from "20%" so the admin notices even mid-scroll).
  const colorPair: [string, string] =
    pct > 50
      ? ['#10b981', '#059669']
      : pct > 20
        ? ['#f59e0b', '#d97706']
        : ['#ef4444', '#dc2626'];

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
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <Text
            style={{ fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'right' }}
          >
            المخزون
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={stockQuery.isFetching && !stockQuery.isLoading}
            onRefresh={() => stockQuery.refetch()}
          />
        }
      >
        {stockQuery.isLoading && (
          <>
            <Skeleton height={170} borderRadius={26} style={{ marginBottom: 12 }} />
            <Skeleton height={70} borderRadius={18} style={{ marginBottom: 10 }} />
            <Skeleton height={56} borderRadius={16} style={{ marginBottom: 10 }} />
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
            {/* Hero gauge */}
            <LinearGradient
              colors={colorPair}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 26,
                padding: 18,
                marginBottom: 12,
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
                      color: '#fff',
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
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="water-drop" size={32} color="#fff" />
                </View>
              </View>

              {/* Progress bar */}
              <View
                style={{
                  marginTop: 16,
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: '#fff',
                    borderRadius: 999,
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

            {/* Last top-up info */}
            {stock.lastRefillAt && (
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: '#ccfbf1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="history" size={22} color="#0e9384" />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>آخر تزويد</Text>
                  <Text
                    style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 2 }}
                  >
                    {formatDistanceToNow(new Date(stock.lastRefillAt), {
                      addSuffix: true,
                      locale: arSA,
                    })}
                  </Text>
                </View>
              </View>
            )}

            {/* Refill CTA */}
            <Pressable
              onPress={() => setRefillOpen(true)}
              style={({ pressed }) => ({
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 14,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <LinearGradient
                colors={['#14b8a6', '#0e9384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 16,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <MaterialIcons name="add" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                  تزويد المخزون
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Settings collapsed */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setSettingsOpen((s) => !s)}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                >
                  <MaterialIcons name="settings" size={18} color="#0e9384" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                    الإعدادات
                  </Text>
                </View>
                <MaterialIcons
                  name={settingsOpen ? 'expand-less' : 'expand-more'}
                  size={22}
                  color="#64748b"
                />
              </Pressable>

              {settingsOpen && (
                <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
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
                  <Pressable
                    onPress={submitSettings}
                    disabled={updateSettings.isPending}
                    style={({ pressed }) => ({
                      marginTop: 10,
                      backgroundColor: '#0e9384',
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed || updateSettings.isPending ? 0.8 : 1,
                    })}
                  >
                    {updateSettings.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="check" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                          حفظ
                        </Text>
                      </>
                    )}
                  </Pressable>
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
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                تزويد المخزون
              </Text>
              <Pressable
                onPress={() => setRefillOpen(false)}
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 6,
                  borderRadius: 10,
                  backgroundColor: '#f1f5f9',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MaterialIcons name="close" size={18} color="#0f172a" />
              </Pressable>
            </View>

            <Text
              style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textAlign: 'right' }}
            >
              عدد اللترات المضافة
            </Text>
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MaterialIcons name="water-drop" size={20} color="#0e9384" />
              <TextInput
                value={refillInput}
                onChangeText={setRefillInput}
                placeholder="مثلاً 5000"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '900',
                  color: '#0f172a',
                  textAlign: 'right',
                  paddingVertical: 4,
                }}
              />
              <Text style={{ color: '#64748b', fontSize: 12 }}>لتر</Text>
            </View>

            <Pressable
              onPress={submitRefill}
              disabled={refill.isPending}
              style={({ pressed }) => ({
                marginTop: 16,
                borderRadius: 18,
                overflow: 'hidden',
                opacity: pressed || refill.isPending ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={['#14b8a6', '#0e9384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 14,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {refill.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                      تأكيد التزويد
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
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
          color: '#475569',
          fontWeight: '700',
          textAlign: 'right',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          style={{
            fontSize: 14,
            color: '#0f172a',
            textAlign: 'right',
            paddingVertical: 2,
          }}
        />
      </View>
    </View>
  );
}
