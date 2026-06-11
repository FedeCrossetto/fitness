import React, { useRef } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, layout, radius, spacing } from '../../theme';
import { AppText, Button, ErrorState, IconButton } from '../../components/common';
import { hapticSuccess } from '../../lib/haptics';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'BarcodeScanner'>;

const FRAME_WIDTH = 260;
const FRAME_HEIGHT = 180;
const CORNER_SIZE = 28;

export function BarcodeScannerScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { mealType } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const handleScan = (result: BarcodeScanningResult) => {
    if (scannedRef.current || !result.data) return;
    scannedRef.current = true;
    hapticSuccess();
    navigation.replace('FoodDetail', { mealType, barcode: result.data });
  };

  return (
    <View style={styles.flex}>
      {permission === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.default} />
          <AppText variant="body14" color={colors.text.secondary} style={styles.permissionText}>
            Solicitando acceso a la cámara…
          </AppText>
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <ErrorState
            message="Necesitamos acceso a la cámara para escanear el código de barras del producto."
            onRetry={() => void requestPermission()}
          />
          <Button label="Abrir ajustes" variant="ghost" size="md" onPress={() => void Linking.openSettings()} />
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleScan}
          />
          {/* Overlay oscuro con recuadro central */}
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
                Apuntá al código de barras del producto
              </AppText>
              <AppText
                variant="body12"
                color={colors.text.tertiary}
                align="center"
                style={[styles.attribution, { marginBottom: insets.bottom + spacing.lg }]}
              >
                Datos de producto: © Open Food Facts (ODbL)
              </AppText>
            </View>
          </View>
        </>
      )}

      <IconButton
        icon="close"
        onPress={() => navigation.goBack()}
        accessibilityLabel="Cerrar escáner"
        style={[styles.closeButton, { top: insets.top + spacing.md }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
