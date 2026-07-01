import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLogoSource } from '../../hooks/useLogoSource';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { resolveAvatarUrl } from '../../lib/avatarUrl';
import { useStoredProfile } from '../../hooks/useStoredProfile';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton } from './authUi';

const { width: W, height: H } = Dimensions.get('window');
const SLIDER_H = H * 0.52;
const BG = authColors.background;

const CORAL = '#FE734A';
const LIMA  = '#C1ED00';
const CYAN  = '#00E3FC';

const PILLAR_EYEBROW = [
  { text: 'PSICOLOGÍA', color: CORAL },
  { text: '  ·  ',     color: 'rgba(255,255,255,0.4)' },
  { text: 'ENTRENAMIENTO', color: LIMA },
  { text: '  ·  ',     color: 'rgba(255,255,255,0.4)' },
  { text: 'NUTRICIÓN', color: CYAN },
];

const SLIDES = [
  {
    uri: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=1600&q=80&auto=format&fit=crop',
    headline: 'TRANSFORMA\nTUS HÁBITOS,\nNO SOLO TU PESO.',
  },
  {
    uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=60&auto=format&fit=crop',
    headline: 'UN MÉTODO.\nTRES PILARES.\nRESULTADOS REALES.',
  },
  {
    uri: 'https://www.alegerezcoach.com/images/ale/ale-cara.jpg',
    headline: 'HEAD COACH\nALE GEREZ.',
  },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'EasyLogin'>;

export function EasyLoginScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { profile } = useStoredProfile();
  const { signIn, signInWithOAuth } = useAuthStore();
  const logoSource = useLogoSource();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loggingIn, setLoggingIn]     = useState(false);
  const [loginError, setLoginError]   = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleLoginAsUser = async () => {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const raw = await SecureStore.getItemAsync('easy_login_credentials');
      if (raw) {
        const creds = JSON.parse(raw) as { method?: string; email?: string; password?: string };
        // OAuth login (Google, Apple, etc.)
        if (creds.method && creds.method !== 'email') {
          await signInWithOAuth(creds.method as 'google' | 'apple');
          setLoggingIn(false);
          return;
        }
        // Email/password login
        if (creds.email && creds.password) {
          const ok = await signIn(creds.email, creds.password);
          if (ok) return;
          setLoggingIn(false);
          navigation.navigate('Login', { prefillEmail: creds.email, prefillError: 'Email o contraseña incorrectos.' });
          return;
        }
      }
    } catch {
      // fall through
    }
    setLoggingIn(false);
    navigation.navigate('Login', { prefillEmail: profile?.email });
  };

  const handleOtherAccount = () => {
    // No borrar el perfil guardado acá: EasyLoginScreen y RootNavigator están
    // suscriptos al mismo store reactivo, así que limpiarlo cambia el `key` del
    // AuthStack en RootNavigator (showEasyLogin pasa a false) y fuerza un remount
    // de todo el stack a mitad de la navegación — el replace('Login') termina
    // corriendo sobre un navigator ya desmontado y la pantalla se queda pegada acá
    // (solo se ve la tarjeta de cuenta vacía). Si el usuario efectivamente inicia
    // sesión con otra cuenta, el perfil guardado se sobreescribe solo.
    navigation.replace('Login');
  };

  const initials = (profile?.fullName ?? '')
    .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const resolvedAvatar = resolveAvatarUrl(profile?.avatarUrl);
  useEffect(() => {
    setAvatarFailed(false);
  }, [resolvedAvatar]);

  return (
    <View style={styles.flex}>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <FlatList
          ref={flatRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.72)', 'transparent']}
                style={[StyleSheet.absoluteFill, { height: '55%' }]}
              />
              <LinearGradient
                colors={['transparent', BG]}
                style={[StyleSheet.absoluteFill, { top: '55%' }]}
              />
              <View style={styles.slideText}>
                <Text style={styles.headline}>{item.headline}</Text>
                {/* Pillars — below headline, centered */}
                <Text style={styles.eyebrow}>
                  {PILLAR_EYEBROW.map((seg, i) => (
                    <Text key={i} style={{ color: seg.color }}>{seg.text}</Text>
                  ))}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Scrim fijo sobre el FlatList — garantiza legibilidad del header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.4)', 'transparent']}
          style={styles.headerScrim}
        />

        {/* Header overlay: MÉTODO R3SET + X (igual que Login) */}
        <View style={[styles.headerOverlay, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.brandRow}>
            <View style={styles.logoShell}>
              <Image source={logoSource} style={styles.logo} contentFit="cover" priority="high" />
            </View>
            <AppText variant="caps11" color={LIMA} style={styles.brandName}>
              MÉTODO R3SET
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={authColors.textPrimary} />
          </Pressable>
        </View>

        {/* Dots — bottom of slider */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
      </View>

      {/* Bottom content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AppText variant="h2" color={authColors.textPrimary} style={styles.sectionTitle}>
          VOLVÉ A INGRESAR
        </AppText>
        <AppText variant="caps11" color={authColors.textTertiary} style={styles.hint}>
          SELECCIONÁ UNA CUENTA
        </AppText>

        <Pressable
          onPress={() => void handleLoginAsUser()}
          style={({ pressed }) => [styles.userCard, pressed && styles.pressed, loggingIn && styles.cardLoading]}
          accessibilityRole="button"
          disabled={loggingIn}
        >
          <View style={styles.avatarShell}>
            {resolvedAvatar && !avatarFailed ? (
              <Image
                source={{ uri: resolvedAvatar }}
                style={styles.avatar}
                contentFit="cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <AppText variant="body14SemiBold" color={authColors.background}>{initials}</AppText>
              </View>
            )}
            <View style={styles.badge} />
          </View>
          <View style={styles.userInfo}>
            <AppText variant="body14SemiBold" color={authColors.textPrimary} numberOfLines={1}>
              {profile?.fullName?.toUpperCase() ?? ''}
            </AppText>
            <AppText variant="caps11" color={authColors.textTertiary} numberOfLines={1}>
              {profile?.email ?? ''}
            </AppText>
          </View>
          {loggingIn
            ? <ActivityIndicator size="small" color={LIMA} />
            : <AppText variant="body16SemiBold" color={LIMA}>›</AppText>
          }
        </Pressable>

        {loginError ? (
          <AppText variant="caps11" color={authColors.errorText} style={styles.errorText}>
            {loginError}
          </AppText>
        ) : null}

        <AuthButton
          label="INGRESAR CON OTRA CUENTA"
          onPress={() => void handleOtherAccount()}
          fullWidth
        />

        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          style={styles.registerRow}
          accessibilityRole="button"
        >
          <AppText variant="caps11" color={authColors.textTertiary}>
            ¿SOS NUEVO?{'  '}
            <AppText variant="caps11" color={LIMA}>REGISTRATE</AppText>
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },

  sliderContainer: { height: SLIDER_H },
  slide:           { width: W, height: SLIDER_H },

  slideText: {
    position: 'absolute',
    bottom: 40,
    left: spacing.xl,
    right: spacing.xl,
    gap: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  headerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    zIndex: 1,
  },

  // Header overlay
  headerOverlay: {
    zIndex: 2,
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  logoShell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
  },
  logo: { width: 28, height: 28 },
  brandName: { letterSpacing: 2, fontStyle: 'italic' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Dots at bottom of slider
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot:         { borderRadius: 99, height: 6 },
  dotActive:   { width: 22, backgroundColor: LIMA },
  dotInactive: { width: 6,  backgroundColor: 'rgba(255,255,255,0.35)' },

  // Bottom content
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  sectionTitle: { letterSpacing: -0.3, marginBottom: -spacing.xs },
  hint: { letterSpacing: 1, marginBottom: spacing.xs },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: authColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LIMA,
    padding: spacing.md,
  },
  pressed:     { opacity: 0.8 },
  cardLoading: { opacity: 0.7 },

  avatarShell: { position: 'relative' },
  avatar:      { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    backgroundColor: LIMA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LIMA,
    borderWidth: 2,
    borderColor: authColors.surface,
  },

  userInfo:    { flex: 1, gap: 2 },
  errorText:   { textAlign: 'center', marginTop: -spacing.xs },
  registerRow: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
