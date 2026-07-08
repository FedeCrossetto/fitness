import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramFolderRow, ProgramRow, TrainingDayRow, TrainingPhaseRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { ErrorState, LoadingRows, EmptyState, ConfirmDialog } from '@/components/ui';
import { DumbbellIcon, PlusIcon, SearchIcon, MoreVerticalIcon } from '@/components/icons';
import { AssignProgramModal } from '@/components/AssignProgramModal';

type ProgramWithPreview = ProgramRow & { dayTitles: string[] };

function newProgramKey(): string {
  return `program_${crypto.randomUUID()}`;
}

/** Menú kebab reutilizado del patrón de Clients.tsx. */
function CardMenu({
  open,
  onToggle,
  items,
}: {
  open: boolean;
  onToggle: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}): React.JSX.Element {
  return (
    <div className="client-row-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="client-row-kebab" onClick={onToggle} aria-label="Más opciones">
        <MoreVerticalIcon size={18} />
      </button>
      {open && (
        <>
          <div className="client-row-menu-backdrop" onClick={onToggle} />
          <div className="client-row-menu-pop">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`client-row-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => { onToggle(); item.onClick(); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProgramLibraryPage(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const userId = session?.user.id;

  const [query, setQuery] = useState('');
  const [folders, setFolders] = useState<ProgramFolderRow[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState('4');
  const [creating, setCreating] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null);
  const [moveTarget, setMoveTarget] = useState<ProgramRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<ProgramRow | null>(null);

  const { data, loading, error, refetch } = useSupabaseQuery<ProgramWithPreview[]>(
    async () => {
      const { data: programRows, error: pErr } = await supabase
        .from('programs')
        .select('*')
        .eq('trainer_id', userId!)
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;
      const programs = (programRows as ProgramRow[] | null) ?? [];
      if (programs.length === 0) return [];

      const keys = programs.map((p) => p.program_key);
      const { data: phaseRows } = await supabase
        .from('training_phases')
        .select('id, program_key')
        .in('program_key', keys);
      const phases = (phaseRows as Pick<TrainingPhaseRow, 'id' | 'program_key'>[] | null) ?? [];
      const phaseIds = phases.map((p) => p.id);

      let days: Pick<TrainingDayRow, 'phase_id' | 'title' | 'day_number'>[] = [];
      if (phaseIds.length > 0) {
        const { data: dayRows } = await supabase
          .from('training_days')
          .select('phase_id, title, day_number')
          .in('phase_id', phaseIds)
          .order('day_number');
        days = (dayRows as typeof days | null) ?? [];
      }
      const phaseIdToKey = new Map(phases.map((p) => [p.id, p.program_key]));
      const daysByKey = new Map<string, string[]>();
      for (const d of days) {
        const key = phaseIdToKey.get(d.phase_id!);
        if (!key) continue;
        const list = daysByKey.get(key) ?? [];
        list.push(d.title);
        daysByKey.set(key, list);
      }

      return programs.map((p) => ({ ...p, dayTitles: daysByKey.get(p.program_key) ?? [] }));
    },
    [userId],
    { enabled: !!userId },
  );

  const [programs, setPrograms] = useState<ProgramWithPreview[]>([]);
  useEffect(() => { if (data) setPrograms(data); }, [data]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data: folderRows } = await supabase
        .from('program_folders')
        .select('*')
        .eq('trainer_id', userId)
        .order('name');
      setFolders((folderRows as ProgramFolderRow[] | null) ?? []);
    })();
  }, [userId]);

  const templates = useMemo(() => programs.filter((p) => !p.client_id), [programs]);
  const customized = useMemo(() => programs.filter((p) => !!p.client_id), [programs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((p) => p.name.toLowerCase().includes(q));
  }, [templates, query]);

  const grouped = useMemo(() => {
    const byFolder = new Map<string | null, ProgramWithPreview[]>();
    for (const p of filtered) {
      const key = p.folder_id;
      const list = byFolder.get(key) ?? [];
      list.push(p);
      byFolder.set(key, list);
    }
    return byFolder;
  }, [filtered]);

  const createProgram = async () => {
    if (!userId || creating || !newName.trim()) return;
    setCreating(true);
    const programKey = newProgramKey();
    const durationWeeks = Number(newDuration) || null;
    const { data: inserted, error: insErr } = await supabase
      .from('programs')
      .insert({
        trainer_id: userId,
        program_key: programKey,
        name: newName.trim(),
        duration_weeks: durationWeeks,
      })
      .select()
      .single();
    if (insErr || !inserted) {
      setCreating(false);
      showToast('error', 'No pudimos crear el programa.');
      return;
    }
    // Fase única contenedora — invisible en esta UI, mantiene compatibilidad
    // con la jerarquía existente (training_phases → training_days).
    await supabase.from('training_phases').insert({
      program_key: programKey,
      trainer_id: userId,
      phase_number: 1,
      name: (inserted as ProgramRow).name,
      sort_order: 0,
      is_active: true,
    });
    setCreating(false);
    setCreateOpen(false);
    setNewName('');
    setNewDuration('4');
    showToast('success', 'Programa creado.');
    navigate(`/programs/${(inserted as ProgramRow).id}`);
  };

  const duplicateProgram = async (program: ProgramRow) => {
    const { data: cloneId, error: cloneErr } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: `${program.name} (copia)`,
      p_client_id: null,
    });
    if (cloneErr || !cloneId) {
      showToast('error', 'No pudimos duplicar el programa.');
      return;
    }
    showToast('success', 'Programa duplicado.');
    void refetch();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    // Soft cleanup: borramos fases/días/workouts asociados y la fila de programa.
    const { data: phaseRows } = await supabase
      .from('training_phases')
      .select('id')
      .eq('program_key', deleteTarget.program_key);
    const phaseIds = ((phaseRows as { id: string }[] | null) ?? []).map((p) => p.id);
    if (phaseIds.length > 0) {
      const { data: dayRows } = await supabase.from('training_days').select('id, workout_id').in('phase_id', phaseIds);
      const dayList = (dayRows as { id: string; workout_id: string | null }[] | null) ?? [];
      const workoutIds = dayList.map((d) => d.workout_id).filter((id): id is string => !!id);
      if (workoutIds.length > 0) {
        await supabase.from('workout_exercises').delete().in('workout_id', workoutIds);
        await supabase.from('workouts').delete().in('id', workoutIds);
      }
      await supabase.from('training_days').delete().in('phase_id', phaseIds);
      await supabase.from('training_phases').delete().in('id', phaseIds);
    }
    await supabase.from('programs').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    showToast('success', 'Programa eliminado.');
    void refetch();
  };

  const createFolder = async () => {
    if (!userId || !newFolderName.trim()) return;
    const { data: inserted } = await supabase
      .from('program_folders')
      .insert({ trainer_id: userId, name: newFolderName.trim() })
      .select()
      .single();
    if (inserted) setFolders((prev) => [...prev, inserted as ProgramFolderRow]);
    setNewFolderName('');
    setFolderModalOpen(false);
  };

  const moveToFolder = async (program: ProgramRow, folderId: string | null) => {
    await supabase.from('programs').update({ folder_id: folderId }).eq('id', program.id);
    setMoveTarget(null);
    void refetch();
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('¿Eliminar esta carpeta? Los programas que tenga vuelven a "Mis Programas".')) return;
    await supabase.from('programs').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('program_folders').delete().eq('id', folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    void refetch();
  };

  return (
    <div>
      <div className="row-between">
        <div>
          <h1 className="page-title">Programas</h1>
          <p className="page-sub">Organizá tus programas y rutinas reutilizables.</p>
        </div>
      </div>

      <div className="table-toolbar" style={{ border: 'none', padding: '14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="search-field">
            <SearchIcon size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar programas…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => setFolderModalOpen(true)}>
            + Nueva carpeta
          </button>
          <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon size={15} /> Crear programa
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="card" style={{ padding: 16 }}><LoadingRows rows={4} /></div>
      ) : templates.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<DumbbellIcon size={22} />}
            title="Todavía no hay programas"
            sub="Creá tu primer programa reutilizable para asignarlo a tus alumnos."
            action={{ label: '+ Crear programa', onClick: () => setCreateOpen(true) }}
          />
        </div>
      ) : (
        <>
          {[{ id: null as string | null, name: 'Mis Programas' }, ...folders.map((f) => ({ id: f.id, name: f.name }))].map((group) => {
            const items = grouped.get(group.id) ?? [];
            return (
              <div key={group.id ?? 'root'} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {group.name} <span className="clients-tab-count" style={{ marginLeft: 6 }}>{items.length}</span>
                  </div>
                  {group.id !== null && (
                    <button
                      type="button"
                      className="client-row-menu-item danger"
                      style={{ padding: '4px 8px' }}
                      onClick={() => void deleteFolder(group.id!)}
                    >
                      Eliminar carpeta
                    </button>
                  )}
                </div>
                {items.length === 0 ? (
                  <div className="card" style={{ padding: 16 }}>
                    <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                      {group.id === null ? 'Sin programas todavía.' : 'Sin programas en esta carpeta — movelos con "Mover a carpeta".'}
                    </p>
                  </div>
                ) : (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="card program-card"
                      onClick={() => navigate(`/programs/${p.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 650, fontSize: 15 }}>{p.name}</div>
                        <CardMenu
                          open={menuOpenId === p.id}
                          onToggle={() => setMenuOpenId((prev) => (prev === p.id ? null : p.id))}
                          items={[
                            { label: 'Asignar a clientes', onClick: () => setAssignTarget(p) },
                            { label: 'Editar programa', onClick: () => navigate(`/programs/${p.id}`) },
                            { label: 'Duplicar programa', onClick: () => void duplicateProgram(p) },
                            { label: 'Mover a carpeta', onClick: () => setMoveTarget(p) },
                            { label: 'Eliminar programa', onClick: () => setDeleteTarget(p), danger: true },
                          ]}
                        />
                      </div>
                      {p.dayTitles.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {p.dayTitles.map((title, i) => (
                            <span key={i} className="badge solid gray">{title}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>Sin rutinas todavía</p>
                      )}
                      {p.duration_weeks ? (
                        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Duración {p.duration_weeks} semanas</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                )}
              </div>
            );
          })}

          {customized.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Programas personalizados por cliente <span className="clients-tab-count" style={{ marginLeft: 6 }}>{customized.length}</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {customized.map((p) => (
                  <div key={p.id} className="card program-card" onClick={() => navigate(`/programs/${p.id}`)} role="button" tabIndex={0}>
                    <div style={{ fontWeight: 650, fontSize: 15 }}>{p.name}</div>
                    <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>Personalizado — no afecta la plantilla original</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {createOpen && (
        <div className="invite-qr-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Crear programa</div>
            <div className="add-client-section-label">Nombre</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%', marginBottom: 14 }}
              placeholder="Ej: Full Body x3"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="add-client-section-label">Duración (semanas)</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%' }}
              type="number"
              min={1}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={!newName.trim() || creating} onClick={() => void createProgram()}>
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {folderModalOpen && (
        <div className="invite-qr-backdrop" onClick={() => setFolderModalOpen(false)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Nueva carpeta</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%' }}
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setFolderModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={!newFolderName.trim()} onClick={() => void createFolder()}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {moveTarget && (
        <div className="invite-qr-backdrop" onClick={() => setMoveTarget(null)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Mover "{moveTarget.name}" a…</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className="client-row-menu-item" onClick={() => void moveToFolder(moveTarget, null)}>Mis Programas (sin carpeta)</button>
              {folders.map((f) => (
                <button key={f.id} type="button" className="client-row-menu-item" onClick={() => void moveToFolder(moveTarget, f.id)}>{f.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {assignTarget && <AssignProgramModal program={assignTarget} onClose={() => setAssignTarget(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar programa"
        message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        danger
      />

      <style>{`
        .program-card { cursor: pointer; margin-bottom: 0; position: relative; }
      `}</style>
    </div>
  );
}
