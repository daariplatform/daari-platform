import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-store';

interface Props {
  online: boolean;
  queuedCount: number;
}

/**
 * Top chrome shared across all worker tabs: name, online indicator,
 * offline-queue counter, and the dual-mode switcher when applicable.
 * Sky-blue gradient matches the customer app for brand consistency.
 */
export function WorkerHeader({ online, queuedCount }: Props) {
  const { user } = useAuth();
  return (
    <LinearGradient
      colors={['#38bdf8', '#0ea5e9', '#0284c7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
      }}
    >
      <SafeAreaView edges={['top']}>
        <View className="flex-row-reverse items-center justify-between" style={{ paddingTop: 4 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text className="text-sky-100 text-[13px] font-bold">سائق المعمل</Text>
            <Text className="text-white font-bold text-lg" style={{ letterSpacing: 0.3 }}>
              {user?.phone || 'مستخدم'}
            </Text>
          </View>
          <View
            className={`flex-row-reverse items-center gap-1.5 px-3 py-1.5 rounded-full ${
              online ? 'bg-white/22' : 'bg-amber-100'
            }`}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: online ? '#bbf7d0' : '#f59e0b',
              }}
            />
            <Text
              className={`text-[11px] font-bold ${
                online ? 'text-white' : 'text-amber-700'
              }`}
            >
              {online ? 'متصل' : 'بدون إنترنت'}
            </Text>
          </View>
        </View>

        {!online && (
          <View className="bg-white/15 border border-white/30 rounded-xl px-3 py-2.5 mt-3 flex-row-reverse items-center gap-2">
            <MaterialIcons name="cloud-off" size={20} color="#fff" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text className="text-[12px] font-bold text-white text-right">
                يعمل بدون إنترنت
              </Text>
              <Text className="text-[10px] text-sky-100 text-right">
                GPS والصور تعمل، التزامن عند عودة الإنترنت
              </Text>
            </View>
            {queuedCount > 0 && (
              <View className="bg-white/30 px-2 py-1 rounded-full">
                <Text className="text-white text-[10px] font-bold">
                  {queuedCount} في الانتظار
                </Text>
              </View>
            )}
          </View>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}
