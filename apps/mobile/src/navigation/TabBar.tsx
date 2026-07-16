import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Colors, spacing, radius, layout, useTheme, useThemedStyles } from '../theme';
import { hapticSelect, hapticTap } from '../lib/haptics';
import { AppText } from '../components/common';
import { useUiStore } from '../stores/uiStore';
import { tabBarBottomOffset } from '../hooks/useTabBarScrollPadding';

const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab:      { label: 'Inicio',    icon: 'home-outline',        iconActive: 'home'        },
  TrainingTab:  { label: 'Entreno',   icon: 'barbell-outline',     iconActive: 'barbell'     },
  NutritionTab: { label: 'Nutrición', icon: 'nutrition-outline',   iconActive: 'nutrition'   },
  ProgressTab:  { label: 'Progreso',  icon: 'stats-chart-outline', iconActive: 'stats-chart' },
};

const TAB_ROOT_SCREEN: Partial<Record<string, string>> = {
  HomeTab:      'HomeMain',
  TrainingTab:  'Program',
  NutritionTab: 'MealsDay',
  ProgressTab:  'Dashboard',
};

const HIDE_ON_ROUTES = ['CoachChat', 'Messages', 'CommunityChat', 'IntervalSession'];

/** Padding horizontal interno de la fila (debe coincidir con styles.row). */
const ROW_PAD = spacing.sm;
/** Inset del capsule de selección respecto al ancho de cada slot. */
const HL_INSET = 6;
/** Alto del capsule de selección. */
const HL_HEIGHT = 52;
const HL_SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
/** Distancia a la que los elementos de vidrio empiezan a fundirse (efecto líquido
 * al mover el capsule entre tabs). Ajustable en dispositivo. */
const GLASS_MERGE_SPACING = 22;

/** Componentes de vidrio nativo, cargados de forma perezosa. */
type GlassModule = {
  GlassView: React.ComponentType<Record<string, unknown>>;
  GlassContainer: React.ComponentType<Record<string, unknown>>;
};

/**
 * Carga `expo-glass-effect` SOLO si el material Liquid Glass nativo está presente
 * (iOS 26+ en una build nativa). Es deliberadamente perezoso con `require`: un
 * `import` estático evaluaría `requireNativeViewManager` al cargar el módulo y
 * rompería en Expo Go (donde el módulo nativo no existe). Acá el require pasa
 * dentro del try/catch, así que en Expo Go / Android / iOS viejo simplemente
 * devuelve `null` y usamos el fallback esmerilado. */
function loadLiquidGlass(): GlassModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as typeof import('expo-glass-effect');
    if (!mod.isLiquidGlassAvailable()) return null;
    return { GlassView: mod.GlassView as never, GlassContainer: mod.GlassContainer as never };
  } catch {
    return null;
  }
}

interface TabItemProps {
  routeName: string;
  routeKey: string;
  isFocused: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}

const SPRING = { damping: 12, stiffness: 300, mass: 0.6 };

function TabItem({ routeName, routeKey, isFocused, activeColor, inactiveColor, onPress }: TabItemProps): React.JSX.Element {
  const meta = TAB_META[routeName];
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      scale.value = withSequence(
        withSpring(0.75, SPRING),
        withSpring(1.15, SPRING),
        withSpring(1, SPRING),
      );
    }
  }, [isFocused, scale]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      key={routeKey}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={meta?.label ?? routeName}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconAnimStyle}>
        <Ionicons
          name={isFocused ? meta?.iconActive ?? 'ellipse' : meta?.icon ?? 'ellipse-outline'}
          size={22}
          color={isFocused ? activeColor : inactiveColor}
        />
      </Animated.View>
      <AppText variant="body12Medium" color={isFocused ? activeColor : inactiveColor}>
        {meta?.label ?? routeName}
      </AppText>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const openAddMenu = useUiStore((s) => s.openAddMenu);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  const glass = React.useMemo(loadLiquidGlass, []);
  const glassScheme: 'dark' | 'light' = isDark ? 'dark' : 'light';
  const activeColor = isDark ? colors.primary.default : colors.primary.dark;
  const highlightColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(12,12,12,0.06)';

  const routeCount = state.routes.length;
  const fabIndex = state.routes.findIndex((r) => r.name === 'AddTab');

  // Ancho medido de la fila + posición animada del capsule de selección.
  const rowW = useSharedValue(0);
  const pos = useSharedValue(state.index);       // slot sobre el que descansa el capsule
  const committed = useSharedValue(state.index);  // tab realmente activo (destino al soltar)
  const hoverInt = useSharedValue(state.index);   // último slot navegable "hovereado" (dedupe háptico)
  const fabHover = useSharedValue(0);             // 1 = el dedo está sobre el FAB → ocultar capsule

  // Sincroniza el capsule cuando cambia el tab activo (tap normal, deep link, back, etc.).
  useEffect(() => {
    committed.value = state.index;
    pos.value = withSpring(state.index, HL_SPRING);
  }, [state.index, committed, pos]);

  const onRowLayout = (e: LayoutChangeEvent) => {
    rowW.value = e.nativeEvent.layout.width;
  };

  const navigateToIndex = (index: number) => {
    const route = state.routes[index];
    if (!route || route.name === 'AddTab') return;
    hapticSelect();
    const isFocused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    const rootScreen = TAB_ROOT_SCREEN[route.name];
    if (rootScreen) {
      navigation.navigate(route.name, { screen: rootScreen });
      return;
    }
    if (!isFocused) navigation.navigate(route.name);
  };

  const onFabPress = () => {
    hapticTap();
    openAddMenu();
  };

  // Convierte una X dentro de la fila en un índice de slot [0, routeCount-1].
  const slotAt = (x: number): number => {
    'worklet';
    if (rowW.value === 0) return committed.value;
    const slotW = (rowW.value - ROW_PAD * 2) / routeCount;
    let s = Math.floor((x - ROW_PAD) / slotW);
    if (s < 0) s = 0;
    if (s > routeCount - 1) s = routeCount - 1;
    return s;
  };

  // Mueve el capsule al slot bajo el dedo. Sobre el FAB, oculta el capsule.
  const moveTo = (x: number) => {
    'worklet';
    const s = slotAt(x);
    if (s === fabIndex) {
      fabHover.value = 1;
      return;
    }
    fabHover.value = 0;
    pos.value = withSpring(s, HL_SPRING);
    if (s !== hoverInt.value) {
      hoverInt.value = s;
      runOnJS(hapticSelect)();
    }
  };

  // Gesto tipo WhatsApp: mantener apretado y deslizar para previsualizar y
  // elegir un tab; un tap corto sigue yendo al Pressable de cada tab.
  const pan = Gesture.Pan()
    .activateAfterLongPress(140)
    .onStart((e) => {
      hoverInt.value = committed.value;
      moveTo(e.x);
    })
    .onUpdate((e) => {
      moveTo(e.x);
    })
    .onEnd((e) => {
      const s = slotAt(e.x);
      if (s === fabIndex) {
        pos.value = withSpring(committed.value, HL_SPRING);
        runOnJS(onFabPress)();
      } else {
        runOnJS(navigateToIndex)(s);
      }
    })
    .onFinalize(() => {
      fabHover.value = 0;
    });

  const highlightStyle = useAnimatedStyle(() => {
    if (rowW.value === 0) return { opacity: 0 };
    const slotW = (rowW.value - ROW_PAD * 2) / routeCount;
    return {
      width: Math.max(0, slotW - HL_INSET * 2),
      transform: [{ translateX: ROW_PAD + pos.value * slotW + HL_INSET }],
      opacity: withTiming(fabHover.value ? 0 : 1, { duration: 140 }),
    };
  });

  const focusedRoute = getFocusedRouteNameFromRoute(state.routes[state.index]!);
  if (focusedRoute && HIDE_ON_ROUTES.includes(focusedRoute)) return null;

  const bottomOffset = tabBarBottomOffset(insets.bottom);

  return (
    <View style={[styles.wrapper, { bottom: bottomOffset }]}>
      {glass ? (
        // ── Liquid Glass nativo (iOS 26+): barra de vidrio + capsule interactivo
        // que refracta el fondo y se funde con la barra al deslizarlo (efecto lupa). ──
        <glass.GlassContainer spacing={GLASS_MERGE_SPACING} style={StyleSheet.absoluteFill}>
          <glass.GlassView
            glassEffectStyle="regular"
            colorScheme={glassScheme}
            style={styles.glassBase}
          />
          <Animated.View pointerEvents="none" style={[styles.capsule, highlightStyle]}>
            <glass.GlassView
              glassEffectStyle="clear"
              colorScheme={glassScheme}
              isInteractive
              style={styles.capsuleGlass}
            />
          </Animated.View>
        </glass.GlassContainer>
      ) : (
        // ── Fallback (Android / iOS < 26 / Expo Go): vidrio esmerilado con blur. ──
        <View style={styles.glassSurface}>
          <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.tintOverlay} />
        </View>
      )}

      <GestureDetector gesture={pan}>
        <View style={styles.row} onLayout={onRowLayout}>
          {!glass ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.capsule, { backgroundColor: highlightColor }, highlightStyle]}
            />
          ) : null}

          {state.routes.map((route, index) => {
            if (route.name === 'AddTab') {
              return (
                <View key={route.key} style={styles.fabSlot}>
                  <Pressable
                    onPress={onFabPress}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar registro"
                    style={[
                      styles.fab,
                      {
                        backgroundColor: isDark ? colors.primary.default : colors.primary.dark,
                        borderColor: isDark ? colors.surface.elevated : colors.background,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={32} color={colors.primary.onText} />
                  </Pressable>
                </View>
              );
            }

            const isFocused = state.index === index;

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                routeKey={route.key}
                isFocused={isFocused}
                activeColor={activeColor}
                inactiveColor={colors.text.tertiary}
                onPress={() => navigateToIndex(index)}
              />
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: layout.tabBarFloatingMargin,
      right: layout.tabBarFloatingMargin,
      height: layout.tabBarHeight,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 14,
    },
    // Liquid Glass (iOS 26+)
    glassBase: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
    },
    capsule: {
      position: 'absolute',
      left: 0,
      top: (layout.tabBarHeight - HL_HEIGHT) / 2,
      height: HL_HEIGHT,
      borderRadius: radius.lg,
    },
    capsuleGlass: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.lg,
    },
    // Fallback esmerilado
    glassSurface: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glass.border,
    },
    tintOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.glass.background,
      opacity: 0.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: layout.tabBarHeight,
      paddingHorizontal: ROW_PAD,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      minHeight: layout.minHitTarget,
    },
    fabSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    fab: {
      width: 58,
      height: 58,
      borderRadius: radius.lg,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -spacing.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 12,
    },
  });
