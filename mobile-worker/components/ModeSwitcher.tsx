import { View, Text, Pressable } from 'react-native';
import { useAuth } from '@/lib/auth-store';

/**
 * Visible toggle when the same user holds both `driver` and `vendor`
 * capabilities. If they have only one, we hide the chrome entirely.
 */
export function ModeSwitcher() {
  const { capabilities, currentMode, setMode } = useAuth();
  const hasBoth =
    capabilities.includes('driver') && capabilities.includes('vendor');
  if (!hasBoth || !currentMode) return null;
  return (
    <View className="bg-white/10 backdrop-blur rounded-xl flex-row p-1 mt-3">
      <Pressable
        onPress={() => setMode('driver')}
        className={`flex-1 py-2 rounded-lg ${
          currentMode === 'driver' ? 'bg-aqua-500' : ''
        }`}
      >
        <Text
          className={`text-center text-xs font-bold ${
            currentMode === 'driver' ? 'text-white' : 'text-slate-300'
          }`}
        >
          🚛 سائق المعمل
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setMode('vendor')}
        className={`flex-1 py-2 rounded-lg ${
          currentMode === 'vendor' ? 'bg-warn-500' : ''
        }`}
      >
        <Text
          className={`text-center text-xs font-bold ${
            currentMode === 'vendor' ? 'text-white' : 'text-slate-300'
          }`}
        >
          🛺 بائع مستقل
        </Text>
      </Pressable>
    </View>
  );
}
