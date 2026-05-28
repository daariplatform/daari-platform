import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCreateWalkinOrder } from '@/lib/queries';
import { safeBack } from '@/lib/nav';

/**
 * Walk-in refill — quick over-the-counter sale. No customer record needed;
 * just liters + price + paid. Used when a delivery driver isn't involved
 * (someone shows up at the plant with their own jerrycans).
 */
export default function WalkinScreen() {
  const router = useRouter();
  const create = useCreateWalkinOrder();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [liters, setLiters] = useState('500');
  const [priceIqd, setPriceIqd] = useState('1000');
  const [paidAmountIqd, setPaidAmountIqd] = useState('1000');

  const litersNum = parseInt(liters, 10);
  const priceNum = parseInt(priceIqd, 10);
  const paidNum = parseInt(paidAmountIqd, 10);

  const validationError =
    !Number.isFinite(litersNum) || litersNum <= 0
      ? 'أدخل عدد لترات صحيح أكبر من صفر'
      : !Number.isFinite(priceNum) || priceNum <= 0
        ? 'أدخل سعراً صحيحاً أكبر من صفر'
        : !Number.isFinite(paidNum) || paidNum < 0
          ? 'أدخل مبلغ مدفوع صحيح'
          : paidNum > priceNum
            ? 'المبلغ المدفوع لا يمكن أن يتجاوز السعر'
            : null;

  async function submit() {
    if (validationError) {
      Alert.alert('تحقّق', validationError);
      return;
    }
    try {
      await create.mutateAsync({
        customerName: customerName.trim() || undefined,
        phone: phone.trim() || undefined,
        liters: litersNum,
        priceIqd: priceNum,
        paidAmountIqd: paidNum,
      });

      // Offer to send a WhatsApp receipt if the buyer left a phone — most
      // walk-in buyers in Iraq use WhatsApp, and "ضع رقمك نرسلك إيصال"
      // is a friendly closer that doubles as a future-customer hook.
      const phoneTrim = phone.trim();
      if (phoneTrim) {
        Alert.alert(
          'تم تسجيل الطلب',
          `${litersNum.toLocaleString('en-US')} لتر بـ ${paidNum.toLocaleString('en-US')} د.ع. هل تريد إرسال الإيصال بواتساب؟`,
          [
            { text: 'لا، شكراً', style: 'cancel', onPress: () => safeBack(router) },
            {
              text: 'إرسال إيصال',
              onPress: () => {
                const intlPhone = phoneTrim.replace(/^0/, '964');
                // Receipt text is plain Arabic so any WhatsApp version
                // renders it correctly without rich formatting issues.
                const msg = encodeURIComponent(
                  `إيصال داري\n` +
                    `الزبون: ${customerName.trim() || '—'}\n` +
                    `الكمية: ${litersNum.toLocaleString('en-US')} لتر\n` +
                    `السعر: ${priceNum.toLocaleString('en-US')} د.ع\n` +
                    `المدفوع: ${paidNum.toLocaleString('en-US')} د.ع\n` +
                    `التاريخ: ${new Date().toLocaleDateString('ar-IQ')}\n` +
                    `\nشكراً لاختياركم داري 💧`,
                );
                Linking.openURL(`https://wa.me/${intlPhone}?text=${msg}`).catch(() => {});
                safeBack(router);
              },
            },
          ],
        );
      } else {
        // No phone → quiet confirmation, no WhatsApp prompt.
        Alert.alert('تم', 'سُجّل الطلب');
        safeBack(router);
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إنشاء الطلب');
    }
  }

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
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
            طلب بيع مباشر
          </Text>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 14, textAlign: 'right' }}>
            معلومات الزبون اختيارية — يُستعمل غالباً للزبون العابر بدون حساب.
          </Text>

          <Field
            label="اسم الزبون (اختياري)"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="مثلاً: أبو علي"
            icon="person"
          />
          <Field
            label="الهاتف (اختياري)"
            value={phone}
            onChangeText={setPhone}
            placeholder="07XXXXXXXXX"
            icon="phone"
            keyboardType="phone-pad"
          />
          <Field
            label="عدد اللترات"
            value={liters}
            onChangeText={setLiters}
            placeholder="500"
            icon="water-drop"
            keyboardType="number-pad"
          />
          <Field
            label="السعر (د.ع)"
            value={priceIqd}
            onChangeText={(t) => {
              setPriceIqd(t);
              // Keep paid in sync as long as the admin hasn't overridden it
              // to a smaller amount — typical case is full payment.
              if (paidAmountIqd === priceIqd) setPaidAmountIqd(t);
            }}
            placeholder="1000"
            icon="payments"
            keyboardType="number-pad"
          />
          <Field
            label="المبلغ المدفوع (د.ع)"
            value={paidAmountIqd}
            onChangeText={setPaidAmountIqd}
            placeholder="1000"
            icon="account-balance-wallet"
            keyboardType="number-pad"
          />

          {validationError && (
            <View
              style={{
                backgroundColor: '#fef2f2',
                borderColor: '#fecaca',
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                marginTop: 8,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MaterialIcons name="error-outline" size={18} color="#dc2626" />
              <Text style={{ color: '#991b1b', fontSize: 12, fontWeight: '700' }}>
                {validationError}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom CTA */}
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
              onPress={submit}
              disabled={create.isPending || !!validationError}
              style={({ pressed }) => ({
                borderRadius: 18,
                overflow: 'hidden',
                opacity: pressed || create.isPending || validationError ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={
                  validationError ? ['#cbd5e1', '#94a3b8'] : ['#14b8a6', '#0e9384']
                }
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
                    <MaterialIcons name="check" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                      تسجيل الطلب
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
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
          borderColor: '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <MaterialIcons name={icon} size={20} color="#0e9384" />
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
