import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors, radius, spacing, useTheme, useThemedStyles } from '../../theme';
import { hapticSelect } from '../../lib/haptics';
import { AppText } from './AppText';

/** Spring corto, sin overshoot — aplica a todos los SegmentedTabs de la app. */
const TAB_HIGHLIGHT_SPRING = {
  damping: 26,
  stiffness: 240,
  overshootClamping: true,
} as const;

interface SegmentedTabsProps {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

/** Tabs con highlight deslizante animado. */
export function SegmentedTabs({ tabs, activeIndex, onChange }: SegmentedTabsProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const tabWidth = width / Math.max(tabs.length, 1);
  const offset = useSharedValue(0);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width - spacing.xxs * 2);
  };

  offset.value = withSpring(activeIndex * tabWidth, TAB_HIGHLIGHT_SPRING);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 ? (
        <Animated.View style={[styles.highlight, { width: tabWidth }, highlightStyle]} />
      ) : null}
      {tabs.map((tab, index) => (
        <Pressable
          key={tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: index === activeIndex }}
          style={styles.tab}
          onPress={() => {
            hapticSelect();
            onChange(index);
          }}
        >
          <AppText
            variant="body13SemiBold"
            color={index === activeIndex ? colors.primary.onText : colors.text.secondary}
          >
            {tab}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface.base,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing.xxs,
    },
    highlight: {
      position: 'absolute',
      top: spacing.xxs,
      bottom: spacing.xxs,
      left: spacing.xxs,
      backgroundColor: colors.primary.default,
      borderRadius: radius.sm,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
  });
