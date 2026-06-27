import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';

interface Props {
  onAuthenticate: () => Promise<boolean>;
}

export function BiometricLockScreen({ onAuthenticate }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // Intenta autenticar automáticamente al montar
  useEffect(() => {
    void onAuthenticate();
  }, [onAuthenticate]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={48} color="#fff" />
      </View>
      <AppText variant="h2" color="#fff" style={styles.title}>
        App bloqueada
      </AppText>
      <AppText variant="body14" color="rgba(255,255,255,0.7)" style={styles.sub}>
        Verificá tu identidad para continuar
      </AppText>
      <Pressable
        onPress={() => void onAuthenticate()}
        accessibilityRole="button"
        accessibilityLabel="Desbloquear con biometría"
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Ionicons name="finger-print" size={22} color="#fff" />
        <AppText variant="body14SemiBold" color="#fff">
          Desbloquear
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center' },
  btn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 32,
  },
  btnPressed: { opacity: 0.7 },
});
