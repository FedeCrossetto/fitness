import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppActive } from '../../hooks/useAppActive';
import { AppText } from './AppText';

const HEALTH_URL = 'https://lddadlaqvvqelbftvgpd.supabase.co/health';
const CHECK_TIMEOUT = 8000;

async function isOnline(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT);
    // Cualquier respuesta HTTP (incluso 4xx/5xx) significa que hay red.
    // Solo lanza excepción si no hay conexión en absoluto.
    await fetch(HEALTH_URL, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function NetworkBanner(): React.JSX.Element | null {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const checkingRef = useRef(false);
  const initialCheckDone = useRef(false);

  const check = async (isInitial = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const online = await isOnline();
    checkingRef.current = false;
    // En el primer chequeo al abrir no mostramos el banner aunque falle
    // (la red puede tardar unos segundos en conectarse al arrancar el dispositivo).
    if (isInitial) {
      initialCheckDone.current = true;
      if (!online) {
        // Segunda oportunidad tras 3s antes de decidir que realmente no hay red
        setTimeout(() => { void check(); }, 3000);
      }
      return;
    }
    setOffline(!online);
  };

  useEffect(() => { void check(true); }, []);
  useAppActive(() => { void check(); });

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: offline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [offline, opacity]);

  if (!offline) return null;

  return (
    <Animated.View style={[styles.banner, { paddingTop: insets.top + 8, opacity }]}>
      <View style={styles.row}>
        <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
        <AppText variant="body12SemiBold" color="#fff">
          Sin conexión — revisá tu internet
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ef4444',
    zIndex: 999,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
});
