import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, layout, radius, spacing } from '../../theme';
import { formatLongDate, todayISO } from '../../lib/dates';
import { hapticSuccess } from '../../lib/haptics';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  IconButton,
  SegmentedTabs,
  Skeleton,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';
import { signedUrl, uploadPrivateImage } from '../../services/storage';
import type { PhotoPosition, ProgressPhotoRow } from '../../types/database';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'ProgressPhotos'>;

const POSITIONS: PhotoPosition[] = ['frente', 'perfil', 'espalda'];
const POSITION_LABELS = ['Frente', 'Perfil', 'Espalda'];
const GRID_GAP = spacing.sm;
const ITEM_WIDTH = (Dimensions.get('window').width - layout.screenPadding * 2 - GRID_GAP) / 2;

/** Semanas transcurridas desde la primera foto registrada (mínimo 1). */
function computeWeekNumber(photos: ProgressPhotoRow[]): number {
  if (photos.length === 0) return 1;
  const firstDate = photos.reduce((min, p) => (p.recorded_at < min ? p.recorded_at : min), photos[0]!.recorded_at);
  const diffMs = new Date(`${todayISO()}T12:00:00`).getTime() - new Date(`${firstDate}T12:00:00`).getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1);
}

export function ProgressPhotosScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const photos = useProgressStore((s) => s.photos);
  const photosLoading = useProgressStore((s) => s.photosLoading);
  const loadPhotos = useProgressStore((s) => s.loadPhotos);
  const addPhoto = useProgressStore((s) => s.addPhoto);

  const [activeIndex, setActiveIndex] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activePosition = POSITIONS[activeIndex]!;

  useEffect(() => {
    if (userId) void loadPhotos(userId);
  }, [userId, loadPhotos]);

  // Resuelve URLs firmadas para los paths internos del bucket privado
  useEffect(() => {
    const pending = photos.filter((p) => signedUrls[p.photo_url] === undefined);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (p) => [p.photo_url, await signedUrl('progress-photos', p.photo_url)] as const)
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
    () => photos.filter((p) => p.position === activePosition),
    [photos, activePosition]
  );

  const handlePicked = useCallback(
    async (uri: string) => {
      if (!userId) return;
      setUploading(true);
      try {
        const path = await uploadPrivateImage('progress-photos', userId, uri, `${activePosition}-${todayISO()}`);
        const weekNumber = computeWeekNumber(useProgressStore.getState().photos);
        const ok = await addPhoto(userId, activePosition, path, weekNumber);
        if (ok) {
          hapticSuccess();
          useUiStore.getState().showToast('success', 'Foto de progreso guardada');
        } else {
          useUiStore.getState().showToast('error', 'No pudimos guardar la foto.');
        }
      } catch {
        useUiStore.getState().showToast('error', 'No pudimos subir la foto. Probá de nuevo.');
      }
      setUploading(false);
    },
    [userId, activePosition, addPhoto]
  );

  const takePhoto = useCallback(async () => {
    setPickerVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      useUiStore.getState().showToast('error', 'Necesitamos permiso de cámara para tomar tu foto de progreso.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await handlePicked(result.assets[0].uri);
    }
  }, [handlePicked]);

  const pickFromLibrary = useCallback(async () => {
    setPickerVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await handlePicked(result.assets[0].uri);
    }
  }, [handlePicked]);

  const renderItem = useCallback(
    ({ item }: { item: ProgressPhotoRow }) => {
      const url = signedUrls[item.photo_url];
      return (
        <Card style={styles.photoCard}>
          {url ? (
            <Image source={{ uri: url }} style={styles.photo} contentFit="cover" transition={150} />
          ) : (
            <Skeleton width={ITEM_WIDTH - spacing.md * 2} height={ITEM_WIDTH} borderRadius={radius.md} />
          )}
          <AppText variant="body13SemiBold" color={colors.text.primary} style={styles.photoWeek}>
            Semana {item.week_number}
          </AppText>
          <AppText variant="body12" color={colors.text.tertiary}>
            {formatLongDate(item.recorded_at)}
          </AppText>
        </Card>
      );
    },
    [signedUrls]
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          Fotos de progreso
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        <SegmentedTabs tabs={POSITION_LABELS} activeIndex={activeIndex} onChange={setActiveIndex} />
      </View>

      {photosLoading && photos.length === 0 ? (
        <View style={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : positionPhotos.length === 0 ? (
        <View style={styles.content}>
          <EmptyState
            compact
            pillar="progress"
            title="Sin fotos todavía"
            message={`Tomá tu primera foto de ${activePosition} para comparar tu evolución`}
            actionLabel="Agregar foto"
            onAction={() => setPickerVisible(true)}
          />
        </View>
      ) : (
        <FlatList
          data={positionPhotos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Button
              label="Agregar foto"
              icon="camera-outline"
              loading={uploading}
              onPress={() => setPickerVisible(true)}
              fullWidth
              style={styles.cta}
            />
          }
        />
      )}

      <BottomSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} title="Agregar foto">
        <Button
          label="Tomar foto"
          icon="camera-outline"
          onPress={() => void takePhoto()}
          fullWidth
          style={styles.sheetButton}
        />
        <Button
          label="Elegir de la galería"
          variant="secondary"
          icon="images-outline"
          onPress={() => void pickFromLibrary()}
          fullWidth
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
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
  content: { paddingHorizontal: layout.screenPadding },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  column: { gap: GRID_GAP },
  photoCard: { width: ITEM_WIDTH, marginBottom: spacing.sm },
  photo: {
    width: ITEM_WIDTH - spacing.md * 2,
    height: ITEM_WIDTH,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
  },
  photoWeek: { marginTop: spacing.xs },
  cta: { marginTop: spacing.md },
  sheetButton: { marginBottom: spacing.sm },
});
