import { useEffect, useState } from 'react';
import type { ExerciseRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { DumbbellIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';

/** Catálogo de ejercicios — búsqueda + detalle simple. La creación de un
 * ejercicio propio pide solo el nombre (sin editor de músculos/equipo/
 * instrucciones en detalle, por ahora — ver conversación de scope). */
export function ExerciseLibraryPage(): React.JSX.Element {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExerciseRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        let q = supabase.from('exercises').select('*').order('name').limit(80);
        if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setResults((data as ExerciseRow[] | null) ?? []);
        setLoading(false);
      })();
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  const createExercise = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data, error } = await supabase.from('exercises').insert({ name: newName.trim(), exercise_type: 'custom' }).select().single();
    setCreating(false);
    if (error || !data) { showToast('error', 'No pudimos crear el ejercicio.'); return; }
    showToast('success', 'Ejercicio creado.');
    setResults((prev) => [data as ExerciseRow, ...prev]);
    setSelected(data as ExerciseRow);
    setCreateOpen(false);
    setNewName('');
  };

  return (
    <div>
      <div className="row-between">
        <div>
          <h1 className="page-title">Ejercicios</h1>
          <p className="page-sub">Buscá ejercicios existentes o creá los tuyos propios.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
          <PlusIcon size={15} /> Ejercicio personalizado
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div className="search-field" style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
          <SearchIcon size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ejercicios…" />
        </div>
        {loading ? (
          <div className="muted" style={{ padding: 12 }}>Buscando…</div>
        ) : results.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>Sin resultados.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 4 }}>
            {results.map((ex) => (
              <button key={ex.id} type="button" className="picker-row" onClick={() => setSelected(ex)}>
                <div
                  className="ex-thumb ex-thumb-icon"
                  aria-hidden
                  style={ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : undefined}
                >
                  {ex.image_url ? null : <DumbbellIcon size={14} />}
                </div>
                <div className="ex-info">
                  <span className="ex-name">{ex.name}</span>
                  {ex.target_muscles?.length ? <span className="muted ex-sub">{ex.target_muscles.join(', ')}</span> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ExerciseDetailModal exercise={selected} onClose={() => setSelected(null)} />
      )}

      {createOpen && (
        <div className="invite-qr-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Ejercicio personalizado</div>
            <div className="add-client-section-label">Nombre</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%' }}
              placeholder="Ej: Sentadilla búlgara"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void createExercise(); }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={!newName.trim() || creating} onClick={() => void createExercise()}>
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
