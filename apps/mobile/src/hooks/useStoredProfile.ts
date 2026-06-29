import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'easy_login_profile';

export interface StoredProfile {
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export function useStoredProfile(): {
  profile: StoredProfile | null | undefined;
  saveProfile: (p: StoredProfile) => Promise<void>;
  clearProfile: () => Promise<void>;
} {
  const [profile, setProfile] = useState<StoredProfile | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((val) => setProfile(val ? (JSON.parse(val) as StoredProfile) : null))
      .catch(() => setProfile(null));
  }, []);

  const saveProfile = async (p: StoredProfile) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
    setProfile(p);
  };

  const clearProfile = async () => {
    await AsyncStorage.removeItem(KEY);
    setProfile(null);
  };

  return { profile, saveProfile, clearProfile };
}
