import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentoriaWaitStackParamList } from '../../types/navigation';
import { spacing } from '../../theme';
import { AppText, Avatar, IconButton } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { AuthButton } from '../auth/authUi';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../services/storage';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import type { ProfileRow } from '../../types/database';

type Props = NativeStackScreenProps<MentoriaWaitStackParamList, 'Profile'>;

/** Perfil mínimo mientras el cliente espera la reunión con el coach — sin
 * acceso todavía a Goals/Achievements/Mensajes/etc. (no aplican sin cuenta
 * activa). Mismo patrón de foto de perfil que ProfileScreen.tsx. */
export function MentoriaWaitProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = session?.user.id;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      const avatarUpdate: Partial<ProfileRow> = { avatar_url: avatarUrl };
      const { error } = await supabase.from('profiles').update(avatarUpdate as never).eq('id', userId);
      if (error) throw error;
      await refreshProfile();
      useUiStore.getState().showToast('success', 'Foto de perfil actualizada.');
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos actualizar tu foto.');
    } finally {
      setUploadingAvatar(false);
    }
  }, [userId, uploadingAvatar, refreshProfile]);

  const onSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver"
          color={authColors.textPrimary}
          backgroundColor={authColors.surface}
        />
        <AppText variant="h3" color={authColors.textPrimary} style={styles.headerTitle}>
          Mi perfil
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
          onPress={() => void onPickAvatar()}
          style={styles.avatarWrap}
        >
          <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={96} />
          <View style={styles.avatarBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={authColors.background} />
            ) : (
              <Ionicons name="camera" size={14} color={authColors.background} />
            )}
          </View>
        </Pressable>

        <AppText variant="h3" color={authColors.textPrimary} align="center" style={styles.name}>
          {profile?.full_name ?? 'Sin nombre'}
        </AppText>
        <AppText variant="body13" color={authColors.textSecondary} align="center">
          {session?.user.email ?? ''}
        </AppText>

        <AuthButton label="Cerrar sesión" onPress={onSignOut} fullWidth style={styles.signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: authColors.lima,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: authColors.background,
  },
  name: { marginBottom: spacing.xxs },
  signOut: { marginTop: spacing.xxl, alignSelf: 'stretch' },
});
