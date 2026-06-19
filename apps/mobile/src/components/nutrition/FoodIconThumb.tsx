import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { radius, useThemedStyles, useTheme } from '../../theme';
import { getFoodIconSource } from './foodIconCatalog';

interface FoodIconThumbProps {
  iconKey?: string | null;
  /** URL remota (ej. Open Food Facts). Tiene prioridad sobre iconKey. */
  remoteUrl?: string | null;
  size?: number;
}

export function FoodIconThumb({ iconKey, remoteUrl, size = 36 }: FoodIconThumbProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const source = remoteUrl ? { uri: remoteUrl } : getFoodIconSource(iconKey);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius.sm }]}>
      <Image source={source} style={styles.image} contentFit="cover" transition={120} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    wrap: {
      overflow: 'hidden',
      backgroundColor: colors.surface.elevated,
    },
    image: {
      width: '100%',
      height: '100%',
    },
  });
