import { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'Community'>;

/** Redirige al inbox unificado de mensajes. */
export function CommunityScreen({ navigation }: Props): React.JSX.Element | null {
  useEffect(() => {
    navigation.replace('Messages', { focus: 'groups' });
  }, [navigation]);
  return null;
}
