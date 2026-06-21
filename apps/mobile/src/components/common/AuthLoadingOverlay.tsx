import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

// Mismo asset que el splash nativo (app.json) para transición continua.
const LOGO = require('../../../assets/splash-icon.png');
const SIZE = 128;
const SPLASH_BG = '#0C0C0C';

/**
 * Pantalla completa de carga (arranque, login, resolución de sesión).
 * El logo aparece tenue y se va revelando de abajo hacia arriba.
 */
export function AuthLoadingOverlay(): React.JSX.Element {
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
    <View style={styles.root}>
      <View style={styles.logoBox}>
        <Image source={LOGO} style={[styles.logo, styles.faint]} contentFit="contain" accessibilityLabel="Reset Fit" />
        <Animated.View style={[styles.fill, { height: fillHeight }]}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" accessibilityLabel="" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
  logoBox: { width: SIZE, height: SIZE },
  logo: { width: SIZE, height: SIZE, position: 'absolute', bottom: 0, left: 0 },
  faint: { opacity: 0.22 },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SIZE,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
});
