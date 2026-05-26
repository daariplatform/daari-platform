/**
 * Step 5 — Onboarding complete. Cheerful confirmation screen + 3 tip cards
 * that point the new owner at the highest-leverage actions for week 1.
 * The "ابدأ الإدارة" CTA bounces them to the main tabs.
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  onFinish: () => void;
}

const TIPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'share',
    title: 'شارك تطبيق "داري" مع زبائنك',
    body: 'حمّلهم تطبيق العميل ليطلبوا تعبئة مباشرة بضغطة واحدة.',
  },
  {
    icon: 'local-offer',
    title: 'افحص شاشة "العروض"',
    body: 'يمكنك زيادة طلباتك بإطلاق سعر ترويجي محدود لساعات.',
  },
  {
    icon: 'insights',
    title: 'راقب لوحة المعلومات يومياً',
    body: 'الأرقام تكشف فرص نموّ وأماكن نقص قبل أن تتحوّل لمشاكل.',
  },
];

export function Step5Done({ onFinish }: Props) {
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 40,
        alignItems: 'center',
      }}
    >
      {/* Celebration medallion */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: '#ccfbf1',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 24,
          marginBottom: 12,
          shadowColor: '#0e9384',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <MaterialIcons name="celebration" size={52} color="#0e9384" />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        كل شيء جاهز!
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: '#64748b',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 24,
          paddingHorizontal: 12,
          lineHeight: 20,
        }}
      >
        معملك على داري يعمل الآن. هذي بعض النصائح التي تساعدك تنطلق بأفضل شكل:
      </Text>

      {/* Tip cards */}
      <View style={{ width: '100%', gap: 12 }}>
        {TIPS.map((tip) => (
          <View
            key={tip.title}
            style={{
              backgroundColor: '#fff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 14,
              flexDirection: 'row-reverse',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#ecfdf5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name={tip.icon} size={22} color="#0e9384" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '900',
                  color: '#0f172a',
                  textAlign: 'right',
                  marginBottom: 4,
                }}
              >
                {tip.title}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#475569',
                  textAlign: 'right',
                  lineHeight: 18,
                }}
              >
                {tip.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onFinish}
        style={({ pressed }) => ({
          marginTop: 32,
          backgroundColor: '#0e9384',
          borderRadius: 18,
          paddingVertical: 16,
          paddingHorizontal: 28,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: 'stretch',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <MaterialIcons name="arrow-back" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
          ابدأ الإدارة
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export default function Step5Route() {
  return null;
}
