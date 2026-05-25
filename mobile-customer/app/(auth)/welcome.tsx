import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';

/**
 * First-launch screen. Two clear paths the user picks between:
 *   1. "I already have an account" → login (plant pre-provisioned them)
 *   2. "Find a plant near me" → signup wizard (true self-discovery)
 *
 * Design priorities:
 *  - Both cards visible on first paint (no scrolling needed on smallest
 *    iPhone screen)
 *  - Heavy use of icons + microcopy so the user knows which fits THEM
 *    without thinking too hard
 *  - The discovery path (Path 2) is slightly more prominent — that's
 *    the entry point for viral growth, and we want first-time users to
 *    explore it rather than bounce
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#7dd3fc', '#38bdf8', '#0ea5e9']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Compact hero — keeps room for the action cards below */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={{ alignItems: 'center', marginBottom: 24 }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
                marginBottom: 10,
              }}
            >
              <MaterialIcons name="water-drop" size={42} color="#fff" />
            </View>
            <Text className="text-white text-2xl font-bold">داري</Text>
            <Text className="text-sky-50 text-xs mt-1 text-center" style={{ opacity: 0.9 }}>
              ماء نقي يصل لباب بيتك من أقرب معمل
            </Text>
          </MotiView>

          {/* Question — gives the user permission to scan and pick */}
          <Text className="text-white text-base font-bold text-center mb-3">
            كيف تستخدم داري؟
          </Text>

          {/* Path 1 — existing customer */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 150 }}
          >
            <Pressable
              onPress={() => router.push('/(auth)/login' as any)}
              style={({ pressed }) => ({
                backgroundColor: '#ffffff',
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 5,
              })}
            >
              <View className="flex-row-reverse items-center gap-3 mb-2">
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: '#e0f2fe',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="key" size={24} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="font-bold text-slate-900 text-base text-right">
                    عندي حساب من المعمل
                  </Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5 text-right">
                    أحد المعامل أعطاك رقم وكلمة مرور
                  </Text>
                </View>
                <MaterialIcons name="arrow-back-ios" size={14} color="#0284c7" />
              </View>
              <View className="flex-row-reverse items-center gap-1.5 mt-1 pt-2 border-t border-slate-100">
                <MaterialIcons name="check-circle" size={12} color="#10b981" />
                <Text className="text-[10px] text-slate-500 text-right flex-1">
                  دخول مباشر بالهاتف وكلمة المرور
                </Text>
              </View>
            </Pressable>
          </MotiView>

          {/* "OR" divider */}
          <View className="flex-row-reverse items-center my-1 gap-2">
            <View className="flex-1 h-px bg-white/30" />
            <Text className="text-white/80 text-[11px] font-bold">أو</Text>
            <View className="flex-1 h-px bg-white/30" />
          </View>

          {/* Path 2 — discovery (more prominent gradient) */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 300 }}
          >
            <Pressable
              onPress={() => router.push('/(auth)/signup' as any)}
              style={({ pressed }) => ({
                borderRadius: 18,
                overflow: 'hidden',
                marginTop: 4,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: '#047857',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 14,
                elevation: 7,
              })}
            >
              <LinearGradient
                colors={['#10b981', '#059669', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16 }}
              >
                <View className="flex-row-reverse items-center gap-3 mb-2">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    <MaterialIcons name="search" size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="font-bold text-white text-base text-right">
                      جديد على داري؟
                    </Text>
                    <Text className="text-emerald-50 text-[11px] mt-0.5 text-right">
                      اكتشف معمل قريب واطلب خدمة فوراً
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-back-ios" size={14} color="#fff" />
                </View>
                <View className="flex-row-reverse items-center gap-3 mt-1 pt-2 border-t border-white/20">
                  <View className="flex-row-reverse items-center gap-1">
                    <MaterialIcons name="location-on" size={12} color="#d1fae5" />
                    <Text className="text-[10px] text-emerald-50">معامل في منطقتك</Text>
                  </View>
                  <View className="flex-row-reverse items-center gap-1">
                    <MaterialIcons name="local-shipping" size={12} color="#d1fae5" />
                    <Text className="text-[10px] text-emerald-50">توصيل خزان</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </MotiView>

          {/* Spacer pushes footer to the bottom of the available space */}
          <View style={{ flex: 1, minHeight: 16 }} />

          {/* Footer — legal + support */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 600 }}
            style={{ alignItems: 'center', gap: 6 }}
          >
            <Pressable onPress={() => Linking.openURL('https://daari-admin.phi-bit.com/legal/terms')}>
              <Text className="text-white/80 text-[11px] underline">الشروط والخصوصية</Text>
            </Pressable>
            <Text className="text-white/60 text-[10px]">
              من فاي‑بِت · إصدار 0.1
            </Text>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
