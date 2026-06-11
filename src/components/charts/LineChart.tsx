import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { colors, spacing } from '../../theme';
import { AppText } from '../common/AppText';

export interface ChartPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: ChartPoint[];
  height?: number;
  width?: number;
  color?: string;
  /** Cantidad de etiquetas del eje X a mostrar */
  maxLabels?: number;
  formatValue?: (value: number) => string;
}

/** Gráfico de línea minimalista con área degradada, 100% SVG (sin dependencias extra). */
export function LineChart({
  data,
  height = 160,
  width = 320,
  color = colors.primary.default,
  maxLabels = 4,
  formatValue = (v) => String(Math.round(v * 10) / 10),
}: LineChartProps): React.JSX.Element {
  if (data.length === 0) {
    return <View style={[styles.empty, { height }]} />;
  }

  const padding = { top: 16, bottom: 8, left: 6, right: 6 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padding.top + chartH - ((d.value - min) / range) * chartH,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${height - padding.bottom} L ${points[0]!.x.toFixed(1)} ${height - padding.bottom} Z`;

  const last = points[points.length - 1]!;
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <View>
      <View style={styles.rangeRow}>
        <AppText variant="body12Medium" color={colors.text.tertiary}>
          {formatValue(max)}
        </AppText>
        <AppText variant="body12Medium" color={colors.text.disabled}>
          {formatValue(min)}
        </AppText>
      </View>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Path d={areaPath} fill="url(#areaFill)" />
        <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={color} stroke={colors.background} strokeWidth={2} />
      </Svg>
      <View style={styles.labels}>
        {data
          .filter((_, i) => i % labelStep === 0 || i === data.length - 1)
          .map((d, i) => (
            <AppText key={`${d.label}-${i}`} variant="body12" color={colors.text.tertiary}>
              {d.label}
            </AppText>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.surface.base },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
});
