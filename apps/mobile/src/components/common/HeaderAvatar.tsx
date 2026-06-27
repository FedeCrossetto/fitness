import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Avatar } from './Avatar';
import { useAuthStore } from '../../stores/authStore';
import { radius, useTheme } from '../../theme';
import type { MainTabsParamList } from '../../types/navigation';

interface HeaderAvatarProps {
  size?: number;
}

/** Avatar del usuario logueado con anillo de marca para headers de pantallas principales. */
export function HeaderAvatar({ size = 44 }: HeaderAvatarProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => navigation.navigate('HomeTab', { screen: 'Profile' })}
      accessibilityRole="button"
      accessibilityLabel="Ir a mi perfil"
    >
      <View style={[styles.ring, { borderColor: colors.primary.default }]}>
        <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={size} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: radius.pill,
    borderWidth: 2,
    padding: 2,
  },
});
