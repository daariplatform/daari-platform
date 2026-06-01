/**
 * Celebratory particle burst — a confetti-style explosion built purely from
 * Reanimated (NO new npm dep). Mount it (e.g. after a rating is submitted)
 * and it fires once: ~18 colored shards fly outward, spin, and fade.
 *
 * Usage:
 *   {showBurst && <Burst onDone={() => setShowBurst(false)} />}
 *
 * Renders an absolutely-positioned, non-interactive overlay centered on its
 * parent, so wrap it in a relatively-positioned container (or full screen).
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const COLORS = ['#06b6d4', '#22d3ee', '#0891b2', '#34d399', '#fbbf24', '#a78bfa'];
const COUNT = 18;

function Particle({ index, total }: { index: number; total: number }) {
  const progress = useSharedValue(0);
  // Spread shards evenly around the circle, with a little randomness so it
  // doesn't look mechanical.
  const angle = (index / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
  const distance = 90 + Math.random() * 70;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const color = COLORS[index % COLORS.length];
  const size = 7 + Math.random() * 7;
  const spin = (Math.random() - 0.5) * 720;

  useEffect(() => {
    progress.value = withDelay(
      index * 12,
      withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, index]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: dx * p },
        // gravity bias — shards arc downward as they fly out
        { translateY: dy * p + 60 * p * p },
        { rotate: `${spin * p}deg` },
        { scale: 1 - 0.3 * p },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size * 1.6,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function Burst({ onDone }: { onDone?: () => void }) {
  const life = useSharedValue(0);
  useEffect(() => {
    // Fire onDone once the longest particle has surely finished.
    life.value = withDelay(
      1100,
      withTiming(1, { duration: 1 }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }),
    );
  }, [life, onDone]);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.center}>
        {Array.from({ length: COUNT }).map((_, i) => (
          <Particle key={i} index={i} total={COUNT} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  center: { width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
});
