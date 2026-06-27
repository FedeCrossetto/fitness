import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Colors, spacing, radius, layout, useTheme, useThemedStyles } from '../theme';
import { hapticSelect, hapticTap } from '../lib/haptics';
import { AppText } from '../components/common';
import { useUiStore } from '../stores/uiStore';

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

const HIDE_ON_ROUTES = ['CoachChat', 'Messages', 'CommunityChat'];

interface TabItemProps {
  routeName: string;
  routeKey: string;
  isFocused: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}

function TabItem({ routeName, routeKey, isFocused, activeColor, inactiveColor, onPress }: TabItemProps): React.JSX.Element {
  const meta = TAB_META[routeName];
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      key={routeKey}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={meta?.label ?? routeName}
      onPress={onPress}
      style={styles.tab}
    >
      <Ionicons
        name={isFocused ? meta?.iconActive ?? 'ellipse' : meta?.icon ?? 'ellipse-outline'}
        size={22}
        color={isFocused ? activeColor : inactiveColor}
      />
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

  const activeColor = isDark ? colors.primary.default : colors.primary.dark;

  const focusedRoute = getFocusedRouteNameFromRoute(state.routes[state.index]!);
  if (focusedRoute && HIDE_ON_ROUTES.includes(focusedRoute)) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={styles.tintOverlay} />

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          if (route.name === 'AddTab') {
            return (
              <View key={route.key} style={styles.fabSlot}>
                <Animated.View
                  onTouchEnd={() => { hapticTap(); openAddMenu(); }}
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
                </Animated.View>
              </View>
            );
          }

          const isFocused = state.index === index;

          const onPress = () => {
            hapticSelect();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            const rootScreen = TAB_ROOT_SCREEN[route.name];
            if (rootScreen) {
              navigation.navigate(route.name, { screen: rootScreen });
              return;
            }
            if (!isFocused) navigation.navigate(route.name);
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              routeKey={route.key}
              isFocused={isFocused}
              activeColor={activeColor}
              inactiveColor={colors.text.tertiary}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
    },
    tintOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.surface.overlay,
      opacity: 0.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: layout.tabBarHeight,
      paddingHorizontal: spacing.xs,
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
