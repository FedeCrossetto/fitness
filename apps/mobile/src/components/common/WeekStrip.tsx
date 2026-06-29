import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useTheme, useThemedStyles } from '../../theme';
import { AppText } from './AppText';
import { buildDateRange, getDayInfo, todayISO, formatDayMonth } from '../../lib/dates';
import { hapticTap } from '../../lib/haptics';
import { useUiStore } from '../../stores/uiStore';

const DAYS_BEFORE = 30;
const DAYS_AFTER = 14;
const DAY_CELL_WIDTH = 52;
const DAY_CELL_GAP = 6;

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 };

interface DayCellProps {
  iso: string;
  isActive: boolean;
  isCurrentDay: boolean;
  isPast: boolean;
  onSelect: (iso: string) => void;
}

function DayCell({ iso, isActive, isCurrentDay, isPast, onSelect }: DayCellProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      scale.value = withSequence(
        withSpring(0.88, SPRING),
        withSpring(1.08, SPRING),
        withSpring(1, SPRING),
      );
    }
  }, [isActive, scale]);

  const cellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { dayNum: num, dayAbbr } = getDayInfo(iso);

  return (
    <Pressable
      onPress={() => onSelect(iso)}
      accessibilityLabel={`Seleccionar ${iso}`}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.dayCell,
          isActive && styles.dayCellActive,
          cellAnimStyle,
        ]}
      >
        <AppText
          variant="body16SemiBold"
          color={
            isActive
              ? colors.primary.onText
              : isPast
              ? colors.text.tertiary
              : colors.text.primary
          }
          style={styles.dayNum}
        >
          {num}
        </AppText>
        <AppText
          variant="caps11"
          color={
            isActive
              ? colors.primary.onText
              : colors.text.tertiary
          }
          style={styles.dayAbbr}
        >
          {dayAbbr}
        </AppText>
        {isCurrentDay && (
          <View
            style={[
              styles.todayDot,
              { backgroundColor: isActive ? colors.primary.onText : colors.primary.default },
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

export type WeekStripHeaderAction = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  active?: boolean;
};

interface WeekStripProps {
  onDateChange?: (date: string) => void;
  headerAction?: WeekStripHeaderAction;
}

export function WeekStrip({ onDateChange, headerAction }: WeekStripProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const activeDate = useUiStore((s) => s.activeDate);
  const setActiveDate = useUiStore((s) => s.setActiveDate);
  const resetActiveDate = useUiStore((s) => s.resetActiveDate);

  const today = todayISO();
  const isToday = activeDate === today;

  const dates = useRef(buildDateRange(DAYS_BEFORE, DAYS_AFTER)).current;
  const scrollRef = useRef<ScrollView>(null);

  const scrollToDate = useCallback(
    (iso: string, animated = true) => {
      const idx = dates.indexOf(iso);
      if (idx < 0) return;
      const offset = idx * (DAY_CELL_WIDTH + DAY_CELL_GAP) - (DAY_CELL_WIDTH + DAY_CELL_GAP);
      scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated });
    },
    [dates]
  );

  // Scroll to today on mount (no animated)
  useEffect(() => {
    const timeout = setTimeout(() => scrollToDate(today, false), 50);
    return () => clearTimeout(timeout);
  }, [today, scrollToDate]);

  const handleSelect = useCallback(
    (iso: string) => {
      setActiveDate(iso);
      onDateChange?.(iso);
      scrollToDate(iso);
    },
    [setActiveDate, onDateChange, scrollToDate]
  );

  const handleToday = useCallback(() => {
    resetActiveDate();
    onDateChange?.(today);
    scrollToDate(today);
  }, [resetActiveDate, onDateChange, today, scrollToDate]);

  return (
    <View style={styles.container}>
      {/* Header row: date label + Hoy button */}
      <View style={styles.header}>
        <AppText variant="body16SemiBold" color={colors.text.primary}>
          {formatDayMonth(activeDate)}
        </AppText>
        <View style={styles.headerRight}>
          {!isToday && (
            <Pressable
              style={styles.todayBtn}
              onPress={handleToday}
              accessibilityLabel="Ir a hoy"
            >
              <AppText variant="body13SemiBold" color={colors.primary.default}>
                Hoy
              </AppText>
            </Pressable>
          )}
          {headerAction ? (
            <Pressable
              style={[
                styles.calBtn,
                headerAction.active && styles.headerActionActive,
              ]}
              onPress={() => {
                hapticTap();
                headerAction.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={headerAction.accessibilityLabel}
            >
              <Ionicons
                name={headerAction.icon}
                size={18}
                color={headerAction.active ? colors.primary.default : colors.text.tertiary}
              />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.calBtn}
            onPress={handleToday}
            accessibilityLabel="Ir a hoy"
          >
            <Ionicons name="calendar-outline" size={18} color={isToday ? colors.primary.default : colors.text.tertiary} />
          </Pressable>
        </View>
      </View>

      {/* Day strip */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        decelerationRate="fast"
        snapToInterval={DAY_CELL_WIDTH + DAY_CELL_GAP}
        snapToAlignment="start"
      >
        {dates.map((iso) => (
          <DayCell
            key={iso}
            iso={iso}
            isActive={iso === activeDate}
            isCurrentDay={iso === today}
            isPast={iso < today}
            onSelect={handleSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    todayBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary.default,
    },
    calBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.surface.base,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    headerActionActive: {
      borderColor: colors.primary.default,
      backgroundColor: colors.primary.muted,
    },
    strip: {
      gap: DAY_CELL_GAP,
      paddingRight: spacing.md,
    },
    dayCell: {
      width: DAY_CELL_WIDTH,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface.base,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      position: 'relative',
    },
    dayCellActive: {
      backgroundColor: colors.primary.default,
      borderColor: colors.primary.default,
    },
    dayCellPressed: {
      opacity: 0.7,
    },
    dayNum: {
      fontSize: 18,
      lineHeight: 22,
    },
    dayAbbr: {
      marginTop: 2,
      letterSpacing: 0.5,
    },
    todayDot: {
      position: 'absolute',
      bottom: 5,
      width: 5,
      height: 5,
      borderRadius: 3,
    },
  });
