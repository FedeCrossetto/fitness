import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Colors, radius, spacing, useTheme, useThemedStyles } from '../theme';
import { hapticTap } from '../lib/haptics';
import { AppText, IconButton } from '../components/common';
import { useUiStore } from '../stores/uiStore';
import type { MainTabsParamList } from '../types/navigation';

interface AddAction {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  navigate: (navigation: NavigationProp<MainTabsParamList>) => void;
}

const ACTIONS: AddAction[] = [
  {
    key: 'meal',
    label: 'Registrar comida',
    description: 'Catálogo, escáner o voz',
    icon: 'restaurant-outline',
    navigate: (n) => n.navigate('NutritionTab', { screen: 'MealsDay' }),
  },
  {
    key: 'water',
    label: 'Agregar agua',
    description: 'Sumá vasos o ml a tu día',
    icon: 'water-outline',
    navigate: (n) => n.navigate('HomeTab', { screen: 'Hydration' }),
  },
  {
    key: 'weight',
    label: 'Peso y medidas',
    description: 'Registrá tu peso de hoy',
    icon: 'scale-outline',
    navigate: (n) => n.navigate('ProgressTab', { screen: 'Measurements' }),
  },
  {
    key: 'photo',
    label: 'Foto de progreso',
    description: 'Frente, perfil o espalda',
    icon: 'camera-outline',
    navigate: (n) => n.navigate('ProgressTab', { screen: 'ProgressPhotos' }),
  },
  {
    key: 'workout',
    label: 'Entrenamiento',
    description: 'Sesión de fuerza o cardio',
    icon: 'barbell-outline',
    navigate: (n) => n.navigate('TrainingTab', { screen: 'Program' }),
  },
];

/** Menú modal del FAB central: registrar comida, agua, peso, foto o entrenamiento. */
export function AddMenuOverlay(): React.JSX.Element {
  const visible = useUiStore((s) => s.addMenuVisible);
  const close = useUiStore((s) => s.closeAddMenu);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleAction = (action: AddAction) => {
    hapticTap();
    close();
    action.navigate(navigation);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar menú">
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>

        <View style={[styles.menu, { paddingBottom: insets.bottom + spacing.xxl }]} pointerEvents="box-none">
          <AppText variant="caps13" color={colors.text.tertiary} align="center" style={styles.menuTitle}>
            ¿Qué querés registrar?
          </AppText>
          {ACTIONS.map((action, index) => (
            <Animated.View key={action.key} entering={FadeInDown.delay(index * 45).duration(250)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => handleAction(action)}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name={action.icon} size={22} color={colors.primary.dark} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="body16SemiBold" color={colors.text.primary}>
                    {action.label}
                  </AppText>
                  <AppText variant="body13" color={colors.text.tertiary}>
                    {action.description}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
              </Pressable>
            </Animated.View>
          ))}
          <View style={styles.closeWrap}>
            <IconButton
              icon="close"
              onPress={close}
              accessibilityLabel="Cerrar"
              backgroundColor={colors.primary.default}
              color={colors.primary.onText}
              size={24}
              style={styles.closeButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface.overlay, opacity: 0.5 },
  menu: { paddingHorizontal: spacing.lg },
  menuTitle: { marginBottom: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemPressed: { opacity: 0.85 },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1 },
  closeWrap: { alignItems: 'center', marginTop: spacing.md },
  closeButton: { width: 56, height: 56 },
  });
