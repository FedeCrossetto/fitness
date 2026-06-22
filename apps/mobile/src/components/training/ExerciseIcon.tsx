import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, Colors, useThemedStyles, useTheme } from '../../theme';

interface ExerciseIconProps {
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  muted?: boolean;
}

/** Ícono local para ejercicios — sin imágenes de internet (App Store safe). */
export function ExerciseIcon({
  icon = 'barbell-outline',
  size = 44,
  muted = false,
}: ExerciseIconProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const glyph = Math.max(16, Math.round(size * 0.4));

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size > 40 ? radius.md : radius.pill },
        muted && styles.muted,
      ]}
    >
      <Ionicons name={icon} size={glyph} color={muted ? colors.text.tertiary : colors.primary.default} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.primary.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      backgroundColor: colors.surface.elevated,
    },
  });
