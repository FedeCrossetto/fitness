import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';

// Silueta monocroma del logo: la tinteamos al color del theme para que se vea
// bien tanto en dark como en light.
const LOGO = require('../../../assets/android-icon-monochrome.png');
const SIZE = 128;

/**
 * Pantalla completa de carga (login, registro, resolución de sesión).
 * El logo aparece tenue y se va "llenando" de abajo hacia arriba: dos copias
 * del mismo logo superpuestas, donde la opaca se revela mediante un contenedor
 * con altura animada y overflow oculto (sin libs de masking).
 */
export function AuthLoadingOverlay(): React.JSX.Element {
  const { colors } = useTheme();
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fill, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(fill, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fill]);

  const fillHeight = fill.interpolate({ inputRange: [0, 1], outputRange: [0, SIZE] });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.logoBox}>
        {/* Logo base, tenue */}
        <Image source={LOGO} style={[styles.logo, styles.faint]} contentFit="contain" tintColor={colors.text.primary} />
        {/* Relleno: revela el logo opaco de abajo hacia arriba */}
        <Animated.View style={[styles.fill, { height: fillHeight }]}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" tintColor={colors.text.primary} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBox: { width: SIZE, height: SIZE },
  logo: { width: SIZE, height: SIZE, position: 'absolute', bottom: 0, left: 0 },
  faint: { opacity: 0.18 },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SIZE,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
});
