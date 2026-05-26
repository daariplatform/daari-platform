/**
 * Step 3 — Add first customer.
 *
 * Hits `POST /customers` via `useCreateCustomer()`. Phone validation matches
 * the backend's `^07\d{9}$` Iraqi mobile pattern. Skipping is allowed and
 * is the common path — owners often want to set the plant up first and
 * import their existing book later from settings.
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

import { useCreateCustomer } from '@/lib/queries';

export interface CustomerStepValue {
  fullName: string;
  phone: string;
  district: string;
  addressLine: string;
}

const IRAQI_PHONE_RE = /^07\d{9}$/;

interface Props {
  value: CustomerStepValue;
  onChange: (next: CustomerStepValue) => void;
  onSubmitted: () => void;
  onSkip: () => void;
}

export function Step3Customer({ value, onChange, onSubmitted, onSkip }: Props) {
  const create = useCreateCustomer();
  const [touched, setTouched] = useState(false);

  const nameOk = value.fullName.trim().length >= 2;
  const phoneOk = IRAQI_PHONE_RE.test(value.phone.trim());
  const districtOk = value.district.trim().length > 0;
  const addressOk = value.addressLine.trim().length > 0;
  const valid = nameOk && phoneOk && districtOk && addressOk;

  async function submit() {
    setTouched(true);
    if (!valid) {
      Alert.alert(
        'تحقّق',
        !phoneOk
          ? 'رقم الهاتف يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً.'
          : 'أكمل جميع الحقول المطلوبة.',
      );
      return;
    }
    try {
      await create.mutateAsync({
        fullName: value.fullName.trim(),
        phone: value.phone.trim(),
        district: value.district.trim(),
        addressLine: value.addressLine.trim(),
      });
      onSubmitted();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إضافة الزبون');
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
        أضف أول زبون
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
        تمرين بسيط — يمكنك إضافة زبون تجريبي بنفسك، أو تخطّي هذه الخطوة.
      </Text>

      <Field
        label="الاسم الكامل"
        icon="person"
        value={value.fullName}
        onChangeText={(t) => onChange({ ...value, fullName: t })}
        placeholder="مثلاً: أحمد العاني"
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
        label="المنطقة / الحي"
        icon="map"
        value={value.district}
        onChangeText={(t) => onChange({ ...value, district: t })}
        placeholder="مثلاً: المنصور"
        invalid={touched && !districtOk}
      />
      <Field
        label="العنوان التفصيلي"
        icon="home"
        value={value.addressLine}
        onChangeText={(t) => onChange({ ...value, addressLine: t })}
        placeholder="رقم البيت، الشارع، أقرب نقطة دالة"
        invalid={touched && !addressOk}
      />

      {/* Submit + skip */}
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
            <MaterialIcons name="person-add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
              حفظ الزبون
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

export default function Step3Route() {
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
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  invalid?: boolean;
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
      </View>
    </View>
  );
}
