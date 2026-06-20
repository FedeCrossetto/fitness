import { useEffect, useState } from 'react';
import { DEFAULT_APP_NAME } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function useAppBrandName(): string {
  const { session } = useAuth();
  const trainerId = session?.user.id;
  const [appName, setAppName] = useState(DEFAULT_APP_NAME);

  useEffect(() => {
    if (!trainerId) {
      setAppName(DEFAULT_APP_NAME);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('trainer_branding')
        .select('app_name')
        .eq('trainer_id', trainerId)
        .maybeSingle();
      if (active) setAppName(data?.app_name?.trim() || DEFAULT_APP_NAME);
    })();
    return () => {
      active = false;
    };
  }, [trainerId]);

  return appName;
}
