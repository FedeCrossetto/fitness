import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, AppText, Input } from '../common';
import { ExerciseIcon } from './ExerciseIcon';
import { ExercisePreviewSheet } from './ExercisePreviewSheet';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import type { ExerciseRow } from '../../types/database';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'body_part' | 'target_muscles' | 'external_source'>;

interface ExerciseSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: CatalogExercise) => void;
}

export function ExerciseSearchSheet({ visible, onClose, onPick }: ExerciseSearchSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const searchExercises = useTrainingStore((s) => s.searchExercises);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<CatalogExercise | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const data = await searchExercises(query);
        if (!active) return;
        setResults(data);
        setLoading(false);
      })();
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [visible, query, searchExercises]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.training.add_exercise}>
      <Input
        placeholder={t.training.search_exercise_placeholder}
        value={query}
        onChangeText={setQuery}
        icon="search-outline"
        autoFocus
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : results.length === 0 ? (
        <AppText variant="body14" color={colors.text.tertiary} style={styles.empty}>
          {t.training.search_exercise_empty}
        </AppText>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => onPick(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <ExerciseIcon
                size={48}
                imageUrl={item.image_url}
                externalSource={item.external_source}
                bodyPart={item.body_part}
                targetMuscle={item.target_muscles?.[0]}
                onPress={() => setPreviewExercise(item)}
              />
              <View style={styles.info}>
                <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={2}>
                  {item.name}
                </AppText>
                {item.target_muscles && item.target_muscles.length > 0 ? (
                  <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                    {item.target_muscles.join(', ')}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary.default} />
            </Pressable>
          )}
        />
      )}
      <ExercisePreviewSheet
        visible={previewExercise !== null}
        onClose={() => setPreviewExercise(null)}
        exerciseId={previewExercise?.id ?? null}
        fallback={
          previewExercise
            ? { name: previewExercise.name, image_url: previewExercise.image_url }
            : undefined
        }
      />
    </BottomSheet>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    center: { paddingVertical: spacing.xl, alignItems: 'center' },
    empty: { paddingVertical: spacing.lg, textAlign: 'center' },
    list: { maxHeight: 360, marginTop: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: layout.screenPadding - spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    pressed: { opacity: 0.85 },
    info: { flex: 1 },
  });
