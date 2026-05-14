import { View, Text } from 'react-native';
import { ModeSwitcher } from './ModeSwitcher';
import { useAuth } from '@/lib/auth-store';

interface Props {
  online: boolean;
  queuedCount: number;
}

/**
 * Top chrome shared across all worker tabs: name, online indicator,
 * offline-queue counter, and the dual-mode switcher when applicable.
 */
export function WorkerHeader({ online, queuedCount }: Props) {
  const { user, currentMode } = useAuth();
  return (
    <View className="bg-slate-900 px-4 pt-3 pb-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] text-slate-400">
            {currentMode === 'driver' ? 'وضع السائق' : currentMode === 'vendor' ? 'وضع البائع' : ''}
          </Text>
          <Text className="text-white font-bold text-base">{user?.phone || 'مستخدم'}</Text>
        </View>
        <View
          className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
            online ? 'bg-leaf-500/20' : 'bg-warn-500/20'
          }`}
        >
          <View
            className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-leaf-400' : 'bg-warn-400'}`}
          />
          <Text
            className={`text-[10px] font-bold ${online ? 'text-leaf-300' : 'text-warn-300'}`}
          >
            {online ? 'متصل' : 'بدون إنترنت'}
          </Text>
        </View>
      </View>

      {!online && (
        <View className="bg-warn-500/15 border border-warn-500/30 rounded-lg px-3 py-2 mt-3 flex-row items-center gap-2">
          <Text className="text-warn-300">📡</Text>
          <View className="flex-1">
            <Text className="text-[11px] font-bold text-warn-200 text-right">
              يعمل بدون إنترنت
            </Text>
            <Text className="text-[10px] text-warn-200/80 text-right">
              GPS والصور تعمل عادي، التزامن عند عودة الإنترنت
            </Text>
          </View>
          {queuedCount > 0 && (
            <View className="bg-warn-500 px-2 py-1 rounded-full">
              <Text className="text-white text-[10px] font-bold">
                {queuedCount} في الانتظار
              </Text>
            </View>
          )}
        </View>
      )}

      <ModeSwitcher />
    </View>
  );
}
