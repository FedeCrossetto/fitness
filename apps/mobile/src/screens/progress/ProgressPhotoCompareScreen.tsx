import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { i } from '@reset-fitness/shared';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate, formatShortDate } from '../../lib/dates';
import {
  AppText,
  BottomSheet,
  EmptyState,
  IconButton,
  SegmentedTabs,
  Skeleton,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../stores/i18nStore';
import { signedUrl } from '../../services/storage';
import type { PhotoPosition, ProgressPhotoRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'ProgressPhotoCompare'>;

const POSITIONS: PhotoPosition[] = ['frente', 'perfil', 'espalda'];
const POSITION_LABELS = ['Frente', 'Perfil', 'Espalda'];

const PANE_WIDTH = (Dimensions.get('window').width - layout.screenPadding * 2 - 1) / 2;

function sortPhotosAsc(rows: ProgressPhotoRow[]): ProgressPhotoRow[] {
  return [...rows].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : a.recorded_at > b.recorded_at ? 1 : 0));
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime());
  return Math.max(0, Math.round(ms / (24 * 3600 * 1000)));
}

interface ComparePaneProps {
  label: string;
  photo: ProgressPhotoRow | null;
  url?: string;
  onPress: () => void;
  side: 'left' | 'right';
}

function ComparePane({ label, photo, url, onPress, side }: ComparePaneProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createPaneStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.pane, side === 'left' ? styles.paneLeft : styles.paneRight]}
    >
      <View style={styles.paneHeader}>
        <AppText variant="caps11" color={colors.primary.default}>
          {label}
        </AppText>
        {photo ? (
          <>
            <AppText variant="body13SemiBold" color={colors.text.primary} numberOfLines={1}>
              Sem. {photo.week_number}
            </AppText>
            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
              {formatShortDate(photo.recorded_at)}
            </AppText>
          </>
        ) : null}
        <Ionicons name="chevron-down" size={14} color={colors.text.tertiary} style={styles.paneChevron} />
      </View>
      <View style={styles.imageWrap}>
        {url ? (
          <Image source={{ uri: url }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <Skeleton width={PANE_WIDTH - spacing.sm * 2} height={340} borderRadius={radius.md} />
        )}
      </View>
    </Pressable>
  );
}

export function ProgressPhotoCompareScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const initialPosition = route.params?.position ?? 'frente';
  const initialIndex = Math.max(0, POSITIONS.indexOf(initialPosition));

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const photos = useProgressStore((s) => s.photos);
  const loadPhotos = useProgressStore((s) => s.loadPhotos);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [pickerSide, setPickerSide] = useState<'left' | 'right' | null>(null);

  const activePosition = POSITIONS[activeIndex]!;

  useEffect(() => {
    if (userId) void loadPhotos(userId);
  }, [userId, loadPhotos]);

  useEffect(() => {
    const pending = photos.filter((p) => signedUrls[p.photo_url] === undefined);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (p) => [p.photo_url, await signedUrl('progress-photos', p.photo_url)] as const),
      );
      if (cancelled) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) {
          if (url) next[path] = url;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, signedUrls]);

  const positionPhotos = useMemo(
    () => sortPhotosAsc(photos.filter((p) => p.position === activePosition)),
    [photos, activePosition],
  );

  useEffect(() => {
    if (positionPhotos.length === 0) {
      setLeftId(null);
      setRightId(null);
      return;
    }
    if (positionPhotos.length === 1) {
      setLeftId(positionPhotos[0]!.id);
      setRightId(positionPhotos[0]!.id);
      return;
    }
    setLeftId(positionPhotos[0]!.id);
    setRightId(positionPhotos[positionPhotos.length - 1]!.id);
  }, [activePosition, positionPhotos]);

  const leftPhoto = positionPhotos.find((p) => p.id === leftId) ?? null;
  const rightPhoto = positionPhotos.find((p) => p.id === rightId) ?? null;

  const spanLabel = useMemo(() => {
    if (!leftPhoto || !rightPhoto || leftPhoto.id === rightPhoto.id) return null;
    const days = daysBetween(leftPhoto.recorded_at, rightPhoto.recorded_at);
    if (days === 0) return t.progress.photos_compare_same_day;
    if (days < 14) return i(t.progress.photos_compare_days_apart, { n: days });
    const weeks = Math.max(1, Math.round(days / 7));
    return i(t.progress.photos_compare_weeks_apart, { n: weeks });
  }, [leftPhoto, rightPhoto, t]);

  const onPickPhoto = useCallback(
    (photo: ProgressPhotoRow) => {
      if (pickerSide === 'left') setLeftId(photo.id);
      if (pickerSide === 'right') setRightId(photo.id);
      setPickerSide(null);
    },
    [pickerSide],
  );

  const canCompare = positionPhotos.length >= 2;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          {t.progress.photos_compare_title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        <SegmentedTabs tabs={POSITION_LABELS} activeIndex={activeIndex} onChange={setActiveIndex} />
      </View>

      {!canCompare ? (
        <View style={styles.content}>
          <EmptyState
            compact
            pillar="progress"
            title={t.progress.photos_compare_title}
            message={i(t.progress.photos_compare_need_two, { position: POSITION_LABELS[activeIndex]! })}
            actionLabel={t.progress.photos}
            onAction={() => navigation.goBack()}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.compareRow}>
            <ComparePane
              side="left"
              label={t.progress.photos_before}
              photo={leftPhoto}
              url={leftPhoto ? signedUrls[leftPhoto.photo_url] : undefined}
              onPress={() => setPickerSide('left')}
            />
            <View style={styles.divider} />
            <ComparePane
              side="right"
              label={t.progress.photos_after}
              photo={rightPhoto}
              url={rightPhoto ? signedUrls[rightPhoto.photo_url] : undefined}
              onPress={() => setPickerSide('right')}
            />
          </View>

          {spanLabel ? (
            <View style={styles.spanBadge}>
              <Ionicons name="time-outline" size={14} color={colors.primary.default} />
              <AppText variant="body13Medium" color={colors.text.secondary}>
                {spanLabel}
              </AppText>
            </View>
          ) : null}

          {leftPhoto && rightPhoto && leftPhoto.id !== rightPhoto.id ? (
            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {formatLongDate(leftPhoto.recorded_at)}
                </AppText>
              </View>
              <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
              <View style={[styles.metaCell, styles.metaCellRight]}>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {formatLongDate(rightPhoto.recorded_at)}
                </AppText>
              </View>
            </View>
          ) : null}

          <AppText variant="body12" color={colors.text.tertiary} align="center" style={styles.hint}>
            {t.progress.photos_compare_hint}
          </AppText>
        </ScrollView>
      )}

      <BottomSheet
        visible={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        title={t.progress.photos_compare_pick}
      >
        {positionPhotos.map((photo) => {
          const selected =
            (pickerSide === 'left' && photo.id === leftId) || (pickerSide === 'right' && photo.id === rightId);
          const url = signedUrls[photo.photo_url];
          return (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              onPress={() => onPickPhoto(photo)}
              style={[styles.pickRow, selected && { backgroundColor: colors.primary.muted }]}
            >
              {url ? (
                <Image source={{ uri: url }} style={styles.pickThumb} contentFit="cover" />
              ) : (
                <Skeleton width={48} height={48} borderRadius={radius.sm} />
              )}
              <View style={styles.pickInfo}>
                <AppText variant="body14SemiBold" color={colors.text.primary}>
                  Semana {photo.week_number}
                </AppText>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {formatLongDate(photo.recorded_at)}
                </AppText>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary.default} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const createPaneStyles = (colors: Colors) =>
  StyleSheet.create({
    pane: { flex: 1 },
    paneLeft: {},
    paneRight: {},
    paneHeader: {
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.sm,
      gap: 2,
    },
    paneChevron: { marginTop: 2 },
    imageWrap: {
      height: 340,
      marginHorizontal: spacing.xs,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    image: { width: '100%', height: '100%' },
  });

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPadding,
      marginBottom: spacing.md,
    },
    headerSpacer: { width: layout.minHitTarget },
    tabs: { paddingHorizontal: layout.screenPadding, marginBottom: spacing.md },
    content: { paddingHorizontal: layout.screenPadding, flex: 1 },
    scroll: { paddingHorizontal: layout.screenPadding },
    compareRow: {
      flexDirection: 'row',
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.xl,
    },
    spanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      alignSelf: 'center',
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primary.muted,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    metaCell: { flex: 1 },
    metaCellRight: { alignItems: 'flex-end' },
    hint: { marginTop: spacing.lg, lineHeight: 18 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      marginBottom: spacing.xxs,
    },
    pickThumb: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.surface.elevated,
    },
    pickInfo: { flex: 1 },
  });
