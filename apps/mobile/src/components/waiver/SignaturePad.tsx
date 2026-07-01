import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../common';
import { authColors } from '../../screens/auth/authScreenTheme';

export interface Point { x: number; y: number }
export type Stroke = Point[];

export const PAD_HEIGHT = 140;

export function serializeStrokes(data: Stroke[]): string {
  return JSON.stringify(data.map((s) => s.map((pt) => [Math.round(pt.x), Math.round(pt.y)])));
}

export function deserializeStrokes(raw: string | null | undefined): Stroke[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as number[][][];
    return parsed.map((s) => s.map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 })));
  } catch {
    return [];
  }
}

/** Firma digital estándar (dibujada a mano) para documentos legales: deslinde, consentimiento de imagen, etc. */
export function SignaturePad({
  width,
  strokes,
  onStrokeEnd,
  onClear,
  onDrawingChange,
  hint,
  clearLabel,
}: {
  width: number;
  strokes: Stroke[];
  onStrokeEnd: (strokes: Stroke[]) => void;
  onClear: () => void;
  onDrawingChange?: (drawing: boolean) => void;
  hint: string;
  clearLabel: string;
}): React.JSX.Element {
  const currentStroke = useRef<Stroke>([]);
  const strokesRef = useRef(strokes);
  const [, setTick] = useState(0);

  strokesRef.current = strokes;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        onDrawingChange?.(true);
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current = [{ x, y }];
        setTick((n) => n + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current.push({ x, y });
        setTick((n) => n + 1);
      },
      onPanResponderRelease: () => {
        onDrawingChange?.(false);
        if (currentStroke.current.length > 1) {
          onStrokeEnd([...strokesRef.current, [...currentStroke.current]]);
        }
        currentStroke.current = [];
        setTick((n) => n + 1);
      },
      onPanResponderTerminate: () => {
        onDrawingChange?.(false);
        currentStroke.current = [];
        setTick((n) => n + 1);
      },
    }),
  ).current;

  const pathD = (stroke: Stroke) => {
    if (stroke.length < 2) return '';
    return stroke
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
  };

  const live = currentStroke.current.length > 1 ? currentStroke.current : null;
  const allPaths = live ? [...strokes, live] : strokes;

  return (
    <View>
      <View style={[styles.padBorder, { width, height: PAD_HEIGHT }]} {...panResponder.panHandlers}>
        <Svg width={width} height={PAD_HEIGHT}>
          {allPaths.map((s, i) => (
            <Path
              key={i}
              d={pathD(s)}
              stroke={authColors.textPrimary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {strokes.length === 0 && !live && (
          <View style={styles.padHint} pointerEvents="none">
            <AppText variant="body13" color={authColors.textTertiary}>{hint}</AppText>
          </View>
        )}
      </View>
      {strokes.length > 0 ? (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={8}>
          <AppText variant="body13" color={authColors.textSecondary}>{clearLabel}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Vista de solo lectura de una firma ya guardada (sin PanResponder). */
export function SignaturePreview({ width, strokes }: { width: number; strokes: Stroke[] }): React.JSX.Element {
  const pathD = (stroke: Stroke) => {
    if (stroke.length < 2) return '';
    return stroke
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
  };

  return (
    <View style={[styles.padBorder, styles.padPreview, { width, height: PAD_HEIGHT }]}>
      <Svg width={width} height={PAD_HEIGHT}>
        {strokes.map((s, i) => (
          <Path
            key={i}
            d={pathD(s)}
            stroke={authColors.textPrimary}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  padBorder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: authColors.border,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    backgroundColor: authColors.surface,
  },
  padPreview: { borderStyle: 'solid' },
  padHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  clearBtn: { marginTop: 8, alignSelf: 'flex-end' },
});
