import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type RefreshListener = () => void | Promise<void>;
const refreshListeners = new Set<RefreshListener>();

let foodSubmissionsRealtimeRefCount = 0;
let foodSubmissionsRealtimeChannel: RealtimeChannel | null = null;

function subscribeFoodSubmissionsRealtime(): () => void {
  foodSubmissionsRealtimeRefCount += 1;
  if (!foodSubmissionsRealtimeChannel) {
    foodSubmissionsRealtimeChannel = supabase
      .channel('food-submissions-pending')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_submissions' },
        () => { void refreshPendingFoodCount(); },
      )
      .subscribe();
  }
  return () => {
    foodSubmissionsRealtimeRefCount -= 1;
    if (foodSubmissionsRealtimeRefCount <= 0 && foodSubmissionsRealtimeChannel) {
      void supabase.removeChannel(foodSubmissionsRealtimeChannel);
      foodSubmissionsRealtimeChannel = null;
      foodSubmissionsRealtimeRefCount = 0;
    }
  };
}

/** Fuerza recálculo del badge de alimentos pendientes (p. ej. tras aprobar/rechazar). */
export async function refreshPendingFoodCount(): Promise<void> {
  await Promise.all([...refreshListeners].map((listener) => Promise.resolve(listener())));
}

/** Sincroniza datos cuando cambia el conteo (aprobación, visibilidad de pestaña, etc.). */
export function usePendingFoodRefresh(onRefresh: () => void | Promise<void>): void {
  useEffect(() => {
    const listener = () => void onRefresh();
    refreshListeners.add(listener);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void onRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      refreshListeners.delete(listener);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onRefresh]);
}

async function countPending(trainerId: string): Promise<number> {
  const { count } = await supabase
    .from('food_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('status', 'pending');
  return count ?? 0;
}

export function usePendingFoodCount(): number {
  const { session } = useAuth();
  const trainerId = session?.user.id;
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!trainerId) {
      setCount(0);
      return;
    }
    const pending = await countPending(trainerId);
    setCount(pending);
  }, [trainerId]);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!trainerId) return;
    return subscribeFoodSubmissionsRealtime();
  }, [trainerId]);

  usePendingFoodRefresh(fetchCount);

  return count;
}
