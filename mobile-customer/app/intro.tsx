/**
 * First-run intro carousel — "how Daari works" in 4 animated slides.
 * Shown ONCE (flag persisted in AsyncStorage via lib/features/intro).
 *
 * Gated in app/_layout.tsx: a freshly-authenticated user who hasn't seen
 * the intro is redirected here before the tabs. Skip / Get-started both
 * mark the flag and route to home.
 *
 * Design: animated gradient hero icon per slide, paginated dots, swipe +
 * tap-through, looping pulse, RTL.
 */
import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { hap } from '@/lib/haptics';
import { markIntroSeen } from '@/lib/features/intro';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  grad: [string, string];
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'water',
    grad: ['#22d3ee', '#0891b2'],
    title: 'ماؤك يصل إليك',
    body: 'لا داعي لحمل القناني الثقيلة. اطلب تعبئة خزانك بضغطة واحدة ونحن نوصلها لباب بيتك.',
  },
  {
    icon: 'flash',
    grad: ['#34d399', '#059669'],
    title: 'اطلب بضغطة',
    body: 'من الشاشة الرئيسية اضغط «اطلب تعبئة الآن». طلبك يصل المعمل فوراً ويُعيَّن له سائق.',
  },
  {
    icon: 'navigate-circle',
    grad: ['#a78bfa', '#7c3aed'],
    title: 'تابع سائقك مباشرة',
    body: 'شاهد موقع السائق على الخريطة وتقدير وقت الوصول لحظة بلحظة حتى يطرق بابك.',
  },
  {
    icon: 'repeat',
    grad: ['#fbbf24', '#d97706'],
    title: 'لا تنسَ ماءك أبداً',
    body: 'فعّل التعبئة التلقائية الدورية، واحفظ عناوينك، واكسب نقاط ولاء مع كل تعبئة.',
  },
];

export default function Intro() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  async function finish() {
    hap.success();
    await markIntroSeen();
    router.replace('/(tabs)/home');
  }

  function next() {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    hap.tap();
    const ni = index + 1;
    scrollRef.current?.scrollTo({ x: ni * width, animated: true });
    setIndex(ni);
  }

  async function skip() {
    hap.tap();
    await markIntroSeen();
    router.replace('/(tabs)/home');
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <LinearGradient colors={['#ecfeff', '#f8fafc']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Skip */}
        <View className="flex-row-reverse px-5 pt-2">
          {!isLast && (
            <Pressable onPress={skip} hitSlop={8} style={{ marginRight: 'auto' as any }}>
              <Text style={{ color: '#0891b2', fontWeight: '700', fontSize: 13 }}>تخطّي</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // RTL note: RN flips horizontal scroll under RTL automatically; we
          // track the page by rounding the offset so dots stay in sync either way.
          onMomentumScrollEnd={(e) => {
            const i = Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width);
            setIndex(i);
          }}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
              {/* Pulsing gradient hero icon */}
              <MotiView
                from={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 13 }}
              >
                <MotiView
                  from={{ scale: 1 }}
                  animate={{ scale: 1.06 }}
                  transition={{ loop: true, type: 'timing', duration: 1500 }}
                >
                  <LinearGradient
                    colors={s.grad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 150,
                      height: 150,
                      borderRadius: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: s.grad[1],
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.4,
                      shadowRadius: 24,
                      elevation: 10,
                    }}
                  >
                    <Ionicons name={s.icon} size={72} color="#fff" />
                  </LinearGradient>
                </MotiView>
              </MotiView>

              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', delay: 150, duration: 500 }}
                style={{ alignItems: 'center', marginTop: 40 }}
              >
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#0e7490', textAlign: 'center' }}>{s.title}</Text>
                <Text style={{ fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 12, lineHeight: 24 }}>{s.body}</Text>
              </MotiView>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View className="flex-row-reverse justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <MotiView
              key={i}
              animate={{ width: i === index ? 24 : 8, backgroundColor: i === index ? '#0891b2' : '#cbd5e1' }}
              transition={{ type: 'timing', duration: 250 }}
              style={{ height: 8, borderRadius: 4 }}
            />
          ))}
        </View>

        {/* CTA */}
        <View className="px-6 pb-4">
          <Pressable onPress={next}>
            <LinearGradient
              colors={['#06b6d4', '#0891b2', '#0e7490']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                borderRadius: 18,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: '#0891b2',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Ionicons name={isLast ? 'rocket' : 'arrow-back'} size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {isLast ? 'لنبدأ' : 'التالي'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
