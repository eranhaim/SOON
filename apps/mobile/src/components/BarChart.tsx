import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme/tokens';

/**
 * Minimal black-and-white bar chart. Bars run oldest → newest, left → right (charts stay
 * LTR inside the RTL app). The latest bar is solid black; earlier bars are grey.
 */
export function BarChart({
  values,
  labels,
  width,
  height = 180,
}: {
  values: number[];
  labels: string[];
  width: number;
  height?: number;
}) {
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...values);
  const n = values.length || 1;
  const slot = width / n;
  const bar = Math.max(4, Math.min(28, slot * 0.6));
  const labelEvery = n > 16 ? 4 : n > 8 ? 2 : 1;
  return (
    <View style={{ width, height }} accessibilityRole="image" accessibilityLabel={`גרף: ${values.join(', ')}`}>
      <Svg width={width} height={height}>
        <Line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke={colors.ink} strokeWidth={1} />
        {[0.5, 1].map((f) => (
          <Line key={f} x1={0} x2={width} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} stroke={colors.line} strokeWidth={1} />
        ))}
        {values.map((v, i) => {
          const h = (v / max) * plotH;
          const x = i * slot + (slot - bar) / 2;
          const last = i === n - 1;
          return (
            <Rect key={i} x={x} y={top + plotH - h} width={bar} height={Math.max(h, v > 0 ? 1 : 0)} fill={last ? colors.ink : '#B9B9B6'} />
          );
        })}
        {values.map((v, i) =>
          v === max || i === n - 1 ? (
            <SvgText key={`v${i}`} x={i * slot + slot / 2} y={top + plotH - (v / max) * plotH - 5} fontSize={10} fill={colors.ink} textAnchor="middle" fontFamily={fonts.body}>
              {String(v)}
            </SvgText>
          ) : null,
        )}
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 6} fontSize={9} fill={colors.inkMuted} textAnchor="middle" fontFamily={fonts.body}>
              {l}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
