import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../common';
import { LineChart, type ChartPoint } from '../charts';
import { useTranslation } from '../../stores/i18nStore';

interface WeightTrendChartProps {
  data: ChartPoint[];
  width: number;
  height?: number;
  formatValue?: (value: number) => string;
  showDots?: boolean;
}

/** Gráfico de peso; con una sola medición muestra línea base + hint debajo. */
export function WeightTrendChart({
  data,
  width,
  height = 140,
  formatValue = (v) => `${v.toFixed(1)} kg`,
  showDots = false,
}: WeightTrendChartProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isSingle = data.length === 1;

  return (
    <View>
      <LineChart
        data={data}
        width={width}
        height={height}
        soft
        curved
        showDots={showDots}
        formatValue={formatValue}
      />
      {isSingle ? (
        <AppText variant="body12" color={colors.text.tertiary} align="center" style={styles.hint}>
          {t.progress.need_second_measurement}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: spacing.xxs, lineHeight: 16 },
});
