import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors, radius, useTheme, useThemedStyles } from '../../theme';
import { AppText } from './AppText';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ name, imageUrl, size = 44 }: AvatarProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const dimension = { width: size, height: size, borderRadius: radius.pill };

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.image, dimension]} contentFit="cover" transition={150} />;
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <AppText
        variant={size >= 56 ? 'metricSmall' : 'body14SemiBold'}
        color={colors.primary.dark}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    image: { backgroundColor: colors.surface.elevated },
    fallback: {
      backgroundColor: colors.primary.muted,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
