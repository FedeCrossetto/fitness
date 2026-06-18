import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Colors, spacing, useTheme, useThemedStyles } from '../../theme';
import { AppText } from './AppText';

interface ProgressiveBlurHeaderProps {
  title: string;
  scrollY: SharedValue<number>;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
}

/** Header fijo que aparece y se difumina a medida que el contenido scrollea. */
export function ProgressiveBlurHeader({
  title,
  scrollY,
  rightSlot,
  leftSlot,
}: ProgressiveBlurHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 80], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [30, 80], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={[styles.wrapper, { height: insets.top + 52 }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.tintOverlay} />
      </Animated.View>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.slot}>{leftSlot}</View>
        <Animated.View style={titleStyle}>
          <AppText variant="body16SemiBold" color={colors.text.primary}>
            {title}
          </AppText>
        </Animated.View>
        <View style={styles.slot}>{rightSlot}</View>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    tintOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.surface.overlay,
      opacity: 0.6,
    },
    bar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    slot: { minWidth: 44, alignItems: 'center' },
  });
