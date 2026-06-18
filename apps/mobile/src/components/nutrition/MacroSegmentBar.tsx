import React from 'react';
import { StyleSheet, View } from 'react-native';
import { nutritionPalette } from './nutritionTheme';

const BLOCKS = 10;
const BLOCK_H = 3;
const BLOCK_W = 4;
const BLOCK_GAP = 3;

interface MacroSegmentBarProps {
  /** 0..1 */
  progress: number;
  color: string;
  trackColor?: string;
}

export function MacroSegmentBar({
  progress,
  color,
  trackColor = nutritionPalette.inactiveBlock,
}: MacroSegmentBarProps): React.JSX.Element {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const filledBlocks = Math.round(clamped * BLOCKS);
  const height = BLOCK_H * BLOCKS + BLOCK_GAP * (BLOCKS - 1);

  return (
    <View style={[styles.wrap, { height, width: BLOCK_W }]}>
      {Array.from({ length: BLOCKS }, (_, i) => {
        const fromBottom = BLOCKS - 1 - i;
        const filled = fromBottom < filledBlocks;
        return (
          <View
            key={i}
            style={[
              styles.block,
              {
                backgroundColor: filled ? color : trackColor,
                marginBottom: i < BLOCKS - 1 ? BLOCK_GAP : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'column-reverse',
    justifyContent: 'flex-start',
  },
  block: {
    width: BLOCK_W,
    height: BLOCK_H,
    borderRadius: 1.5,
  },
});
