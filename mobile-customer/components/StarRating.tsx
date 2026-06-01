/**
 * Animated 1–5 star rating control.
 *
 *  - `editable`: tappable stars with a spring pop + haptic on each tap.
 *  - read-only: pass `editable={false}` to display a submitted rating.
 *
 * RTL-aware: stars are laid out in a row-reverse so star 1 sits on the right,
 * matching Arabic reading order.
 */
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { hap } from '@/lib/haptics';

export function StarRating({
  value,
  onChange,
  size = 44,
  editable = true,
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: number;
  editable?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const Wrapper = editable ? Pressable : View;
        return (
          <Wrapper
            key={n}
            onPress={
              editable
                ? () => {
                    hap.tap();
                    onChange?.(n);
                  }
                : undefined
            }
            hitSlop={6}
          >
            <MotiView
              animate={{ scale: filled ? 1.12 : 1, rotate: filled ? '0deg' : '0deg' }}
              transition={{ type: 'spring', damping: 10, stiffness: 220 }}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={size}
                color={filled ? '#fbbf24' : '#cbd5e1'}
              />
            </MotiView>
          </Wrapper>
        );
      })}
    </View>
  );
}
