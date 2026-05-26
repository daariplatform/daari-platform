/**
 * Step 2 — Pricing & working hours. Sets the default refill price and the
 * daily ops window. Hits `PATCH /tenants/me` via `useUpdateTenant()`.
 *
 * We use a plus/minus stepper for the price (more friction than a free
 * TextInput, on purpose — a stray "100000" instead of "1000" would set
 * the plant uncompetitive overnight). Hours use a 24-slot circular picker
 * rather than a native time picker so we stay free of platform-specific
 * pickers (no extra deps).
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUpdateTenant } from '@/lib/queries';

export interface PricingStepValue {
  refillPriceIqd: number;
  workingHoursStart: string; // "HH:mm"
  workingHoursEnd: string;
}

const PRICE_STEP = 250;
const PRICE_MIN = 250;
const PRICE_MAX = 10_000;

interface Props {
  value: PricingStepValue;
  onChange: (next: PricingStepValue) => void;
  onSubmitted: () => void;
}

function fmtIqd(n: number) {
  return n.toLocaleString('en-US');
}

export function Step2Pricing({ value, onChange, onSubmitted }: Props) {
  const update = useUpdateTenant();
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

  const priceValid =
    Number.isFinite(value.refillPriceIqd) &&
    value.refillPriceIqd >= PRICE_MIN &&
    value.refillPriceIqd <= PRICE_MAX;
  const hoursValid = value.workingHoursStart < value.workingHoursEnd;
  const valid = priceValid && hoursValid;

  async function submit() {
    if (!valid) {
      Alert.alert(
        'تحقّق',
        priceValid
          ? 'ساعة البداية يجب أن تسبق ساعة النهاية.'
          : `أدخل سعراً صحيحاً بين ${fmtIqd(PRICE_MIN)} و ${fmtIqd(PRICE_MAX)} د.ع.`,
      );
      return;
    }
    try {
      await update.mutateAsync({
        refillPriceIqd: value.refillPriceIqd,
        workingHoursStart: value.workingHoursStart,
        workingHoursEnd: value.workingHoursEnd,
      });
      onSubmitted();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر حفظ التسعير');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'right',
          marginTop: 12,
        }}
      >
        حدّد أسعارك وساعات عملك
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: '#64748b',
          textAlign: 'right',
          marginTop: 6,
          marginBottom: 22,
        }}
      >
        تستطيع تعديل هذه القيم لاحقاً من الإعدادات.
      </Text>

      {/* Price stepper */}
      <FieldLabel>سعر التعبئة (د.ع)</FieldLabel>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() =>
            onChange({
              ...value,
              refillPriceIqd: Math.max(PRICE_MIN, value.refillPriceIqd - PRICE_STEP),
            })
          }
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <MaterialIcons name="remove" size={24} color="#475569" />
        </Pressable>

        <View
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: priceValid ? '#0e9384' : '#fecaca',
            paddingVertical: 12,
            paddingHorizontal: 12,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <TextInput
            value={String(value.refillPriceIqd)}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
              onChange({ ...value, refillPriceIqd: Number.isFinite(n) ? n : 0 });
            }}
            keyboardType="number-pad"
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#0f172a',
              textAlign: 'center',
              minWidth: 80,
              paddingVertical: 2,
            }}
          />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>د.ع</Text>
        </View>

        <Pressable
          onPress={() =>
            onChange({
              ...value,
              refillPriceIqd: Math.min(PRICE_MAX, value.refillPriceIqd + PRICE_STEP),
            })
          }
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <MaterialIcons name="add" size={24} color="#475569" />
        </Pressable>
      </View>
      <Text
        style={{
          fontSize: 11,
          color: '#94a3b8',
          textAlign: 'right',
          marginTop: 6,
        }}
      >
        السعر الذي يدفعه الزبون مقابل كل تعبئة 1000 لتر.
      </Text>

      {/* Hours */}
      <FieldLabel>ساعات العمل</FieldLabel>
      <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              color: '#64748b',
              textAlign: 'right',
              marginBottom: 4,
              fontWeight: '700',
            }}
          >
            من
          </Text>
          <TimeButton
            value={value.workingHoursStart}
            active={openPicker === 'start'}
            onPress={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              color: '#64748b',
              textAlign: 'right',
              marginBottom: 4,
              fontWeight: '700',
            }}
          >
            إلى
          </Text>
          <TimeButton
            value={value.workingHoursEnd}
            active={openPicker === 'end'}
            onPress={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
          />
        </View>
      </View>

      {openPicker && (
        <HoursGrid
          value={openPicker === 'start' ? value.workingHoursStart : value.workingHoursEnd}
          onPick={(hhmm) => {
            if (openPicker === 'start') {
              onChange({ ...value, workingHoursStart: hhmm });
            } else {
              onChange({ ...value, workingHoursEnd: hhmm });
            }
            setOpenPicker(null);
          }}
        />
      )}

      {!hoursValid && (
        <Text
          style={{
            fontSize: 11,
            color: '#b91c1c',
            fontWeight: '800',
            textAlign: 'right',
            marginTop: 8,
          }}
        >
          ساعة البداية يجب أن تسبق ساعة النهاية.
        </Text>
      )}

      <Pressable
        onPress={submit}
        disabled={!valid || update.isPending}
        style={({ pressed }) => ({
          marginTop: 28,
          backgroundColor: valid ? '#0e9384' : '#cbd5e1',
          borderRadius: 18,
          paddingVertical: 16,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed && valid ? 0.9 : 1,
        })}
      >
        {update.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
              حفظ والمتابعة
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default function Step2Route() {
  return null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
        textAlign: 'right',
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

function TimeButton({
  value,
  active,
  onPress,
}: {
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? '#0e9384' : '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <MaterialIcons name="schedule" size={20} color="#0e9384" />
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * 24-cell hour grid. Half-hour granularity would explode the grid; the few
 * plants that actually open at 7:30 can edit later in settings (the backend
 * accepts any HH:mm string, but typing 30 different hours in the wizard is
 * not the right tradeoff for setup speed).
 */
function HoursGrid({
  value,
  onPick,
}: {
  value: string;
  onPick: (hhmm: string) => void;
}) {
  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 8,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: 24 }, (_, i) => i).map((h) => {
          const hhmm = `${h.toString().padStart(2, '0')}:00`;
          const selected = hhmm === value;
          return (
            <Pressable
              key={h}
              onPress={() => onPick(hhmm)}
              style={({ pressed }) => ({
                width: '15%',
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: selected ? '#0e9384' : pressed ? '#f1f5f9' : '#fff',
                borderWidth: 1,
                borderColor: selected ? '#0e9384' : '#e2e8f0',
                alignItems: 'center',
              })}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: selected ? '#fff' : '#0f172a',
                }}
              >
                {hhmm}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
