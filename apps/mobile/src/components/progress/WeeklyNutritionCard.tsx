import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Card, CardSkeleton } from '../common';
import { supabase } from '../../lib/supabase';

interface DayMacros {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  userId: string;
}

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function WeeklyNutritionCard({ userId }: Props): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [data, setData] = useState<DayMacros[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const dates = last7Days();
    const { data: rows, error } = await supabase
      .from('meal_logs')
      .select('date, energy_kcal, protein_g, carbs_g, fat_g, is_included')
      .eq('user_id', userId)
      .in('date', dates);

    if (error || !rows) { setLoading(false); return; }

    const byDate = new Map<string, DayMacros>();
    for (const iso of dates) {
      byDate.set(iso, { date: iso, kcal: 0, protein: 0, carbs: 0, fat: 0 });
    }
    for (const row of rows) {
      if (!row.is_included) continue;
      const entry = byDate.get(row.date);
      if (!entry) continue;
      entry.kcal += Math.round(row.energy_kcal ?? 0);
      entry.protein += row.protein_g ?? 0;
      entry.carbs += row.carbs_g ?? 0;
      entry.fat += row.fat_g ?? 0;
    }
    setData(Array.from(byDate.values()));
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  if (loading) return <CardSkeleton />;
  if (!data) return null;

  const daysWithData = data.filter((d) => d.kcal > 0);
  if (daysWithData.length === 0) return null;

  const avgKcal = Math.round(daysWithData.reduce((s, d) => s + d.kcal, 0) / daysWithData.length);
  const avgProtein = Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length);
  const avgCarbs = Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / daysWithData.length);
  const avgFat = Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / daysWithData.length);

  const maxKcal = Math.max(...data.map((d) => d.kcal), 1);

  return (
    <Card elevated style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="nutrition-outline" size={16} color={colors.pillars.nutrition} />
        <AppText variant="caps12" color={colors.text.secondary} style={styles.title}>
          Nutrición — últimos 7 días
        </AppText>
      </View>

      {/* Mini bar chart por día */}
      <View style={styles.bars}>
        {data.map((day) => {
          const ratio = day.kcal / maxKcal;
          const dayOfWeek = new Date(day.date + 'T12:00:00').getDay();
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          return (
            <View key={day.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(ratio * 100, day.kcal > 0 ? 4 : 0)}%`,
                      backgroundColor: isToday ? colors.pillars.nutrition : colors.pillars.nutrition + '88',
                    },
                  ]}
                />
              </View>
              <AppText
                variant="caps11"
                color={isToday ? colors.text.primary : colors.text.tertiary}
              >
                {DAY_LABELS[dayOfWeek]}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Promedios */}
      <View style={styles.avgRow}>
        <MacroAvg label="kcal" value={`${avgKcal}`} color={colors.text.primary} />
        <MacroAvg label="prot" value={`${avgProtein}g`} color="#3b82f6" />
        <MacroAvg label="carbs" value={`${avgCarbs}g`} color="#f59e0b" />
        <MacroAvg label="grasa" value={`${avgFat}g`} color="#ef4444" />
      </View>
      <AppText variant="caps11" color={colors.text.tertiary} style={styles.subtitle}>
        Promedio de {daysWithData.length} {daysWithData.length === 1 ? 'día' : 'días'} registrados
      </AppText>
    </Card>
  );
}

function MacroAvg({ label, value, color }: { label: string; value: string; color: string }): React.JSX.Element {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <AppText variant="body13SemiBold" color={color}>{value}</AppText>
      <AppText variant="caps11" color="#888">{label}</AppText>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  title: { flex: 1 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 56,
    marginBottom: spacing.sm,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.border.subtle,
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 3 },
  avgRow: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    marginBottom: spacing.xs,
  },
  subtitle: { textAlign: 'center', marginTop: 2 },
});
