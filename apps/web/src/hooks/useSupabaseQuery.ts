import { useCallback, useEffect, useRef, useState } from 'react';

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Encapsula el patrón loading/error/data + refetch que se repetía en cada página.
 *
 *   const { data, loading, error, refetch } = useSupabaseQuery(
 *     async () => {
 *       const { data, error } = await supabase.from('x').select('*');
 *       if (error) throw error;
 *       return data;
 *     },
 *     [userId],
 *   );
 *
 * - El fetcher debe lanzar (throw) ante error; el hook lo captura y expone `error`.
 * - Cancela actualizaciones de estado si el componente se desmonta o cambian las deps.
 * - `enabled: false` pospone la consulta (útil mientras no hay userId).
 */
export function useSupabaseQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): QueryResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Mantenemos la última referencia del fetcher sin re-disparar por su identidad.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetcherRef.current()
      .then((result) => {
        if (active) { setData(result); setLoading(false); }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error inesperado');
          setLoading(false);
        }
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, tick]);

  return { data, loading, error, refetch };
}
