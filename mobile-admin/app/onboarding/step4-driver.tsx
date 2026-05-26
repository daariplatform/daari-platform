/**
 * Step 4 — Hire first driver.
 *
 * Uses the existing `useCreateDriver()` hook from `lib/queries.ts` (POST /drivers).
 * The parallel "drivers" agent is finalising that endpoint — the mutation
 * surface is already in place so this step just calls it with the right
 * payload shape. Phone follows the same `^07\d{9}$` validation; commission
 * percentage is clamped 0-50 (anything higher is a typo or unfair).
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

import { useCreateDriver } from '@/lib/queries';

export interface DriverStepValue {
  fullName: string;
  phone: string;
  baseCommissionPct: number;
  salaryIqd: number;
}

const IRAQI_PHONE_RE = /^07\d{9}$/;

interface Props {
  value: DriverStepValue;
  onChange: (next: DriverStepValue) => void;
  onSubmitted: () => void;
  onSkip: () => void;
}

export function Step4Driver({ value, onChange, onSubmitted, onSkip }: Props) {
  const create = useCreateDriver();
  const [touched, setTouched] = useState(false);

  const nameOk = value.fullName.trim().length >= 2;
  const phoneOk = IRAQI_PHONE_RE.test(value.phone.trim());
  const commissionOk =
    Number.isFinite(value.baseCommissionPct) &&
    value.baseCommissionPct >= 0 &&
    value.baseCommissionPct <= 50;
  const salaryOk = Number.isFinite(value.salaryIqd) && value.salaryIqd >= 0;
  const valid = nameOk && phoneOk && commissionOk && salaryOk;

  async function submit() {
    setTouched(true);
    if (!valid) {
      Alert.alert(
        'تحقّق',
        !phoneOk
          ? 'رقم الهاتف يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً.'
          : !commissionOk
            ? 'نسبة العمولة بين 0 و 50%.'
            : 'أكمل جميع الحقول المطلوبة.',
      );
      return;
    }
    try {
      await create.mutateAsync({
        fullName: value.fullName.trim(),
        phone: value.phone.trim(),
        baseCommissionPct: value.baseCommissionPct,
        salaryIqd: value.salaryIqd,
      });
      onSubmitted();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إضافة السائق');
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
        وظّف أول سائق
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: '#64748b',
          textAlign: 'right',
          marginTop: 6,
          marginBottom: 18,
        }}
      >
        تأكّد أن السائق موافق على تنزيل تطبيق &quot;داري للسائقين&quot; — هذه طريقتهم
        لاستلام الطلبات.
      </Text>

      <Field
        label="اسم السائق"
        icon="person"
        value={value.fullName}
        onChangeText={(t) => onChange({ ...value, fullName: t })}
        placeholder="مثلاً: علي حسين"
        invalid={touched && !nameOk}
      />
      <Field
        label="رقم الهاتف"
        icon="phone"
        value={value.phone}
        onChangeText={(t) => onChange({ ...value, phone: t })}
        placeholder="07XXXXXXXXX"
        keyboardType="phone-pad"
        invalid={touched && !phoneOk}
      />
      <Field
        label="نسبة العمولة (%)"
        icon="percent"
        value={value.baseCommissionPct === 0 ? '' : String(value.baseCommissionPct)}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(/[^0-9.]/g, ''));
          onChange({ ...value, baseCommissionPct: Number.isFinite(n) ? n : 0 });
        }}
        placeholder="مثلاً: 10"
        keyboardType="number-pad"
        invalid={touched && !commissionOk}
        suffix="%"
      />
      <Field
        label="الراتب الشهري (د.ع)"
        icon="payments"
        value={value.salaryIqd === 0 ? '' : String(value.salaryIqd)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
          onChange({ ...value, salaryIqd: Number.isFinite(n) ? n : 0 });
        }}
        placeholder="مثلاً: 400000"
        keyboardType="number-pad"
        invalid={touched && !salaryOk}
        suffix="د.ع"
      />
      <Text
        style={{
          fontSize: 11,
          color: '#94a3b8',
          textAlign: 'right',
          marginTop: 4,
          lineHeight: 16,
        }}
      >
        ضع 0 إذا كنت تعمل بنظام العمولة فقط بدون راتب ثابت.
      </Text>

      <Pressable
        onPress={submit}
        disabled={create.isPending}
        style={({ pressed }) => ({
          marginTop: 24,
          backgroundColor: '#0e9384',
          borderRadius: 18,
          paddingVertical: 16,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {create.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MaterialIcons name="local-shipping" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
              توظيف السائق
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={onSkip}
        style={({ pressed }) => ({
          marginTop: 12,
          alignItems: 'center',
          paddingVertical: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '700' }}>
          تخطّي هذه الخطوة
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export default function Step4Route() {
  return null;
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  invalid,
  suffix,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  invalid?: boolean;
  suffix?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: '#475569',
          textAlign: 'right',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: invalid ? '#fecaca' : '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <MaterialIcons name={icon} size={20} color={invalid ? '#dc2626' : '#0e9384'} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType ?? 'default'}
          style={{
            flex: 1,
            fontSize: 14,
            color: '#0f172a',
            textAlign: 'right',
            paddingVertical: 4,
          }}
        />
        {suffix && (
          <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '700' }}>
            {suffix}
          </Text>
        )}
      </View>
    </View>
  );
}
