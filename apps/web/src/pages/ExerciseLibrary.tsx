import { useEffect, useState } from 'react';
import type { ExerciseRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { DumbbellIcon, PlusIcon, SearchIcon } from '@/components/icons';

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

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, marginTop: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="search-field" style={{ width: '100%', marginBottom: 12 }}>
            <SearchIcon size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ejercicios…" />
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loading ? (
              <div className="muted" style={{ padding: 12 }}>Buscando…</div>
            ) : results.length === 0 ? (
              <div className="muted" style={{ padding: 12 }}>Sin resultados.</div>
            ) : (
              results.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="picker-row"
                  onClick={() => setSelected(ex)}
                  style={selected?.id === ex.id ? { background: 'var(--surface-elevated)' } : undefined}
                >
                  <div className="ex-thumb ex-thumb-icon" aria-hidden><DumbbellIcon size={14} /></div>
                  <div className="ex-info">
                    <span className="ex-name">{ex.name}</span>
                    {ex.target_muscles?.length ? <span className="muted ex-sub">{ex.target_muscles.join(', ')}</span> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card">
          {selected ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div className="ex-thumb ex-thumb-icon" style={{ width: 56, height: 56 }} aria-hidden><DumbbellIcon size={24} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
                  {selected.body_part ? <div className="muted" style={{ fontSize: 13 }}>{selected.body_part}</div> : null}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {selected.target_muscles?.length ? (
                  <div>
                    <div className="add-client-section-label">Músculos objetivo</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {selected.target_muscles.map((m) => <span key={m} className="badge solid gray">{m}</span>)}
                    </div>
                  </div>
                ) : null}
                {selected.equipment?.length ? (
                  <div>
                    <div className="add-client-section-label">Equipo</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {selected.equipment.map((eq) => <span key={eq} className="badge solid gray">{eq}</span>)}
                    </div>
                  </div>
                ) : null}
              </div>
              {selected.instructions?.length ? (
                <div style={{ marginTop: 20 }}>
                  <div className="add-client-section-label">Instrucciones</div>
                  <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    {selected.instructions.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 10 }}>
              <DumbbellIcon size={28} />
              <div style={{ fontWeight: 650 }}>Elegí un ejercicio</div>
              <p className="muted" style={{ margin: 0 }}>Empezá seleccionando uno de la lista.</p>
            </div>
          )}
        </div>
      </div>

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
