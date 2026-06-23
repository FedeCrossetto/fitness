import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { canShowExerciseImage } from '@reset-fitness/shared';
import { radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';

interface ExerciseIconProps {
  icon?: keyof typeof Ionicons.glyphMap;
  imageUrl?: string | null;
  externalSource?: string | null;
  size?: number;
  muted?: boolean;
  contentFit?: 'cover' | 'contain';
  onPress?: () => void;
}

/** Ícono de ejercicio — GIF propio en Storage o fallback local (App Store safe). */
export function ExerciseIcon({
  icon = 'barbell-outline',
  imageUrl,
  externalSource,
  size = 44,
  muted = false,
  contentFit = 'cover',
  onPress,
}: ExerciseIconProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const glyph = Math.max(16, Math.round(size * 0.4));
  const borderRadius = size > 40 ? radius.md : radius.pill;
  const showImage = canShowExerciseImage(imageUrl, externalSource);
  const pressable = Boolean(onPress && showImage);

  const content = showImage ? (
    <Image
      source={{ uri: imageUrl! }}
      style={{ width: size, height: size, borderRadius }}
      contentFit={contentFit}
      autoplay
    />
  ) : (
    <Ionicons name={icon} size={glyph} color={muted ? colors.text.tertiary : colors.text.secondary} />
  );

  const wrapStyle = [
    styles.wrap,
    { width: size, height: size, borderRadius },
    muted && styles.muted,
    showImage && styles.imageWrap,
    pressable && styles.pressable,
  ];

  if (pressable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver ejercicio en grande"
        onPress={onPress}
        style={({ pressed }) => [...wrapStyle, pressed && styles.pressed]}
      >
        {content}
        <View style={styles.expandBadge}>
          <Ionicons name="expand-outline" size={10} color={colors.text.primary} />
        </View>
      </Pressable>
    );
  }

  return <View style={wrapStyle}>{content}</View>;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      backgroundColor: colors.surface.elevated,
    },
    imageWrap: {
      backgroundColor: colors.surface.elevated,
      overflow: 'hidden',
    },
    pressable: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.default,
    },
    pressed: {
      opacity: 0.88,
    },
    expandBadge: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 16,
      height: 16,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
