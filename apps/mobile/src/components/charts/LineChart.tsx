import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Colors, spacing, useTheme, useThemedStyles } from '../../theme';
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
  maxLabels?: number;
  showDots?: boolean;
  showGrid?: boolean;
  /** Curva suave en lugar de segmentos rectos */
  curved?: boolean;
  /** Oculta etiquetas min/max arriba del gráfico */
  showRange?: boolean;
  /** Menos grilla, curva y degradado más suaves */
  soft?: boolean;
  formatValue?: (value: number) => string;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function buildLinePath(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/** Gráfico de línea minimalista con área degradada, 100% SVG (sin dependencias extra). */
export function LineChart({
  data,
  height = 160,
  width = 320,
  color,
  maxLabels = 4,
  showDots = false,
  showGrid = true,
  curved = false,
  showRange = true,
  soft = false,
  formatValue = (v) => String(Math.round(v * 10) / 10),
}: LineChartProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const stroke = color ?? colors.primary.default;
  const useSoft = soft || curved;
  const gridVisible = soft ? false : showGrid;
  const rangeVisible = soft ? false : showRange;
  const lineWidth = soft ? 2 : 2.5;
  const areaOpacityTop = soft ? 0.14 : 0.25;
  const areaOpacityBottom = 0;

  if (data.length === 0) {
    return <View style={[styles.empty, { height }]} />;
  }

  const padding = { top: soft ? 12 : 16, bottom: soft ? 4 : 8, left: 4, right: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin || 1;
  const padRatio = soft ? 0.18 : 0;
  const min = rawMin - rawRange * padRatio;
  const max = rawMax + rawRange * padRatio;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padding.top + chartH - ((d.value - min) / range) * chartH,
  }));

  const linePath = useSoft ? buildSmoothPath(points) : buildLinePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${height - padding.bottom} L ${points[0]!.x.toFixed(1)} ${height - padding.bottom} Z`;

  const last = points[points.length - 1]!;
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));
  const gridLines = [0.33, 0.66].map((t) => padding.top + chartH * t);

  return (
    <View>
      {rangeVisible ? (
        <View style={styles.rangeRow}>
          <AppText variant="body12Medium" color={colors.text.tertiary}>
            {formatValue(rawMax)}
          </AppText>
          <AppText variant="body12Medium" color={colors.text.disabled}>
            {formatValue(rawMin)}
          </AppText>
        </View>
      ) : null}
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={areaOpacityTop} />
            <Stop offset="1" stopColor={stroke} stopOpacity={areaOpacityBottom} />
          </SvgGradient>
        </Defs>
        {gridVisible
          ? gridLines.map((y) => (
              <Line
                key={y}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={colors.border.subtle}
                strokeWidth={1}
                strokeDasharray="4 6"
                opacity={0.6}
              />
            ))
          : null}
        <Path d={areaPath} fill="url(#areaFill)" />
        <Path
          d={linePath}
          stroke={stroke}
          strokeWidth={lineWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showDots && !soft
          ? points.slice(0, -1).map((p, i) => (
              <Circle
                key={`dot-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={colors.surface.base}
                stroke={stroke}
                strokeWidth={1.5}
                opacity={0.7}
              />
            ))
          : null}
        {soft ? (
          <>
            <Circle cx={last.x} cy={last.y} r={8} fill={stroke} opacity={0.12} />
            <Circle cx={last.x} cy={last.y} r={4} fill={stroke} opacity={0.9} />
          </>
        ) : (
          <Circle cx={last.x} cy={last.y} r={5} fill={stroke} stroke={colors.background} strokeWidth={2} />
        )}
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      paddingHorizontal: spacing.xxs,
    },
  });
