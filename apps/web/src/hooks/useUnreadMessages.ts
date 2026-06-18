import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_role', 'client')
        .eq('read', false);
      if (active) setCount(count ?? 0);
    };

    void fetchCount();
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void fetchCount())
      .subscribe();

    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);

  return count;
}
