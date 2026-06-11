import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, illustrations, layout, radius, spacing } from '../../theme';
import { formatLongDate } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../services/storage';
import { fetchActiveSubscription, hasActiveAccess } from '../../services/payments';
import { initHealthKit } from '../../services/health';
import { cancelReminder, scheduleDailyReminder } from '../../services/notifications';
import {
  AppText,
  Avatar,
  Button,
  Card,
  CardSkeleton,
  Chip,
  IconButton,
  SectionHeader,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import type { ProfileRow, SubscriptionRow } from '../../types/database';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

type ReminderKey = 'agua' | 'entreno' | 'comidas';

interface ReminderConfig {
  key: ReminderKey;
  storageKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption: string;
  hour: number;
  title: string;
  body: string;
}

const REMINDERS: ReminderConfig[] = [
  {
    key: 'agua',
    storageKey: 'habito:reminder:agua',
    icon: 'water-outline',
    label: 'Recordatorio de agua',
    caption: 'Todos los días a las 10:00',
    hour: 10,
    title: 'Hidratación',
    body: 'Tomate un vaso de agua y registralo en Habito.',
  },
  {
    key: 'entreno',
    storageKey: 'habito:reminder:entreno',
    icon: 'barbell-outline',
    label: 'Recordatorio de entreno',
    caption: 'Todos los días a las 18:00',
    hour: 18,
    title: 'Hora de entrenar',
    body: 'Tu entrenamiento de hoy te está esperando.',
  },
  {
    key: 'comidas',
    storageKey: 'habito:reminder:comidas',
    icon: 'restaurant-outline',
    label: 'Recordatorio de comidas',
    caption: 'Todos los días a las 13:00',
    hour: 13,
    title: 'Registrá tu comida',
    body: 'No te olvides de registrar lo que comiste.',
  },
];

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}

function SettingsRow({ icon, label, onPress, last = false }: SettingsRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary.default} />
      </View>
      <AppText variant="body16Medium" color={colors.text.primary} style={styles.rowLabel}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userProfile = useAuthStore((s) => s.userProfile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = session?.user.id;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [reminders, setReminders] = useState<Record<ReminderKey, boolean>>({
    agua: false,
    entreno: false,
    comidas: false,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      setSubLoading(true);
      try {
        const sub = await fetchActiveSubscription(userId);
        if (!cancelled) setSubscription(sub);
      } catch {
        if (!cancelled) setSubscription(null);
      } finally {
        if (!cancelled) setSubLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    void (async () => {
      const entries = await AsyncStorage.multiGet(REMINDERS.map((r) => r.storageKey));
      const next: Record<ReminderKey, boolean> = { agua: false, entreno: false, comidas: false };
      REMINDERS.forEach((reminder, i) => {
        next[reminder.key] = entries[i]?.[1] === 'true';
      });
      setReminders(next);
    })();
  }, []);

  const onPickAvatar = useCallback(async () => {
    if (!userId || uploadingAvatar) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatar(userId, asset.uri);
      // Cast temporal: el tipado de `Database` colapsa a `never` con esta versión de supabase-js
      const avatarUpdate: Partial<ProfileRow> = { avatar_url: avatarUrl };
      const { error } = await supabase.from('profiles').update(avatarUpdate as never).eq('id', userId);
      if (error) throw error;
      await refreshProfile();
      useUiStore.getState().showToast('success', 'Foto de perfil actualizada');
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos actualizar tu foto.');
    } finally {
      setUploadingAvatar(false);
    }
  }, [userId, uploadingAvatar, refreshProfile]);

  const onConnectHealth = useCallback(async () => {
    const ok = await initHealthKit();
    if (ok) {
      useUiStore.getState().showToast('success', 'Apple Health conectado');
    } else {
      useUiStore.getState().showToast('error', 'No pudimos conectar Apple Health en este dispositivo.');
    }
  }, []);

  const onToggleReminder = useCallback(async (reminder: ReminderConfig, value: boolean) => {
    setReminders((prev) => ({ ...prev, [reminder.key]: value }));
    try {
      if (value) {
        await scheduleDailyReminder(reminder.storageKey, reminder.title, reminder.body, reminder.hour, 0);
      } else {
        await cancelReminder(reminder.storageKey);
      }
      await AsyncStorage.setItem(reminder.storageKey, String(value));
    } catch {
      setReminders((prev) => ({ ...prev, [reminder.key]: !value }));
      useUiStore.getState().showToast('error', 'No pudimos actualizar el recordatorio.');
    }
  }, []);

  const onSignOut = useCallback(() => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  const subscriptionActive = hasActiveAccess(subscription);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Perfil
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Tarjeta de identidad */}
        <Card elevated style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
              onPress={() => void onPickAvatar()}
              style={styles.avatarWrap}
            >
              <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={72} />
              <View style={styles.avatarBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.text.inverse} />
                )}
              </View>
            </Pressable>
            <View style={styles.identityInfo}>
              <AppText variant="h3" color={colors.text.primary} numberOfLines={1}>
                {profile?.full_name ?? 'Atleta'}
              </AppText>
              <AppText variant="body13" color={colors.text.tertiary} numberOfLines={1}>
                {session?.user.email ?? ''}
              </AppText>
              <View style={styles.identityChips}>
                <Chip label={userProfile?.level ?? 'Inicial'} active style={styles.levelChip} />
              </View>
              {profile?.goal ? (
                <AppText variant="body13" color={colors.text.secondary} style={styles.goalText}>
                  Objetivo: {profile.goal}
                </AppText>
              ) : null}
            </View>
          </View>
          <Image source={illustrations.profile} style={styles.mascot} contentFit="contain" />
        </Card>

        {/* Plan actual */}
        <SectionHeader title="Mi plan" />
        {subLoading ? (
          <CardSkeleton />
        ) : subscriptionActive && subscription ? (
          <Card style={styles.planCard}>
            <View style={styles.planRow}>
              <View style={styles.planIcon}>
                <Ionicons name="checkmark-circle" size={20} color={colors.states.success} />
              </View>
              <View style={styles.planInfo}>
                <AppText variant="body16SemiBold" color={colors.states.success}>
                  {subscription.expires_at
                    ? `Plan activo hasta ${formatLongDate(subscription.expires_at.slice(0, 10))}`
                    : 'Plan activo'}
                </AppText>
                <AppText variant="body13" color={colors.text.secondary}>
                  Tenés acceso completo a Habito.
                </AppText>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.planCard}>
            <AppText variant="body16SemiBold" color={colors.text.primary}>
              Todavía no tenés un plan activo
            </AppText>
            <AppText variant="body13" color={colors.text.secondary} style={styles.planSub}>
              Suscribite para desbloquear todo tu entrenamiento.
            </AppText>
            <Button
              label="Ver planes"
              size="md"
              onPress={() => navigation.navigate('Subscription')}
              style={styles.planCta}
            />
          </Card>
        )}

        {/* Ajustes */}
        <SectionHeader title="Ajustes" />
        <Card style={styles.settingsCard}>
          <SettingsRow icon="flag-outline" label="Mis metas" onPress={() => navigation.navigate('Goals')} />
          <SettingsRow
            icon="trophy-outline"
            label="Logros y rachas"
            onPress={() => navigation.navigate('Achievements')}
          />
          <SettingsRow
            icon="chatbubbles-outline"
            label="Mensajes con mi coach"
            onPress={() => navigation.navigate('CoachChat')}
          />
          <SettingsRow icon="people-outline" label="Comunidad" onPress={() => navigation.navigate('Community')} last />
        </Card>

        {/* Salud */}
        <SectionHeader title="Salud" />
        <Card style={styles.settingsCard}>
          <SettingsRow icon="heart-outline" label="Conectar Apple Health" onPress={() => void onConnectHealth()} last />
        </Card>

        {/* Notificaciones */}
        <SectionHeader title="Notificaciones" />
        <Card style={styles.settingsCard}>
          {REMINDERS.map((reminder, index) => (
            <View
              key={reminder.key}
              style={[styles.row, index < REMINDERS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={reminder.icon} size={18} color={colors.primary.default} />
              </View>
              <View style={styles.rowLabel}>
                <AppText variant="body16Medium" color={colors.text.primary}>
                  {reminder.label}
                </AppText>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {reminder.caption}
                </AppText>
              </View>
              <Switch
                value={reminders[reminder.key]}
                onValueChange={(value) => void onToggleReminder(reminder, value)}
                trackColor={{ false: colors.surface.elevated, true: colors.primary.default }}
                thumbColor={colors.text.primary}
                ios_backgroundColor={colors.surface.elevated}
                accessibilityLabel={reminder.label}
              />
            </View>
          ))}
        </Card>

        <Button label="Cerrar sesión" variant="secondary" onPress={onSignOut} fullWidth style={styles.signOut} />

        <AppText variant="body12" color={colors.text.disabled} align="center" style={styles.version}>
          Habito v1.0.0
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  identityCard: { overflow: 'hidden' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarWrap: { position: 'relative' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface.elevated,
  },
  identityInfo: { flex: 1, paddingRight: 56 },
  identityChips: { flexDirection: 'row', marginTop: spacing.xs },
  levelChip: { minHeight: 28, paddingVertical: spacing.xxs },
  goalText: { marginTop: spacing.xs },
  mascot: {
    position: 'absolute',
    right: -spacing.sm,
    bottom: -spacing.md,
    width: 72,
    height: 96,
    opacity: 0.9,
  },
  planCard: { marginBottom: spacing.xxs },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInfo: { flex: 1 },
  planSub: { marginTop: spacing.xxs },
  planCta: { marginTop: spacing.md, alignSelf: 'flex-start' },
  settingsCard: { paddingVertical: spacing.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
  signOut: { marginTop: spacing.xl },
  version: { marginTop: spacing.md },
});
