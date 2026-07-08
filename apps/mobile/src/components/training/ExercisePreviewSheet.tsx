import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { canShowExerciseImage } from '@reset-fitness/shared';
import { AppText, BottomSheet, Chip } from '../common';
import { radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../stores/i18nStore';
import type { ExerciseRow } from '../../types/database';

type ExerciseDetail = Pick<
  ExerciseRow,
  'id' | 'name' | 'image_url' | 'external_source' | 'target_muscles' | 'secondary_muscles' | 'equipment' | 'instructions' | 'body_part'
>;

interface ExercisePreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string | null;
  subtitle?: string;
  fallback?: Pick<ExerciseDetail, 'name' | 'image_url'>;
}

export function ExercisePreviewSheet({
  visible,
  onClose,
  exerciseId,
  subtitle,
  fallback,
}: ExercisePreviewSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);

  useEffect(() => {
    if (!visible || !exerciseId) {
      setExercise(null);
      return;
    }

    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, image_url, external_source, target_muscles, secondary_muscles, equipment, instructions, body_part')
        .eq('id', exerciseId)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setExercise(
          fallback
            ? {
                id: exerciseId,
                name: fallback.name,
                image_url: fallback.image_url ?? null,
                external_source: null,
                target_muscles: null,
                secondary_muscles: null,
                equipment: null,
                instructions: null,
                body_part: null,
              }
            : null,
        );
      } else {
        setExercise(data as ExerciseDetail);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  // Deps a propósito en los campos primitivos de `fallback`, no el objeto —
  // si el padre pasa un literal inline, un objeto nuevo en cada render
  // dispararía este fetch en loop aunque el contenido no haya cambiado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exerciseId, fallback?.name, fallback?.image_url]);

  const title = exercise?.name ?? fallback?.name ?? '';
  const imageUrl = exercise?.image_url ?? fallback?.image_url ?? null;
  const showImage = canShowExerciseImage(imageUrl, exercise?.external_source);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text.secondary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {showImage ? (
            <View style={styles.mediaWrap}>
              <Image source={{ uri: imageUrl! }} style={styles.media} contentFit="contain" autoplay />
            </View>
          ) : null}

          {(exercise?.target_muscles?.length || exercise?.equipment?.length) ? (
            <View style={styles.section}>
              {exercise?.target_muscles && exercise.target_muscles.length > 0 ? (
                <>
                  <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
                    {t.training.target_muscles}
                  </AppText>
                  <View style={styles.chips}>
                    {exercise.target_muscles.map((item) => (
                      <Chip key={item} label={item} />
                    ))}
                  </View>
                </>
              ) : null}
              {exercise?.equipment && exercise.equipment.length > 0 ? (
                <>
                  <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
                    {t.training.equipment}
                  </AppText>
                  <View style={styles.chips}>
                    {exercise.equipment.map((item) => (
                      <Chip key={item} label={item} />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {exercise?.instructions && exercise.instructions.length > 0 ? (
            <View style={styles.section}>
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
                {t.training.instructions}
              </AppText>
              {exercise.instructions.map((step, index) => (
                <View key={`${index}-${step.slice(0, 16)}`} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <AppText variant="body12SemiBold" color={colors.text.secondary}>
                      {index + 1}
                    </AppText>
                  </View>
                  <AppText variant="body14" color={colors.text.secondary} style={styles.stepText}>
                    {step.replace(/^Step:\d+\s*/i, '')}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    center: { paddingVertical: spacing.xl, alignItems: 'center' },
    scroll: { maxHeight: 520 },
    mediaWrap: {
      width: '100%',
      height: 280,
      borderRadius: radius.lg,
      backgroundColor: colors.surface.elevated,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    media: {
      width: '100%',
      height: '100%',
    },
    section: {
      marginBottom: spacing.md,
    },
    label: {
      marginBottom: spacing.xs,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    stepNumber: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepText: { flex: 1 },
  });
