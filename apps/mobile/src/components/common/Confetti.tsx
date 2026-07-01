import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#c084fc', '#fb923c', '#34d399'];
const COUNT = 38;

interface ParticleConfig {
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  startRotate: number;
  endRotate: number;
  drift: number;
}

type ParticleProps = ParticleConfig;

function Particle({ x, color, size, delay, duration, startRotate, endRotate, drift }: ParticleProps): React.JSX.Element {
  const ty = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(startRotate);
  const tx = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.in(Easing.quad);
    opacity.value = withDelay(delay, withTiming(1, { duration: 100 }));
    ty.value = withDelay(delay, withTiming(H * 0.72, { duration, easing }));
    tx.value = withDelay(delay, withTiming(drift, { duration, easing: Easing.out(Easing.sin) }));
    rotate.value = withDelay(delay, withTiming(endRotate, { duration }));
    opacity.value = withDelay(delay + duration * 0.65, withTiming(0, { duration: duration * 0.35 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: 0,
    width: size,
    height: size * 0.5,
    backgroundColor: color,
    borderRadius: 2,
    opacity: opacity.value,
    transform: [
      { translateY: ty.value },
      { translateX: tx.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return <Animated.View style={style} />;
}

interface ConfettiProps {
  active?: boolean;
}

export function Confetti({ active = true }: ConfettiProps): React.JSX.Element | null {
  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: Math.random() * W,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        size: 7 + Math.random() * 7,
        delay: Math.random() * 500,
        duration: 1400 + Math.random() * 900,
        startRotate: Math.random() * 180,
        endRotate: Math.random() * 540 - 270,
        drift: (Math.random() - 0.5) * 80,
      })),
    [],
  );

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}
    </View>
  );
}
