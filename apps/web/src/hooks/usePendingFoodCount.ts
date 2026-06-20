import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function usePendingFoodCount(): number {
  const { session } = useAuth();
  const trainerId = session?.user.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trainerId) {
      setCount(0);
      return;
    }
    let active = true;
    void (async () => {
      const { count: pending } = await supabase
        .from('food_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainerId)
        .eq('status', 'pending');
      if (active) setCount(pending ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [trainerId]);

  return count;
}
