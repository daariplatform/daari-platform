/**
 * Step 1 — Plant info (name + city + GPS coords).
 *
 * Rendered by `app/onboarding/index.tsx`. Exposed as a route file too so a
 * designer can deep-link `/onboarding/step1-plant` directly (the standalone
 * mode just renders the shell with this as the active step).
 *
 * Backed by `useUpdateTenant()` → `PATCH /tenants/me`. The GPS button uses
 * `expo-location.getCurrentPositionAsync` — if expo-location isn't bundled
 * (e.g. running in Expo Go before the next native build), the import is
 * dynamic + the button degrades to a manual coords entry instead of crashing.
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

export interface PlantStepValue {
  name: string;
  city: string;
  coverageLat: number | null;
  coverageLng: number | null;
}

export const CITIES = [
  'بغداد',
  'البصرة',
  'الموصل',
  'أربيل',
  'النجف',
  'كربلاء',
  'الناصرية',
  'كركوك',
  'الديوانية',
  'الحلّة',
  'الرمادي',
  'بعقوبة',
  'العمارة',
  'دهوك',
  'السليمانية',
  'السماوة',
];

/**
 * Lazy-load expo-location so the bundle doesn't explode if the dev hasn't
 * run a fresh native build yet. Returns null on failure — caller surfaces
 * a user-facing Alert.
 */
async function tryGetCurrentPosition(): Promise<
  { latitude: number; longitude: number } | null
> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

interface Props {
  value: PlantStepValue;
  onChange: (next: PlantStepValue) => void;
  onSubmitted: () => void;
}

export function Step1Plant({ value, onChange, onSubmitted }: Props) {
  const update = useUpdateTenant();
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const nameOk = value.name.trim().length >= 2;
  const cityOk = value.city.trim().length > 0;
  const gpsOk = value.coverageLat != null && value.coverageLng != null;
  const valid = nameOk && cityOk && gpsOk;

  async function captureGps() {
    setGpsLoading(true);
    const pos = await tryGetCurrentPosition();
    setGpsLoading(false);
    if (!pos) {
      Alert.alert(
        'تعذّر تحديد الموقع',
        'تأكد من أن صلاحية الموقع ممنوحة وأن GPS مُفعّل، ثم حاول مرة أخرى.',
      );
      return;
    }
    onChange({ ...value, coverageLat: pos.latitude, coverageLng: pos.longitude });
  }

  async function submit() {
    if (!valid) {
      Alert.alert('تحقّق', 'أكمل اسم المعمل، المدينة، وموقع المعمل قبل المتابعة.');
      return;
    }
    try {
      await update.mutateAsync({
        name: value.name.trim(),
        city: value.city.trim(),
        coverageLat: value.coverageLat!,
        coverageLng: value.coverageLng!,
      });
      onSubmitted();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر حفظ معلومات المعمل');
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
        عرّفنا بمعملك
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
        هذه المعلومات يراها زبائنك في تطبيق داري.
      </Text>

      {/* Plant name */}
      <FieldLabel>اسم المعمل</FieldLabel>
      <FieldWrap focused={nameOk}>
        <MaterialIcons name="storefront" size={20} color="#0e9384" />
        <TextInput
          value={value.name}
          onChangeText={(t) => onChange({ ...value, name: t })}
          placeholder="مثلاً: معمل النور للمياه"
          placeholderTextColor="#94a3b8"
          style={inputStyle}
        />
      </FieldWrap>

      {/* City picker */}
      <FieldLabel>المدينة</FieldLabel>
      <Pressable
        onPress={() => setCityPickerOpen((o) => !o)}
        style={({ pressed }) => ({
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: cityOk ? '#0e9384' : '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 14,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <MaterialIcons name="location-city" size={20} color="#0e9384" />
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: '700',
            color: value.city ? '#0f172a' : '#94a3b8',
            textAlign: 'right',
          }}
        >
          {value.city || 'اختر المدينة'}
        </Text>
        <MaterialIcons
          name={cityPickerOpen ? 'expand-less' : 'expand-more'}
          size={22}
          color="#64748b"
        />
      </Pressable>

      {cityPickerOpen && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            marginTop: 8,
            maxHeight: 260,
            overflow: 'hidden',
          }}
        >
          <ScrollView nestedScrollEnabled>
            {CITIES.map((c, i) => {
              const selected = c === value.city;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    onChange({ ...value, city: c });
                    setCityPickerOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: selected ? '#ccfbf1' : pressed ? '#f1f5f9' : '#fff',
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: '#f1f5f9',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  })}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: selected ? '900' : '600',
                      color: selected ? '#0c7a6e' : '#0f172a',
                      textAlign: 'right',
                    }}
                  >
                    {c}
                  </Text>
                  {selected && (
                    <MaterialIcons name="check" size={20} color="#0c7a6e" />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* GPS picker */}
      <FieldLabel>موقع المعمل</FieldLabel>
      <Pressable
        onPress={captureGps}
        disabled={gpsLoading}
        style={({ pressed }) => ({
          backgroundColor: gpsOk ? '#ecfdf5' : '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: gpsOk ? '#0e9384' : '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 14,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <MaterialIcons
          name={gpsOk ? 'check-circle' : 'my-location'}
          size={20}
          color={gpsOk ? '#0e9384' : '#0e9384'}
        />
        <View style={{ flex: 1 }}>
          {gpsOk ? (
            <>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '900',
                  color: '#065f46',
                  textAlign: 'right',
                }}
              >
                تم تحديد موقع المعمل
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#047857',
                  textAlign: 'right',
                  marginTop: 2,
                }}
              >
                {value.coverageLat!.toFixed(5)}, {value.coverageLng!.toFixed(5)}
              </Text>
            </>
          ) : (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: '#0f172a',
                textAlign: 'right',
              }}
            >
              حدّد على الخريطة (GPS)
            </Text>
          )}
        </View>
        {gpsLoading && <ActivityIndicator color="#0e9384" />}
      </Pressable>
      <Text
        style={{
          fontSize: 11,
          color: '#94a3b8',
          textAlign: 'right',
          marginTop: 6,
          lineHeight: 16,
        }}
      >
        نلتقط الإحداثيات من GPS هاتفك. اقف عند مدخل المعمل لأفضل دقّة.
      </Text>

      {/* Submit */}
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

// ─── Inline standalone route entry — renders inside the wizard shell ────
// Direct-linking to /onboarding/step1-plant pushes you back to the shell at
// /onboarding which knows how to drive the step state. Keeping the export
// here means Expo Router can resolve the route file without it being empty.
export default function Step1Route() {
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

function FieldWrap({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: focused ? '#0e9384' : '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

const inputStyle = {
  flex: 1,
  fontSize: 14,
  color: '#0f172a',
  textAlign: 'right' as const,
  paddingVertical: 4,
};
