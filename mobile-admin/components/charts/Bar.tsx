/**
 * Bar — simple vertical-bar group with one optional highlighted bar.
 *
 * Used by the "peak hours" report (24 bars, one per hour of day). The active
 * bar renders in a darker shade so the peak hour visually pops without
 * needing a separate legend.
 *
 * Auto-scales bar height to the data's max. Empty data renders an empty SVG
 * frame so layout doesn't collapse.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export interface BarProps {
  data: number[];
  height?: number;
  width?: number;
  /** Default bar color. */
  barColor?: string;
  /** Index of the bar to highlight (e.g., peak hour). Drawn in `activeColor`. */
  activeIndex?: number;
  activeColor?: string;
  /** Gap between bars as a fraction of bar slot (0..1). Default 0.25. */
  gapRatio?: number;
}

export function Bar({
  data,
  height = 100,
  width,
  barColor = '#5eead4',
  activeIndex,
  activeColor = '#0e9384',
  gapRatio = 0.25,
}: BarProps) {
  const VB_W = 100;
  const VB_H = 100;
  const PAD_BOTTOM = 2;

  if (!data || data.length === 0) {
    return (
      <View style={{ width: width ?? '100%', height }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" />
      </View>
    );
  }

  const max = Math.max(...data, 1); // floor at 1 so all-zero data still renders tiny visible stubs
  const slot = VB_W / data.length;
  const gap = slot * gapRatio;
  const barW = slot - gap;

  return (
    <View style={{ width: width ?? '100%', height }}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        {data.map((v, i) => {
          // Even a zero gets a 1.5-unit stub so the bar position is visible
          // (the eye expects 24 bars across; gaps would look like missing data).
          const h = v === 0 ? 1.5 : Math.max(1.5, (v / max) * (VB_H - PAD_BOTTOM));
          const x = i * slot + gap / 2;
          const y = VB_H - h - PAD_BOTTOM;
          const isActive = i === activeIndex;
          return (
            <Rect
              key={i}
              x={x.toFixed(2)}
              y={y.toFixed(2)}
              width={barW.toFixed(2)}
              height={h.toFixed(2)}
              rx={0.8}
              fill={isActive ? activeColor : barColor}
              opacity={v === 0 ? 0.35 : 1}
            />
          );
        })}
      </Svg>
    </View>
  );
}
