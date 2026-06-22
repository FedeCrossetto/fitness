import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Button, ErrorState, IconButton } from '../../components/common';
import { hapticSuccess, hapticWarning } from '../../lib/haptics';
import { fetchProductByBarcode } from '../../services/openFoodFacts';
import { setScanProductCache } from '../../services/scanProductCache';
import { useTranslation } from '../../stores/i18nStore';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'BarcodeScanner'>;

type LookupState = 'idle' | 'loading' | 'notfound' | 'error';

const FRAME_WIDTH = 260;
const FRAME_HEIGHT = 180;
const CORNER_SIZE = 28;

export function BarcodeScannerScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();
  const { mealType, purpose = 'add' } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [lookupState, setLookupState] = useState<LookupState>('idle');

  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
      setLookupState('idle');
    }, []),
  );

  const resetScan = useCallback(() => {
    scannedRef.current = false;
    setLookupState('idle');
  }, []);

  const openManualEntry = useCallback(() => {
    navigation.replace('FoodDetail', {
      mealType,
      scanPurpose: purpose,
      ...(purpose === 'create' ? { entryMode: 'create' as const } : {}),
    });
  }, [mealType, navigation, purpose]);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (scannedRef.current || !result.data || lookupState === 'loading') return;
      scannedRef.current = true;
      setLookupState('loading');

      void (async () => {
        try {
          const product = await fetchProductByBarcode(result.data);
          if (!product) {
            hapticWarning();
            setLookupState('notfound');
            scannedRef.current = false;
            return;
          }
          hapticSuccess();
          setScanProductCache(result.data, product);
          navigation.replace('FoodDetail', {
            mealType,
            barcode: result.data,
            scanPurpose: purpose,
            ...(purpose === 'create' ? { entryMode: 'create' as const } : {}),
          });
          setLookupState('idle');
          scannedRef.current = false;
        } catch {
          hapticWarning();
          setLookupState('error');
          scannedRef.current = false;
        }
      })();
    },
    [lookupState, mealType, navigation, purpose],
  );

  const scanningEnabled = lookupState === 'idle' || lookupState === 'notfound' || lookupState === 'error';

  return (
    <View style={styles.flex}>
      {permission === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.default} />
          <AppText variant="body14" color={colors.text.secondary} style={styles.permissionText}>
            {t.nutrition.scan_permission_request}
          </AppText>
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <ErrorState
            message={t.nutrition.scan_permission_denied}
            onRetry={() => void requestPermission()}
          />
          <Button label={t.ui.open_settings} variant="ghost" size="md" onPress={() => void Linking.openSettings()} />
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={scanningEnabled ? handleScan : undefined}
          />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.overlayFill} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.frame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <AppText variant="body16Medium" color={colors.text.primary} align="center" style={styles.hint}>
                {t.nutrition.scan_hint}
              </AppText>
              <AppText
                variant="body12"
                color={colors.text.tertiary}
                align="center"
                style={[styles.attribution, { marginBottom: insets.bottom + spacing.lg }]}
              >
                {t.nutrition.scan_attribution}
              </AppText>
            </View>
          </View>

          {lookupState === 'loading' ? (
            <View style={styles.lookupOverlay} pointerEvents="none">
              <View style={styles.lookupCard}>
                <ActivityIndicator color={colors.primary.default} />
                <AppText variant="body14" color={colors.text.primary} style={styles.lookupText}>
                  {t.nutrition.scan_lookup}
                </AppText>
              </View>
            </View>
          ) : null}

          {lookupState === 'notfound' || lookupState === 'error' ? (
            <View style={styles.lookupOverlay}>
              <View style={styles.lookupCard}>
                <AppText variant="body16SemiBold" color={colors.text.primary} align="center">
                  {lookupState === 'notfound' ? t.nutrition.scan_not_found_title : t.nutrition.scan_error_title}
                </AppText>
                <AppText variant="body13" color={colors.text.secondary} align="center" style={styles.lookupMessage}>
                  {lookupState === 'notfound' ? t.nutrition.scan_not_found_message : t.nutrition.scan_error_message}
                </AppText>
                <Button label={t.nutrition.scan_again} onPress={resetScan} fullWidth />
                <Button label={t.nutrition.manual_entry} variant="ghost" onPress={openManualEntry} fullWidth />
              </View>
            </View>
          ) : null}
        </>
      )}

      <IconButton
        icon="close"
        onPress={() => navigation.goBack()}
        accessibilityLabel={t.ui.cancel}
        style={[styles.closeButton, { top: insets.top + spacing.md }]}
      />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.screenPadding },
  permissionText: { marginTop: spacing.md },
  overlayFill: { flex: 1, backgroundColor: colors.surface.overlay },
  overlayMiddle: { flexDirection: 'row', height: FRAME_HEIGHT },
  overlaySide: { flex: 1, backgroundColor: colors.surface.overlay },
  frame: { width: FRAME_WIDTH, height: FRAME_HEIGHT },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.primary.default,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.sm },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.sm },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.sm },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.sm },
  overlayBottom: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  hint: { marginTop: spacing.xl },
  attribution: { marginTop: spacing.md },
  closeButton: { position: 'absolute', left: layout.screenPadding },
  lookupOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  lookupCard: {
    width: '100%',
    maxWidth: 340,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  lookupText: { marginTop: spacing.sm },
  lookupMessage: { marginBottom: spacing.xs },
});
