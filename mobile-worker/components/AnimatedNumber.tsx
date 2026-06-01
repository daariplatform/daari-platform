/**
 * Animated number counter — tweens from the previous value to the new target
 * whenever `value` changes. Built purely on react-native-reanimated (no extra
 * deps): a shared-value driver + a JS-thread reaction that re-renders the
 * formatted string each frame. Used for money / count stat cards across the
 * cash, earnings, and shift screens.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedNumberProps extends TextProps {
  value: number;
  /** Maps the raw animated number to the display string (e.g. `iqd`). */
  format?: (n: number) => string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  format,
  duration = 900,
  ...textProps
}: AnimatedNumberProps) {
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('en-US'));
  // Keep the latest formatter in a ref so the per-frame reaction always uses
  // it without needing to live in any dependency array.
  const fmtRef = useRef(fmt);
  fmtRef.current = fmt;

  const driver = useSharedValue(value);
  const [display, setDisplay] = useState(() => fmt(value));

  // Format on the JS thread. The reaction worklet must only marshal the raw
  // number across with runOnJS — calling the (non-worklet) formatter directly
  // inside the worklet would synchronously invoke JS on the UI runtime and
  // abort the app, so we hand the number to this JS-thread callback instead.
  const applyValue = useCallback((n: number) => {
    setDisplay(fmtRef.current(n));
  }, []);

  useEffect(() => {
    driver.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, driver]);

  useAnimatedReaction(
    () => driver.value,
    (current) => {
      runOnJS(applyValue)(current);
    },
    [],
  );

  return <Text {...textProps}>{display}</Text>;
}
