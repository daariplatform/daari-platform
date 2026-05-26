import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useCreatePromo, usePromos } from '@/lib/queries';
import { safeBack } from '@/lib/nav';

interface TenantSettings {
  refillPriceIqd: number;
}

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Create-promo modal. Slides up from the bottom. Pre-fills promo price to
 * 30% off the tenant's current refillPriceIqd, snapped to the nearest 50 د.ع
 * so the suggestion looks tidy instead of "693 د.ع". Duration defaults to
 * 12 hours — long enough to span an evening, short enough that the owner
 * notices when it's gone.
 */
export default function PromoCreateScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreatePromo();

  // Two reads — current price (for default + validation) and wallet balance
  // (for the "كم طلب يكفي رصيدك" preview line). Wallet balance is already in
  // the cache from the parent screen so this is effectively free.
  const settingsQuery = useQuery<TenantSettings>({
    queryKey: ['plant-settings'],
    queryFn: async () => (await api.get<TenantSettings>('/tenants/me/settings')).data,
  });
  const promosQuery = usePromos();

  const originalPriceIqd = settingsQuery.data?.refillPriceIqd ?? 0;
  const walletBalanceIqd = promosQuery.data?.walletBalanceIqd ?? 0;

  const suggested = useMemo(() => {
    if (originalPriceIqd <= 0) return 0;
    return Math.max(1, Math.round((originalPriceIqd * 0.7) / 50) * 50);
  }, [originalPriceIqd]);

  const [promoPriceStr, setPromoPriceStr] = useState(String(suggested || ''));
  const [durationHours, setDurationHours] = useState(12);

  // Sync the suggested price once settings load (initial render runs before
  // settings come back from the network).
  useMemo(() => {
    if (suggested && !promoPriceStr) setPromoPriceStr(String(suggested));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  const promoPriceIqd = parseInt(promoPriceStr, 10);
  const priceValid =
    Number.isFinite(promoPriceIqd) &&
    promoPriceIqd > 0 &&
    originalPriceIqd > 0 &&
    promoPriceIqd < originalPriceIqd;
  const durationValid = durationHours >= 1 && durationHours <= 48;
  const valid = priceValid && durationValid;

  const discountPct =
    priceValid && originalPriceIqd > 0
      ? Math.round(((originalPriceIqd - promoPriceIqd) / originalPriceIqd) * 100)
      : 0;
  const ordersAffordable = Math.floor(walletBalanceIqd / 1000);

  async function onSubmit() {
    if (!valid) {
      Alert.alert('تحقّق', 'تأكد من سعر العرض والمدّة');
      return;
    }
    try {
      await create.mutateAsync({ promoPriceIqd, durationHours });
      qc.invalidateQueries({ queryKey: ['plant', 'promos'] });
      safeBack(router);
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إنشاء العرض');
    }
  }

  // Preset duration buttons — fast taps for common windows.
  const DURATION_PRESETS = [3, 6, 12, 24, 48];

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
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>عرض جديد</Text>
          <Pressable
            onPress={() => safeBack(router)}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: 8,
              borderRadius: 12,
              backgroundColor: '#f1f5f9',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <MaterialIcons name="close" size={22} color="#0f172a" />
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro */}
          <Text style={{ fontSize: 12, color: '#475569', textAlign: 'right', marginBottom: 14 }}>
            سيُرسل إشعار فوري لكل زبائنك ويُفعَّل سعر العرض حتى نهاية المدّة أو نفاد رصيد المحفظة.
          </Text>

          {/* Promo price */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: '#475569',
              textAlign: 'right',
              marginBottom: 6,
            }}
          >
            سعر العرض (د.ع)
          </Text>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: priceValid ? '#0e9384' : '#e2e8f0',
              paddingHorizontal: 12,
              paddingVertical: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <MaterialIcons name="local-offer" size={22} color="#0e9384" />
            <TextInput
              value={promoPriceStr}
              onChangeText={setPromoPriceStr}
              keyboardType="number-pad"
              placeholder={suggested ? String(suggested) : 'مثلاً 700'}
              placeholderTextColor="#94a3b8"
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '900',
                color: '#0f172a',
                textAlign: 'right',
                paddingVertical: 2,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: '#64748b',
              textAlign: 'right',
              marginTop: 6,
            }}
          >
            السعر العادي حالياً:{' '}
            <Text style={{ fontWeight: '900', color: '#0f172a' }}>
              {n(originalPriceIqd)} د.ع
            </Text>
            {priceValid && (
              <Text style={{ color: '#10b981', fontWeight: '900' }}>
                {'  '}— خصم {discountPct}%
              </Text>
            )}
          </Text>
          {!!promoPriceStr &&
            Number.isFinite(promoPriceIqd) &&
            originalPriceIqd > 0 &&
            promoPriceIqd >= originalPriceIqd && (
              <Text
                style={{
                  fontSize: 11,
                  color: '#b91c1c',
                  fontWeight: '800',
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                سعر العرض يجب أن يكون أقل من السعر العادي
              </Text>
            )}

          {/* Duration */}
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 22,
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569' }}>
              المدّة
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#0c7a6e' }}>
              {durationHours} ساعة
            </Text>
          </View>

          {/* Duration preset pills */}
          <View
            style={{
              flexDirection: 'row-reverse',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            {DURATION_PRESETS.map((h) => {
              const selected = durationHours === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => setDurationHours(h)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: selected ? '#0e9384' : '#e2e8f0',
                    backgroundColor: selected ? '#ccfbf1' : '#fff',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '900',
                      color: selected ? '#0c7a6e' : '#475569',
                    }}
                  >
                    {h} ساعة
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Fine adjust ± */}
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
              marginTop: 6,
            }}
          >
            <Pressable
              onPress={() => setDurationHours((h) => Math.max(1, h - 1))}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="remove" size={22} color="#475569" />
            </Pressable>
            <View
              style={{
                flex: 1,
                backgroundColor: '#fff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                {durationHours} / 48 ساعة
              </Text>
            </View>
            <Pressable
              onPress={() => setDurationHours((h) => Math.min(48, h + 1))}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="add" size={22} color="#475569" />
            </Pressable>
          </View>

          {/* Preview / cost summary */}
          <View
            style={{
              marginTop: 22,
              backgroundColor: '#ecfeff',
              borderWidth: 1,
              borderColor: '#a5f3fc',
              borderRadius: 18,
              padding: 14,
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <MaterialIcons name="info-outline" size={16} color="#0891b2" />
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#0e7490' }}>
                ملخّص الكلفة
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: '#155e75',
                textAlign: 'right',
                lineHeight: 18,
              }}
            >
              تُخصم <Text style={{ fontWeight: '900' }}>1,000 د.ع</Text> لكل طلب يتمّ خلال
              العرض.
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: '#155e75',
                textAlign: 'right',
                lineHeight: 18,
              }}
            >
              رصيدك الحالي{' '}
              <Text style={{ fontWeight: '900' }}>{n(walletBalanceIqd)} د.ع</Text> — يكفي
              لـ <Text style={{ fontWeight: '900' }}>{n(ordersAffordable)}</Text> طلب كحدّ أقصى.
            </Text>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            padding: 14,
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
          }}
        >
          <SafeAreaView edges={['bottom']}>
            <Pressable
              onPress={onSubmit}
              disabled={!valid || create.isPending}
              style={({ pressed }) => ({
                borderRadius: 18,
                overflow: 'hidden',
                opacity: !valid || create.isPending ? 0.6 : pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={valid ? ['#14b8a6', '#0e9384'] : ['#cbd5e1', '#94a3b8']}
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
                {create.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="campaign" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                      إنشاء العرض
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
