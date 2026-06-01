/**
 * In-app support — FAQ accordion (Arabic, water-delivery questions),
 * WhatsApp contact, and a "report a problem" prefilled message.
 *
 * Reached from: profile → "المساعدة والدعم".
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { hap } from '@/lib/haptics';

const SUPPORT_PHONE = '9647752222558'; // wa.me / tel
const SUPPORT_EMAIL = 'info@phi-bit.com';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'كيف أطلب تعبئة الخزان؟',
    a: 'من الشاشة الرئيسية اضغط زر «اطلب تعبئة الآن». سيصلك سائق إلى عنوانك المسجّل، ويمكنك متابعته على الخريطة لحظة بلحظة.',
  },
  {
    q: 'كم تكلفة التعبئة؟',
    a: 'سعر التعبئة يظهر على زر الطلب في الشاشة الرئيسية ويُحدّده معملك. الدفع نقداً عند استلام التعبئة.',
  },
  {
    q: 'متى يصل السائق؟',
    a: 'بعد تعيين السائق يظهر لك تقدير زمني للوصول محسوب من موقعه الحالي. يتحدّث التقدير تلقائياً أثناء الطريق.',
  },
  {
    q: 'هل يمكنني إلغاء الطلب؟',
    a: 'نعم، يمكنك إلغاء الطلب طالما لم يبدأ السائق بالتوصيل (الحالة بانتظار التأكيد أو مُسنَد لسائق). افتح الطلب واضغط «إلغاء الطلب».',
  },
  {
    q: 'كيف أضيف أكثر من عنوان؟',
    a: 'من «حسابي» → «عناويني المحفوظة» يمكنك إضافة عناوين متعددة (البيت، العمل) وتعيين عنوان افتراضي للتوصيل.',
  },
  {
    q: 'ما هي التعبئة التلقائية؟',
    a: 'يمكنك جدولة تعبئة دورية (أسبوعية أو شهرية) ونحن نرسل لك الطلب تلقائياً في موعده — من «حسابي» → «التعبئة التلقائية».',
  },
  {
    q: 'نسيت كلمة المرور، ماذا أفعل؟',
    a: 'من شاشة تسجيل الدخول اضغط «نسيت كلمة المرور» واتبع الخطوات، أو تواصل معنا عبر واتساب وسنساعدك فوراً.',
  },
];

function openWhatsApp(message: string) {
  const url = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert('تعذّر فتح واتساب', 'تأكد من تثبيت تطبيق واتساب أو تواصل عبر البريد.'),
  );
}

export default function SupportScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#0e7490', '#0891b2', '#06b6d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-3 pb-4 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">المساعدة والدعم</Text>
              <Text className="text-cyan-100 text-xs mt-0.5">نحن هنا لمساعدتك</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Contact cards */}
        <View className="flex-row-reverse gap-3 mb-5">
          <ContactCard
            grad={['#22c55e', '#16a34a']}
            icon="logo-whatsapp"
            title="تواصل عبر واتساب"
            subtitle="رد سريع"
            onPress={() => { hap.press(); openWhatsApp('مرحباً، أحتاج مساعدة بخصوص تطبيق داري للماء.'); }}
          />
          <ContactCard
            grad={['#f59e0b', '#d97706']}
            icon="alert-circle"
            title="أبلغ عن مشكلة"
            subtitle="نحلّها بسرعة"
            onPress={() => {
              hap.press();
              Alert.alert('أبلغ عن مشكلة', 'كيف تفضّل التواصل؟', [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'واتساب',
                  onPress: () =>
                    openWhatsApp('أرغب بالإبلاغ عن مشكلة في تطبيق داري:\n\n(صف المشكلة هنا)'),
                },
                {
                  text: 'بريد إلكتروني',
                  onPress: () =>
                    Linking.openURL(
                      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('مشكلة في تطبيق داري')}&body=${encodeURIComponent('صف المشكلة هنا:')}`,
                    ).catch(() => Alert.alert('تعذّر فتح البريد', SUPPORT_EMAIL)),
                },
              ]);
            }}
          />
        </View>

        {/* FAQ accordion */}
        <Text className="text-base font-bold text-right mb-3 px-1">الأسئلة الشائعة</Text>
        {FAQ.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <MotiView
              key={idx}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: idx * 50, duration: 300 }}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                marginBottom: 10,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: isOpen ? '#a5f3fc' : '#f1f5f9',
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
              }}
            >
              <Pressable
                onPress={() => { hap.tap(); setOpen(isOpen ? null : idx); }}
                className="flex-row-reverse items-center justify-between p-4"
              >
                <View className="flex-row-reverse items-center gap-2 flex-1">
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="help" size={16} color="#0891b2" />
                  </View>
                  <Text className="text-sm font-bold text-slate-800 text-right flex-1">{item.q}</Text>
                </View>
                <MotiView animate={{ rotate: isOpen ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 200 }}>
                  <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                </MotiView>
              </Pressable>
              {isOpen && (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 250 }}
                  style={{ paddingHorizontal: 16, paddingBottom: 16 }}
                >
                  <Text className="text-xs text-slate-600 leading-6 text-right">{item.a}</Text>
                </MotiView>
              )}
            </MotiView>
          );
        })}

        {/* Still need help footer */}
        <View style={{ backgroundColor: '#ecfeff', borderRadius: 16, padding: 16, marginTop: 8, alignItems: 'center' }}>
          <Ionicons name="chatbubbles" size={28} color="#0891b2" />
          <Text className="text-sm font-bold text-slate-800 mt-2">لم تجد إجابتك؟</Text>
          <Text className="text-xs text-slate-500 mt-1 text-center">تواصل معنا مباشرة وسنردّ عليك في أسرع وقت</Text>
          <Pressable
            onPress={() => { hap.press(); openWhatsApp('مرحباً، لدي سؤال:'); }}
            className="flex-row-reverse items-center gap-2 mt-3 bg-green-600 px-5 py-2.5 rounded-full"
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text className="text-white font-bold text-sm">راسلنا الآن</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ContactCard({
  grad,
  icon,
  title,
  subtitle,
  onPress,
}: {
  grad: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 16,
          alignItems: 'center',
          gap: 6,
          shadowColor: grad[1],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <Ionicons name={icon} size={28} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10 }}>{subtitle}</Text>
      </LinearGradient>
    </Pressable>
  );
}
