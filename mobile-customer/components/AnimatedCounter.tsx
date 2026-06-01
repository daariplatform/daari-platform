/**
 * Animated number counter — tweens from 0 → `value` on mount (and whenever
 * `value` changes), so points/balances "count up" instead of snapping.
 *
 * Pure JS interval (no new dep). Numbers render with Latin digits to match
 * the rest of the app (iqd() uses en-US).
 */
import { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

export function AnimatedCounter({
  value,
  duration = 900,
  style,
  format,
}: {
  value: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  /** Optional formatter (e.g. iqd). Defaults to a Latin-grouped integer. */
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const start = Date.now();
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) {
      setDisplay(value);
      return;
    }
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t >= 1) {
        clearInterval(id);
        fromRef.current = value;
      }
    }, 16);
    return () => clearInterval(id);
  }, [value, duration]);

  const text = format ? format(display) : new Intl.NumberFormat('en-US').format(display);
  return <Text style={style}>{text}</Text>;
}
