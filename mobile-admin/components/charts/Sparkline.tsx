/**
 * Sparkline — minimal line chart for trend visualisation.
 *
 * Renders an SVG polyline through the data points, auto-scaling Y to the
 * data's own min/max so the line always fills the available height. Caller
 * is responsible for any axis labels (we deliberately don't draw text in
 * the chart so the caller can position labels in RTL/Arabic flow without
 * fighting SVG text directionality).
 *
 * Empty / single-point data renders an empty SVG so the layout doesn't
 * collapse and the caller doesn't have to guard with `data.length > 1`.
 *
 * `fillColor` enables a soft gradient fill below the line (typically a
 * lower-opacity tint of `color`). Pass `undefined` for line-only.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';

export interface SparklineProps {
  data: number[];
  height?: number;
  /** Width in pixels. If omitted, the chart stretches to fill parent (uses 100%). */
  width?: number;
  color?: string;
  /** If set, fills the area under the line with a vertical gradient of this color. */
  fillColor?: string;
  /** Optional index to highlight with a larger dot — useful for "tap a day" UX. */
  activeIndex?: number;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  height = 80,
  width,
  color = '#0e9384',
  fillColor,
  activeIndex,
  strokeWidth = 2.5,
}: SparklineProps) {
  // We render in a normalized 100x100 viewBox so the SVG scales with whatever
  // physical width the parent gives us. preserveAspectRatio="none" lets the
  // line stretch horizontally while the stroke width stays visually constant.
  const VB_W = 100;
  const VB_H = 100;
  const PAD_Y = 6; // breathing room so peak dots don't get clipped at the top edge

  if (!data || data.length === 0) {
    return (
      <View style={{ width: width ?? '100%', height }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" />
      </View>
    );
  }

  // Single-point: draw a flat midline so the user sees *something* instead of
  // an empty box (common right after first sale of the week).
  const safeData = data.length === 1 ? [data[0], data[0]] : data;

  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1; // avoid /0 when all values equal (e.g. all zeros)

  const stepX = VB_W / (safeData.length - 1);

  const points = safeData.map((v, i) => {
    const x = i * stepX;
    // Invert Y because SVG origin is top-left but we want higher values up.
    const y = PAD_Y + (1 - (v - min) / range) * (VB_H - PAD_Y * 2);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const fillPath = fillColor
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${VB_H} L 0 ${VB_H} Z`
    : null;

  const gradientId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <View style={{ width: width ?? '100%', height }}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        {fillColor && fillPath && (
          <>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fillColor} stopOpacity={0.45} />
                <Stop offset="1" stopColor={fillColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
          </>
        )}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          // vectorEffect keeps strokeWidth visually constant despite the
          // non-uniform viewBox scaling we use to stretch horizontally.
          vectorEffect="non-scaling-stroke"
        />
        {typeof activeIndex === 'number' &&
          activeIndex >= 0 &&
          activeIndex < points.length && (
            <Circle
              cx={points[activeIndex].x}
              cy={points[activeIndex].y}
              r={3}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
      </Svg>
    </View>
  );
}
