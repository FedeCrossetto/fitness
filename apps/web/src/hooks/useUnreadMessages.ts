import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();

/** Fuerza recálculo del badge de mensajes sin leer (p. ej. tras abrir un chat). */
export function refreshUnreadMessages(): void {
  for (const listener of refreshListeners) listener();
}

/**
 * Cantidad de mensajes sin leer enviados por los alumnos del entrenador.
 * RLS limita el conteo a los clientes del entrenador autenticado. Se refresca
 * en vivo ante cualquier cambio en la tabla de mensajes.
 */
export function useUnreadMessages(): number {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const fetchCount = async () => {
      const { count: unread, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_role', 'client')
        .eq('read', false);
      if (active && !error) setCount(unread ?? 0);
    };

    const onRefresh = () => void fetchCount();
    refreshListeners.add(onRefresh);

    void fetchCount();
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onRefresh)
      .subscribe();

    return () => {
      active = false;
      refreshListeners.delete(onRefresh);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
