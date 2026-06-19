import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, ThemeMode, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../services/storage';
import { fetchActiveSubscriptionWithPlan, hasActiveAccess, type SubscriptionWithPlan } from '../../services/payments';
import { isExpoGo } from '../../services/health';
import { connectTodaySteps } from '../../services/steps';
import { showPlatformHealthError } from '../../services/healthPlatform';
import { useProgressStore } from '../../stores/progressStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import { useStepsAutoSync } from '../../hooks/useStepsAutoSync';
import { GarminSyncCard } from '../../components/health/GarminSyncCard';
import { NUTRITION_MACRO_COLORS } from '../../components/nutrition/nutritionTheme';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { cancelReminder, scheduleDailyReminder, isPushMessagesEnabled, enablePushMessages, disablePushMessages, getNotificationPermissionStatus, openNotificationSettings } from '../../services/notifications';
import {
  AppText,
  Avatar,
  Button,
  Card,
  CardSkeleton,
  Chip,
  IconButton,
  SectionHeader,
  SegmentedTabs,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useTranslation } from '../../stores/i18nStore';
import { LANGUAGES } from '@reset-fitness/shared';
import type { ProfileRow } from '../../types/database';
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

// Static config only — labels/captions/bodies are translated inside the component
const REMINDER_CONFIGS = [
  { key: 'agua'    as ReminderKey, storageKey: 'reset-fitness:reminder:agua',    icon: 'water-outline'      as const, hour: 10 },
  { key: 'entreno' as ReminderKey, storageKey: 'reset-fitness:reminder:entreno', icon: 'barbell-outline'    as const, hour: 18 },
  { key: 'comidas' as ReminderKey, storageKey: 'reset-fitness:reminder:comidas', icon: 'restaurant-outline' as const, hour: 13 },
];

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}

function SettingsRow({ icon, label, onPress, last = false }: SettingsRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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

export function ProfileScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors, mode, setMode } = useTheme();
  const switchTrackColor = { false: colors.surface.elevated, true: NUTRITION_MACRO_COLORS.carbs };
  const { t, i18n, language, setLanguage } = useTranslation();

  const THEME_MODES: { mode: ThemeMode; label: string }[] = [
    { mode: 'dark',   label: t.profile.theme_dark   },
    { mode: 'light',  label: t.profile.theme_light  },
    { mode: 'system', label: t.profile.theme_system },
  ];

  const REMINDERS: ReminderConfig[] = [
    { ...REMINDER_CONFIGS[0]!, label: t.profile.reminder_water_lbl, caption: t.profile.reminder_water_cap, title: t.profile.reminder_water_ttl, body: t.profile.reminder_water_bdy },
    { ...REMINDER_CONFIGS[1]!, label: t.profile.reminder_gym_lbl,   caption: t.profile.reminder_gym_cap,   title: t.profile.reminder_gym_ttl,   body: t.profile.reminder_gym_bdy   },
    { ...REMINDER_CONFIGS[2]!, label: t.profile.reminder_food_lbl,  caption: t.profile.reminder_food_cap,  title: t.profile.reminder_food_ttl,  body: t.profile.reminder_food_bdy  },
  ];
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const healthSectionY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.section !== 'health') return;
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, healthSectionY.current - spacing.md),
          animated: true,
        });
        navigation.setParams({ section: undefined });
      }, 150);
      return () => clearTimeout(timer);
    }, [route.params?.section, navigation])
  );

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userProfile = useAuthStore((s) => s.userProfile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = session?.user.id;

  const healthConnected = useProgressStore((s) => s.healthConnected);
  const setHealthConnected = useProgressStore((s) => s.setHealthConnected);
  const setSteps = useProgressStore((s) => s.setSteps);
  const syncAutoGoal = useGoalsStore((s) => s.syncAutoGoal);

  const scrollBottom = useTabBarScrollPadding();
  useStepsAutoSync(userId, syncAutoGoal);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [reminders, setReminders] = useState<Record<ReminderKey, boolean>>({
    agua: false,
    entreno: false,
    comidas: false,
  });
  const [pushMessages, setPushMessages] = useState(false);
  const [pushPermissionDenied, setPushPermissionDenied] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!userId) return;
    setSubLoading(true);
    try {
      setSubscription(await fetchActiveSubscriptionWithPlan(userId));
    } catch {
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
    }, [loadSubscription]),
  );

  useEffect(() => {
    void (async () => {
      const entries = await AsyncStorage.multiGet(REMINDER_CONFIGS.map((r) => r.storageKey));
      const next: Record<ReminderKey, boolean> = { agua: false, entreno: false, comidas: false };
      REMINDER_CONFIGS.forEach((reminder, i) => {
        next[reminder.key] = entries[i]?.[1] === 'true';
      });
      setReminders(next);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      setPushLoading(true);
      const [enabled, permission] = await Promise.all([
        isPushMessagesEnabled(),
        getNotificationPermissionStatus(),
      ]);
      if (cancelled) return;
      setPushMessages(enabled && permission === 'granted');
      setPushPermissionDenied(enabled && permission === 'denied');
      setPushLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

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
      useUiStore.getState().showToast('success', t.profile.avatar_updated);
    } catch {
      useUiStore.getState().showToast('error', t.profile.avatar_error);
    } finally {
      setUploadingAvatar(false);
    }
  }, [userId, uploadingAvatar, refreshProfile]);

  const onConnectHealth = useCallback(async () => {
    if (!Device.isDevice) {
      useUiStore.getState().showToast('info', t.profile.health_sim_toast);
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        t.profile.health_expo_title,
        t.profile.health_expo_msg,
        [{ text: t.profile.health_expo_ok }]
      );
      return;
    }

    const result = await connectTodaySteps();
    if (result.ok) {
      setHealthConnected(true);
      setSteps(result.steps);
      if (userId) void syncAutoGoal(userId, 'steps', result.steps);
      useUiStore.getState().showToast('success', Platform.OS === 'ios' ? t.profile.health_ok_ios : t.profile.health_ok_android);
      return;
    }

    void showPlatformHealthError(result, t.profile);
  }, [setHealthConnected, setSteps, syncAutoGoal, userId, t]);

  const onDisconnectHealth = useCallback(() => {
    // El Switch ya se movió visualmente — lo revertimos optimistamente y confirmamos
    setHealthConnected(false);
    setSteps(0);
    Alert.alert(
      t.profile.health_disc_title,
      Platform.OS === 'ios' ? t.profile.health_disc_ios : t.profile.health_disc_and,
      [{ text: t.profile.ok }]
    );
  }, [setHealthConnected, setSteps, t]);

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
      useUiStore.getState().showToast('error', t.profile.reminder_error);
    }
  }, [t]);

  const onTogglePushMessages = useCallback(async (value: boolean) => {
    if (!userId) return;
    if (value) {
      setPushMessages(true);
      setPushPermissionDenied(false);
      const result = await enablePushMessages(userId);
      if (result === 'enabled') return;
      setPushMessages(false);
      if (result === 'denied') {
        setPushPermissionDenied(true);
        Alert.alert(
          t.profile.notifications,
          t.profile.push_messages_denied,
          [
            { text: t.profile.cancel, style: 'cancel' },
            { text: t.ui.open_settings, onPress: openNotificationSettings },
          ],
        );
        return;
      }
      if (result === 'simulator') {
        useUiStore.getState().showToast('error', t.profile.push_messages_sim);
        return;
      }
      if (result === 'missing_apns') {
        Alert.alert(t.profile.notifications, t.profile.push_messages_rebuild);
        return;
      }
      useUiStore.getState().showToast('error', t.profile.push_messages_error);
      return;
    }
    setPushMessages(false);
    setPushPermissionDenied(false);
    await disablePushMessages(userId);
  }, [userId, t]);

  const onSignOut = useCallback(() => {
    Alert.alert(t.profile.sign_out, t.profile.sign_out_confirm, [
      { text: t.profile.cancel, style: 'cancel' },
      { text: t.profile.sign_out, style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  const subscriptionActive = hasActiveAccess(subscription);
  const planName = subscription?.plan_name;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.ui.back} />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          {t.profile.title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: scrollBottom }]}>
        {/* Tarjeta de identidad */}
        <Card elevated style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.profile.change_photo}
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
                {profile?.full_name ?? t.profile.fallback_name}
              </AppText>
              <AppText variant="body13" color={colors.text.tertiary} numberOfLines={1}>
                {session?.user.email ?? ''}
              </AppText>
              <View style={styles.identityChips}>
                <Chip label={userProfile?.level ?? t.profile.fallback_level} active style={styles.levelChip} />
              </View>
              {profile?.goal ? (
                <View style={styles.goalBadge}>
                  <AppText variant="body13Medium" color={colors.text.secondary}>
                    {profile.goal}
                  </AppText>
                </View>
              ) : null}
              {subscriptionActive && planName ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Subscription')}
                  style={styles.subscriptionBadge}
                >
                  <Ionicons name="card-outline" size={14} color={colors.primary.default} />
                  <View style={styles.subscriptionCopy}>
                    <AppText variant="body13SemiBold" color={colors.text.primary}>
                      {planName}
                    </AppText>
                    {subscription?.expires_at ? (
                      <AppText variant="body12" color={colors.text.tertiary}>
                        {i18n(t.profile.plan_expires, {
                          date: formatLongDate(subscription.expires_at.slice(0, 10)),
                        })}
                      </AppText>
                    ) : (
                      <AppText variant="body12" color={colors.states.success}>
                        {t.profile.plan_active}
                      </AppText>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Plan actual */}
        <SectionHeader title={t.profile.my_plan} />
        {subLoading ? (
          <CardSkeleton />
        ) : subscriptionActive && subscription ? (
          <Card style={styles.planCard}>
            <View style={styles.planRow}>
              <View style={styles.planIcon}>
                <Ionicons name="checkmark-circle" size={20} color={colors.states.success} />
              </View>
              <View style={styles.planInfo}>
                <AppText variant="body16SemiBold" color={colors.text.primary}>
                  {planName ?? t.profile.plan_active}
                </AppText>
                <AppText variant="body13" color={colors.text.secondary} style={styles.planSub}>
                  {subscription.expires_at
                    ? i18n(t.profile.plan_active_until, {
                        date: formatLongDate(subscription.expires_at.slice(0, 10)),
                      })
                    : t.profile.plan_full_access}
                </AppText>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.planCard}>
            <AppText variant="body16SemiBold" color={colors.text.primary}>
              {t.profile.plan_none}
            </AppText>
            <AppText variant="body13" color={colors.text.secondary} style={styles.planSub}>
              {t.profile.plan_none_sub}
            </AppText>
            <Button
              label={t.profile.see_plans}
              size="md"
              onPress={() => navigation.navigate('Subscription')}
              style={styles.planCta}
            />
          </Card>
        )}

        {/* Panel del entrenador */}
        {profile?.role === 'trainer' ? (
          <>
            <SectionHeader title={t.profile.trainer_section} />
            <Card style={styles.settingsCard}>
              <SettingsRow
                icon="briefcase-outline"
                label={t.profile.trainer_panel}
                onPress={() => navigation.navigate('TrainerPanel')}
                last
              />
            </Card>
          </>
        ) : null}

        {/* Ajustes */}
        <SectionHeader title={t.profile.settings} />
        <Card style={styles.settingsCard}>
          <SettingsRow icon="flag-outline" label={t.profile.goals_nav} onPress={() => navigation.navigate('Goals')} />
          <SettingsRow
            icon="trophy-outline"
            label={t.profile.achievements_nav}
            onPress={() => navigation.navigate('Achievements')}
          />
          <SettingsRow
            icon="chatbubbles-outline"
            label={t.profile.coach_chat}
            onPress={() => navigation.navigate('CoachChat')}
          />
          <SettingsRow icon="people-outline" label={t.profile.community} onPress={() => navigation.navigate('Community')} last />
        </Card>

        {/* Apariencia */}
        <SectionHeader title={t.profile.appearance} />
        <Card style={styles.settingsCard}>
          <View style={styles.themeRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="color-palette-outline" size={18} color={colors.primary.default} />
            </View>
            <AppText variant="body16Medium" color={colors.text.primary} style={styles.rowLabel}>
              {t.profile.theme}
            </AppText>
          </View>
          <SegmentedTabs
            tabs={THEME_MODES.map((t) => t.label)}
            activeIndex={Math.max(0, THEME_MODES.findIndex((t) => t.mode === mode))}
            onChange={(index) => setMode(THEME_MODES[index]!.mode)}
          />

          {/* Language selector */}
          <View style={[styles.themeRow, { marginTop: spacing.md }]}>
            <View style={styles.rowIcon}>
              <Ionicons name="language-outline" size={18} color={colors.primary.default} />
            </View>
            <AppText variant="body16Medium" color={colors.text.primary} style={styles.rowLabel}>
              {t.profile.language}
            </AppText>
          </View>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[
                  styles.langChip,
                  language === lang.code && { backgroundColor: colors.primary.default },
                ]}
                onPress={() => setLanguage(lang.code)}
                accessibilityRole="button"
                accessibilityLabel={lang.label}
              >
                <AppText
                  variant="body13SemiBold"
                  color={language === lang.code ? '#fff' : colors.text.secondary}
                >
                  {lang.flag}  {lang.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Salud */}
        <View
          onLayout={(event) => {
            healthSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <SectionHeader title={t.profile.health} />
          <Card style={styles.settingsCard}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'heart-outline' : 'walk-outline'}
                  size={18}
                  color={colors.primary.default}
                />
              </View>
              <View style={styles.rowLabel}>
                <AppText variant="body16Medium" color={colors.text.primary}>
                  {Platform.OS === 'ios' ? t.profile.apple_health : t.profile.health_connect}
                </AppText>
                {!Device.isDevice ? (
                  <AppText variant="body12" color={colors.text.disabled}>{t.profile.simulator_warn}</AppText>
                ) : isExpoGo ? (
                  <AppText variant="body12" color={colors.text.disabled}>{t.profile.native_required}</AppText>
                ) : (
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {Platform.OS === 'ios' ? t.profile.health_sub_ios : t.profile.health_sub_android}
                  </AppText>
                )}
              </View>
              <Switch
                value={healthConnected}
                onValueChange={(value) => value ? void onConnectHealth() : onDisconnectHealth()}
                disabled={!Device.isDevice || isExpoGo}
                trackColor={switchTrackColor}
                thumbColor={colors.text.primary}
                ios_backgroundColor={colors.surface.elevated}
                accessibilityLabel={Platform.OS === 'ios' ? t.profile.accessibility_connect_ios : t.profile.accessibility_connect_and}
              />
            </View>
          </Card>

          <GarminSyncCard />
        </View>

        {/* Notificaciones */}
        <SectionHeader title={t.profile.notifications} />
        <Card style={styles.settingsCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary.default} />
            </View>
            <View style={styles.rowLabel}>
              <AppText variant="body16Medium" color={colors.text.primary}>
                {t.profile.push_messages_lbl}
              </AppText>
              <AppText variant="body12" color={pushPermissionDenied ? colors.states.error : colors.text.tertiary}>
                {pushPermissionDenied ? t.profile.push_messages_denied : t.profile.push_messages_cap}
              </AppText>
            </View>
            <Switch
              value={pushMessages}
              onValueChange={(value) => void onTogglePushMessages(value)}
              disabled={!Device.isDevice || pushLoading}
              trackColor={switchTrackColor}
              thumbColor={colors.text.primary}
              ios_backgroundColor={colors.surface.elevated}
              accessibilityLabel={t.profile.push_messages_lbl}
            />
          </View>
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
                trackColor={switchTrackColor}
                thumbColor={colors.text.primary}
                ios_backgroundColor={colors.surface.elevated}
                accessibilityLabel={reminder.label}
              />
            </View>
          ))}
        </Card>

        <Button label={t.profile.sign_out} variant="secondary" onPress={onSignOut} fullWidth style={styles.signOut} />

        <AppText variant="body12" color={colors.text.disabled} align="center" style={styles.version}>
          Reset Fit v1.0.0
        </AppText>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
  identityInfo: { flex: 1 },
  identityChips: { flexDirection: 'row', marginTop: spacing.xs },
  levelChip: { minHeight: 28, paddingVertical: spacing.xxs },
  goalBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.muted,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.elevated,
  },
  subscriptionCopy: { flex: 1 },
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
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
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
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  langChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: { marginTop: spacing.xl },
  version: { marginTop: spacing.md },
});
