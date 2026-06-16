import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius, spacing } from '../../theme';

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function wavePath(w: number, h: number, amplitude: number, freq: number): string {
  let d = `M 0 ${h}`;
  for (let x = 0; x <= w; x += 2) {
    const y = amplitude * Math.sin((x / w) * freq * Math.PI * 2);
    d += ` L ${x} ${y + amplitude}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

function WaterWaves({
  progress,
  width,
  height,
  color,
}: {
  progress: number;
  width: number;
  height: number;
  color: string;
}): React.JSX.Element | null {
  const phase1 = useRef(new Animated.Value(0)).current;
  const phase2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a1 = Animated.loop(
      Animated.timing(phase1, { toValue: 1, duration: 3000, useNativeDriver: false })
    );
    const a2 = Animated.loop(
      Animated.timing(phase2, { toValue: 1, duration: 4000, useNativeDriver: false })
    );
    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
    };
  }, [phase1, phase2]);

  const fillH = height * progress;
  const waveH = 20;
  const tx1 = phase1.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const tx2 = phase2.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.5, width * 0.5] });
  const path1 = wavePath(width * 2, waveH, 7, 2);
  const path2 = wavePath(width * 2, waveH, 5, 2.5);

  if (fillH < 2) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end' }]} pointerEvents="none">
      <View style={{ height: fillH, backgroundColor: withAlpha(color, 0.2) }} />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: fillH - waveH + 4,
          left: 0,
          width: width * 2,
          height: waveH,
          transform: [{ translateX: tx1 }],
        }}
      >
        <Svg width={width * 2} height={waveH}>
          <Path d={path1} fill={withAlpha(color, 0.25)} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: fillH - waveH + 8,
          left: 0,
          width: width * 2,
          height: waveH,
          transform: [{ translateX: tx2 }],
        }}
      >
        <Svg width={width * 2} height={waveH}>
          <Path d={path2} fill={withAlpha(color, 0.15)} />
        </Svg>
      </Animated.View>
    </View>
  );
}

interface WaterLevelBoxProps {
  progress: number;
  width: number;
  height: number;
  color: string;
  surfaceColor: string;
  children?: React.ReactNode;
}

export function WaterLevelBox({
  progress,
  width,
  height,
  color,
  surfaceColor,
  children,
}: WaterLevelBoxProps): React.JSX.Element {
  return (
    <View style={[styles.box, { width, height, backgroundColor: surfaceColor }]}>
      <WaterWaves progress={progress} width={width} height={height} color={color} />
      <View style={[styles.bubble1, { backgroundColor: withAlpha(color, 0.4) }]} />
      <View style={[styles.bubble2, { backgroundColor: withAlpha(color, 0.6) }]} />
      <View style={styles.content} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    zIndex: 2,
  },
  bubble1: {
    position: 'absolute',
    top: '25%',
    left: '22%',
    width: 8,
    height: 8,
    borderRadius: spacing.xxs,
  },
  bubble2: {
    position: 'absolute',
    top: '40%',
    left: '35%',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
