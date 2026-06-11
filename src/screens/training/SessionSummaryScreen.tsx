import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, illustrations, layout, spacing } from '../../theme';
import { formatShortDate } from '../../lib/dates';
import { hapticSuccess } from '../../lib/haptics';
import { AppText, Button, Card, CardSkeleton, ErrorState, MetricCard } from '../../components/common';
import { useTrainingStore } from '../../stores/trainingStore';
import type { WorkoutLogRow } from '../../types/database';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'SessionSummary'>;

export function SessionSummaryScreen({ navigation, route }: Props): React.JSX.Element {
  const { logId } = route.params;
  const insets = useSafeAreaInsets();
  const loadLogById = useTrainingStore((s) => s.loadLogById);

  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Loader reutilizable por el botón de reintento (onPress no está sujeto a
  // la regla set-state-in-effect).
  const load = useCallback(async () => {
    const result = await loadLogById(logId);
    setLog(result);
    setLoading(false);
  }, [logId, loadLogById]);

  // Carga inicial inline: el setState ocurre después del await, no de forma
  // síncrona dentro del efecto.
  useEffect(() => {
    hapticSuccess();
    let cancelled = false;
    void (async () => {
      const result = await loadLogById(logId);
      if (cancelled) return;
      setLog(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, loadLogById]);

  const renderContent = () => {
    if (loading) {
      return (
        <View>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }
    if (!log) {
      return (
        <ErrorState
          message="No encontramos el registro de tu entrenamiento."
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      );
    }

    return (
      <View>
        <View style={styles.celebration}>
          <Image source={illustrations.victory} style={styles.mascot} contentFit="contain" />
          <AppText variant="h1" color={colors.text.primary} align="center">
            ¡Entrenamiento completado!
          </AppText>
          <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.subtitle}>
            {log.workout_name} · Sumaste un paso más hacia tu objetivo.
          </AppText>
        </View>

        <View style={styles.grid}>
          <MetricCard
            label="Duración"
            value={String(log.duration_min ?? 0)}
            unit="min"
            icon="time-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label="Ejercicios"
            value={String(log.completed_exercises?.length ?? 0)}
            unit="completados"
            icon="barbell-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label="RPE"
            value={log.rpe != null ? String(log.rpe) : '—'}
            unit="/ 10"
            icon="speedometer-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label="Fecha"
            value={formatShortDate(log.date)}
            icon="calendar-outline"
            style={styles.gridItem}
          />
        </View>

        {log.comments ? (
          <Card style={styles.commentsCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.commentsLabel}>
              Comentarios
            </AppText>
            <AppText variant="body14" color={colors.text.secondary}>
              {log.comments}
            </AppText>
          </Card>
        ) : null}

        <Button
          label="Volver al programa"
          icon="arrow-back"
          onPress={() => navigation.popToTop()}
          fullWidth
          style={styles.cta}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: layout.tabBarHeight + spacing.xxl,
        paddingHorizontal: layout.screenPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      {renderContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  celebration: { alignItems: 'center', marginBottom: spacing.xl },
  mascot: { width: 160, height: 190, marginBottom: spacing.md },
  subtitle: { marginTop: spacing.xs, maxWidth: 280 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  commentsCard: { marginTop: spacing.md },
  commentsLabel: { marginBottom: spacing.xs },
  cta: { marginTop: spacing.xl },
});
