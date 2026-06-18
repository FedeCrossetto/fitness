import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { supabase } from '../../lib/supabase';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Input,
  SectionHeader,
  IconButton,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';
import { useUiStore } from '../../stores/uiStore';
import type { ProfileRow, TrainerBrandingRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'TrainerPanel'>;

type StudentRow = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'goal'>;

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function TrainerPanelScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const branding = useBrandingStore((s) => s.branding);
  const loadBranding = useBrandingStore((s) => s.load);

  const [appName, setAppName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [colorPrimary, setColorPrimary] = useState('');
  const [colorAccent, setColorAccent] = useState('');
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => {
    setAppName(branding?.app_name ?? '');
    setInviteCode(branding?.invite_code ?? '');
    setColorPrimary(branding?.color_primary ?? '');
    setColorAccent(branding?.color_accent ?? '');
    setWelcomeTitle(branding?.welcome_title ?? '');
    setWelcomeSubtitle(branding?.welcome_subtitle ?? '');
  }, [branding]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      setStudentsLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, goal')
        .eq('trainer_id', userId)
        .order('full_name');
      if (!cancelled) {
        setStudents((data as StudentRow[] | null) ?? []);
        setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onSave = useCallback(async () => {
    if (!userId) return;
    if (!appName.trim()) {
      useUiStore.getState().showToast('error', 'El nombre de la app no puede estar vacío.');
      return;
    }
    if (!inviteCode.trim()) {
      useUiStore.getState().showToast('error', 'El código de invitación no puede estar vacío.');
      return;
    }
    if (colorPrimary && !HEX_RE.test(colorPrimary)) {
      useUiStore.getState().showToast('error', 'Color primario inválido. Usá formato #RRGGBB.');
      return;
    }
    if (colorAccent && !HEX_RE.test(colorAccent)) {
      useUiStore.getState().showToast('error', 'Color de acento inválido. Usá formato #RRGGBB.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<TrainerBrandingRow> = {
        trainer_id: userId,
        app_name: appName.trim(),
        invite_code: inviteCode.trim().toUpperCase(),
        color_primary: colorPrimary || null,
        color_accent: colorAccent || null,
        welcome_title: welcomeTitle.trim() || null,
        welcome_subtitle: welcomeSubtitle.trim() || null,
      };
      // Cast: el tipado de `Database` colapsa a `never` con esta versión de supabase-js
      const { error } = await supabase
        .from('trainer_branding')
        .upsert(payload as never, { onConflict: 'trainer_id' });
      if (error) throw error;
      await loadBranding();
      useUiStore.getState().showToast('success', 'Marca actualizada');
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos guardar la marca.');
    } finally {
      setSaving(false);
    }
  }, [userId, appName, inviteCode, colorPrimary, colorAccent, welcomeTitle, welcomeSubtitle, loadBranding]);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Panel del entrenador
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: scrollBottom }]}>
        {/* Marca */}
        <SectionHeader title="Tu marca" />
        <Card style={styles.formCard}>
          <Input
            label="Nombre de la app"
            value={appName}
            onChangeText={setAppName}
            placeholder="Pepito Fit"
            containerStyle={styles.field}
          />
          <Input
            label="Código de invitación"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder="PEPITO"
            containerStyle={styles.field}
          />
          <View style={styles.colorRow}>
            <Input
              label="Color primario"
              value={colorPrimary}
              onChangeText={setColorPrimary}
              autoCapitalize="none"
              placeholder="#FF5A36"
              containerStyle={styles.colorInput}
            />
            <View
              style={[
                styles.swatch,
                { backgroundColor: HEX_RE.test(colorPrimary) ? colorPrimary : colors.surface.elevated },
              ]}
            />
          </View>
          <View style={styles.colorRow}>
            <Input
              label="Color de acento"
              value={colorAccent}
              onChangeText={setColorAccent}
              autoCapitalize="none"
              placeholder="#FFB020"
              containerStyle={styles.colorInput}
            />
            <View
              style={[
                styles.swatch,
                { backgroundColor: HEX_RE.test(colorAccent) ? colorAccent : colors.surface.elevated },
              ]}
            />
          </View>
          <Input
            label="Título de bienvenida"
            value={welcomeTitle}
            onChangeText={setWelcomeTitle}
            placeholder="Entrená con Pepito"
            containerStyle={styles.field}
          />
          <Input
            label="Subtítulo de bienvenida"
            value={welcomeSubtitle}
            onChangeText={setWelcomeSubtitle}
            placeholder="Tu mejor versión empieza hoy"
            containerStyle={styles.field}
          />
          <Button label="Guardar marca" onPress={() => void onSave()} loading={saving} fullWidth style={styles.saveBtn} />
        </Card>

        {/* Alumnos */}
        <SectionHeader title={`Mis alumnos${students.length > 0 ? ` (${students.length})` : ''}`} />
        {studentsLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary.default} />
          </View>
        ) : students.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppText variant="body14" color={colors.text.secondary} align="center">
              Todavía no hay alumnos vinculados. Compartí tu código de invitación
              {inviteCode ? ` "${inviteCode.toUpperCase()}"` : ''} para que se sumen al registrarse.
            </AppText>
          </Card>
        ) : (
          <Card style={styles.studentsCard}>
            {students.map((student, index) => (
              <View
                key={student.id}
                style={[styles.studentRow, index < students.length - 1 && styles.studentBorder]}
              >
                <Avatar name={student.full_name} imageUrl={student.avatar_url} size={40} />
                <View style={styles.studentInfo}>
                  <AppText variant="body16Medium" color={colors.text.primary} numberOfLines={1}>
                    {student.full_name ?? 'Alumno'}
                  </AppText>
                  {student.goal ? (
                    <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                      {student.goal}
                    </AppText>
                  ) : null}
                </View>
                <Ionicons name="person-circle-outline" size={20} color={colors.text.tertiary} />
              </View>
            ))}
          </Card>
        )}
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
  formCard: { gap: spacing.sm },
  field: { marginBottom: spacing.xs },
  colorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  colorInput: { flex: 1 },
  swatch: {
    width: layout.minHitTarget,
    height: layout.minHitTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  saveBtn: { marginTop: spacing.sm },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyCard: { paddingVertical: spacing.lg },
  studentsCard: { paddingVertical: spacing.xxs },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  studentBorder: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  studentInfo: { flex: 1 },
});
