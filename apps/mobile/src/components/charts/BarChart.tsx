import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors, spacing, useTheme, useThemedStyles } from '../../theme';
import { AppText } from '../common/AppText';
import type { ChartPoint } from './LineChart';

interface BarChartProps {
  data: ChartPoint[];
  height?: number;
  width?: number;
  color?: string;
  /** Índice de la barra destacada (ej: día actual). Por defecto la última. */
  highlightIndex?: number;
  formatValue?: (value: number) => string;
}

/**
 * Gráfico de barras estilo plantilla: barras redondeadas atenuadas con la barra
 * activa en color primario y su valor encima. 100% SVG.
 */
export function BarChart({
  data,
  height = 140,
  width = 320,
  color,
  highlightIndex,
  formatValue = (v) => String(Math.round(v)),
}: BarChartProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const accent = color ?? colors.primary.default;

  if (data.length === 0) {
    return <View style={[styles.empty, { height }]} />;
  }

  const active = highlightIndex ?? data.length - 1;
  const padding = { top: 24, bottom: 4 };
  const chartH = height - padding.top - padding.bottom;
  const gap = spacing.xs;
  const barW = Math.max(6, (width - gap * (data.length - 1)) / data.length);
  const max = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <View>
      <View style={styles.valueRow}>
        <AppText variant="body12SemiBold" color={accent}>
          {formatValue(data[active]!.value)}
        </AppText>
      </View>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.value / max) * chartH);
          const x = i * (barW + gap);
          const y = padding.top + chartH - barH;
          return (
            <Rect
              key={`${d.label}-${i}`}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={Math.min(barW / 2, 6)}
              fill={i === active ? accent : colors.primary.muted}
            />
          );
        })}
      </Svg>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <AppText
            key={`${d.label}-${i}`}
            variant="body12"
            color={i === active ? colors.text.primary : colors.text.tertiary}
            style={{ width: barW + (i < data.length - 1 ? gap : 0) }}
            align="left"
          >
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
    valueRow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      zIndex: 1,
    },
    labels: {
      flexDirection: 'row',
      marginTop: spacing.xxs,
    },
  });
