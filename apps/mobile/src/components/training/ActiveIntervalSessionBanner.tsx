import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../../theme';
import { hapticTap } from '../../lib/haptics';
import { formatClock } from '../../lib/trainingIntervals';
import { AppText } from '../common';
import { useTrainingStore } from '../../stores/trainingStore';
import type { MainTabsParamList } from '../../types/navigation';

/** Banner para retomar una rutina de intervalos minimizada — espejo de
 * ActiveSessionBanner (gym), pero leyendo activeIntervalSession. */
export function ActiveIntervalSessionBanner(): React.JSX.Element | null {
  const session = useTrainingStore((s) => s.activeIntervalSession);
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const [now, setNow] = useState(() => Date.now());

  const dotOpacity = useSharedValue(1);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    dotOpacity.value = withRepeat(withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
    dotScale.value = withRepeat(withSequence(withTiming(1.3, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
    return () => clearInterval(interval);
  }, [session, dotOpacity, dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  if (!session) return null;

  const elapsed = Math.floor((session.paused ? session.pausedElapsedMs : now - session.startedAt) / 1000);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrenamiento de intervalos activo: ${session.workoutTitle}`}
      onPress={() => {
        hapticTap();
        navigation.navigate('TrainingTab', {
          screen: 'IntervalSession',
          params: { workoutId: session.workoutId, workoutTitle: session.workoutTitle },
        });
      }}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#D1FF26CC', '#8FCC00EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.dotWrap}>
          <Animated.View style={[styles.dotRing, dotStyle]} />
          <View style={styles.dot} />
        </View>

        <View style={styles.info}>
          <AppText variant="caps11" color="#0e0e0e" style={{ opacity: 0.7 }}>
            {session.paused ? 'EN PAUSA' : 'INTERVALOS EN CURSO'}
          </AppText>
          <AppText variant="body14SemiBold" color="#0e0e0e" numberOfLines={1}>
            {session.workoutTitle}
          </AppText>
        </View>

        <View style={styles.timerWrap}>
          <AppText variant="body13Medium" color="#0e0e0e">
            {formatClock(elapsed)}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color="#0e0e0e" style={{ opacity: 0.7 }} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
  dotWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    backgroundColor: '#0e0e0e',
  },
  dotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(14,14,14,0.4)',
    position: 'absolute',
  },
  info: { flex: 1 },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
