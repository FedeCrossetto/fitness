import React from 'react';
import { Pressable } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Avatar } from './Avatar';
import { useAuthStore } from '../../stores/authStore';
import type { MainTabsParamList } from '../../types/navigation';

interface HeaderAvatarProps {
  size?: number;
}

/** Avatar del usuario logueado para el margen superior derecho de los headers.
 * Lleva al perfil cruzando al HomeTab desde cualquier tab. */
export function HeaderAvatar({ size = 48 }: HeaderAvatarProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const profile = useAuthStore((s) => s.profile);

  return (
    <Pressable
      onPress={() => navigation.navigate('HomeTab', { screen: 'Profile' })}
      accessibilityRole="button"
      accessibilityLabel="Ir a mi perfil"
    >
      <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={size} />
    </Pressable>
  );
}
