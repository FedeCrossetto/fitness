import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramFolderRow, ProgramRow, TrainingDayRow, TrainingPhaseRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { ErrorState, LoadingRows, EmptyState, ConfirmDialog } from '@/components/ui';
import { DumbbellIcon, PlusIcon, SearchIcon, FolderIcon, ChevronDownIcon, GripIcon } from '@/components/icons';
import { AssignProgramModal } from '@/components/AssignProgramModal';
import { CardMenu } from '@/components/CardMenu';
import { createDragGhost } from '@/lib/dragGhost';

type ProgramWithPreview = ProgramRow & { dayTitles: string[] };

function newProgramKey(): string {
  return `program_${crypto.randomUUID()}`;
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
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<ProgramFolderRow | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ProgramFolderRow | null>(null);
  const [createFolderId, setCreateFolderId] = useState<string | null>(null);
  const [draggedProgramId, setDraggedProgramId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'library' | 'custom'>('library');

  const toggleFolder = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const { data, loading, error, refetch } = useSupabaseQuery<ProgramWithPreview[]>(
    async () => {
      const { data: programRows, error: pErr } = await supabase
        .from('programs')
        .select('*')
        .eq('trainer_id', userId!)
        .order('sort_order', { ascending: true })
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
    for (const list of byFolder.values()) list.sort((a, b) => a.sort_order - b.sort_order);
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
        folder_id: createFolderId,
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
    setCreateFolderId(null);
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
    // Update optimista: movemos la card en el estado local sin re-fetchear
    // (evita el parpadeo del skeleton al soltar en otra carpeta).
    setPrograms((prev) => prev.map((p) => (p.id === program.id ? { ...p, folder_id: folderId } : p)));
    setMoveTarget(null);
    await supabase.from('programs').update({ folder_id: folderId }).eq('id', program.id);
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const folderId = deleteFolderTarget.id;
    await supabase.from('programs').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('program_folders').delete().eq('id', folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setDeleteFolderTarget(null);
    showToast('success', 'Carpeta eliminada.');
    void refetch();
  };

  const renameFolder = async () => {
    if (!renameFolderTarget || !renameFolderName.trim()) return;
    const name = renameFolderName.trim();
    await supabase.from('program_folders').update({ name }).eq('id', renameFolderTarget.id);
    setFolders((prev) => prev.map((f) => (f.id === renameFolderTarget.id ? { ...f, name } : f)));
    setRenameFolderTarget(null);
    setRenameFolderName('');
    showToast('success', 'Carpeta renombrada.');
  };

  const duplicateFolder = async (folder: ProgramFolderRow) => {
    const { data: inserted } = await supabase
      .from('program_folders')
      .insert({ trainer_id: userId!, name: `${folder.name} (copia)` })
      .select()
      .single();
    if (!inserted) {
      showToast('error', 'No pudimos duplicar la carpeta.');
      return;
    }
    const newFolder = inserted as ProgramFolderRow;
    setFolders((prev) => [...prev, newFolder]);
    const items = grouped.get(folder.id) ?? [];
    for (const p of items) {
      const { data: cloneId } = await supabase.rpc('clone_program', {
        p_program_id: p.id,
        p_new_name: p.name,
        p_client_id: null,
      });
      if (cloneId) {
        await supabase.from('programs').update({ folder_id: newFolder.id }).eq('id', cloneId);
      }
    }
    showToast('success', 'Carpeta duplicada.');
    void refetch();
  };

  // Reordena en vivo dentro de una carpeta (solo estado local).
  const reorderInFolder = (folderId: string | null, from: number, to: number) => {
    setPrograms((prev) => {
      const inFolder = prev.filter((p) => p.folder_id === folderId).sort((a, b) => a.sort_order - b.sort_order);
      if (from === to || from < 0 || to < 0 || from >= inFolder.length || to >= inFolder.length) return prev;
      const [moved] = inFolder.splice(from, 1);
      inFolder.splice(to, 0, moved);
      const order = new Map(inFolder.map((p, i) => [p.id, i]));
      return prev.map((p) => (order.has(p.id) ? { ...p, sort_order: order.get(p.id)! } : p));
    });
  };
  const commitFolderOrder = async (folderId: string | null) => {
    const inFolder = programs.filter((p) => p.folder_id === folderId).sort((a, b) => a.sort_order - b.sort_order);
    await Promise.all(inFolder.map((p, i) => supabase.from('programs').update({ sort_order: i }).eq('id', p.id)));
  };

  // Drag manual: reordena en vivo dentro de la carpeta y, si se suelta sobre
  // OTRA carpeta, mueve el programa ahí (conserva ambos comportamientos).
  const startProgramDrag = (e: React.MouseEvent, program: ProgramWithPreview, folderKey: string, fromIndex: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input, textarea, button, .client-row-menu')) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('.prog-row');
    if (!card) return;

    const startX = e.clientX, startY = e.clientY;
    let currentIndex = fromIndex;
    let moveFolderTarget: string | null | undefined; // definido solo si el cursor está sobre otra carpeta
    let moved = false;
    let ghost: ReturnType<typeof createDragGhost> | null = null;

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
        moved = true;
        setDraggedProgramId(program.id);
        document.body.classList.add('is-dragging-card');
        ghost = createDragGhost(card, { clientX: startX, clientY: startY });
      }
      ghost?.move(ev);
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const overRow = el?.closest<HTMLElement>('.prog-row');
      const overKey = el?.closest<HTMLElement>('[data-folder-key]')?.dataset.folderKey;
      if (overRow && overKey === folderKey) {
        // Misma carpeta → reorden visual en vivo.
        const overIndex = Number(overRow.dataset.progIndex);
        if (!Number.isNaN(overIndex) && overIndex !== currentIndex) {
          reorderInFolder(program.folder_id, currentIndex, overIndex);
          currentIndex = overIndex;
        }
        moveFolderTarget = undefined;
        setDragOverFolderId(null);
      } else if (overKey !== undefined && overKey !== folderKey) {
        // Otra carpeta → destino de "mover a carpeta".
        moveFolderTarget = overKey === 'root' ? null : overKey;
        setDragOverFolderId(overKey);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) return;
      ghost?.destroy();
      document.body.classList.remove('is-dragging-card');
      setDraggedProgramId(null);
      setDragOverFolderId(null);
      const suppress = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', suppress, { capture: true });
      setTimeout(() => window.removeEventListener('click', suppress, { capture: true }), 300);
      if (moveFolderTarget !== undefined && moveFolderTarget !== program.folder_id) {
        void moveToFolder(program, moveFolderTarget);
      } else if (currentIndex !== fromIndex) {
        void commitFolderOrder(program.folder_id);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const renderProgramRow = (p: ProgramWithPreview, folderKey: string, index: number) => (
    <div
      key={p.id}
      className={`prog-row${draggedProgramId === p.id ? ' dragging' : ''}`}
      data-prog-index={index}
      onClick={() => navigate(`/programs/${p.id}`)}
      onMouseDown={(e) => startProgramDrag(e, p, folderKey, index)}
      role="button"
      tabIndex={0}
    >
      <span className="prog-row-grip" aria-hidden>
        <GripIcon size={16} />
      </span>
      <div className="prog-row-main">
        <div className="prog-row-title">{p.name}</div>
        {p.dayTitles.length > 0 ? (
          <div className="prog-row-badges">
            {p.dayTitles.map((title, i) => (
              <span key={i} className="day-chip">{title}</span>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>Sin rutinas todavía</p>
        )}
      </div>
      <div className="prog-row-side">
        {p.duration_weeks ? <span className="prog-row-duration">Duración {p.duration_weeks} semanas</span> : null}
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
    </div>
  );

  return (
    <div>
      <div className="hevy-head">
        <div>
          <h1 className="page-title">Biblioteca de programas</h1>
          <p className="page-sub">Organizá tus programas y rutinas reutilizables.</p>
        </div>
      </div>

      <div className="lib-tabs">
        <button type="button" className={`lib-tab${tab === 'library' ? ' active' : ''}`} onClick={() => setTab('library')}>
          Mi biblioteca
        </button>
        {customized.length > 0 && (
          <button type="button" className={`lib-tab${tab === 'custom' ? ' active' : ''}`} onClick={() => setTab('custom')}>
            Personalizados por cliente
          </button>
        )}
      </div>

      {tab === 'library' && (
        <div className="hevy-toolbar">
          <div className="search-field">
            <SearchIcon size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar programas…" />
          </div>
          <div className="hevy-toolbar-actions">
            <button type="button" className="btn secondary" onClick={() => setFolderModalOpen(true)}>
              <FolderIcon size={15} /> Nueva carpeta
            </button>
            <button type="button" className="btn blue" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={15} /> Crear programa
            </button>
          </div>
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="card" style={{ padding: 16 }}><LoadingRows rows={4} /></div>
      ) : tab === 'custom' ? (
        <div className="folder-body">
          {customized.map((p) => (
            <div key={p.id} className="prog-row" onClick={() => navigate(`/programs/${p.id}`)} role="button" tabIndex={0}>
              <div className="prog-row-main">
                <div className="prog-row-title">{p.name}</div>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>Personalizado — no afecta la plantilla original</p>
              </div>
            </div>
          ))}
        </div>
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
            const folderRow = group.id ? folders.find((f) => f.id === group.id) ?? null : null;
            const key = group.id ?? 'root';
            const isCollapsed = collapsed.has(key);
            const isDragOver = dragOverFolderId === key;
            return (
              <div key={key} className="folder-sec" data-folder-key={key}>
                <div className={`folder-head${isDragOver ? ' drag-target' : ''}`} onClick={() => toggleFolder(key)}>
                  <span className="folder-head-ico"><FolderIcon size={18} /></span>
                  <span className="folder-head-name">{group.name}</span>
                  <span className="count-chip">{items.length}</span>
                  <span className="folder-head-spacer" />
                  {group.id !== null && folderRow && (
                    <CardMenu
                      open={folderMenuOpenId === folderRow.id}
                      onToggle={() => setFolderMenuOpenId((prev) => (prev === folderRow.id ? null : folderRow.id))}
                      items={[
                        { label: 'Crear programa', onClick: () => { setCreateFolderId(folderRow.id); setCreateOpen(true); } },
                        { label: 'Renombrar carpeta', onClick: () => { setRenameFolderTarget(folderRow); setRenameFolderName(folderRow.name); } },
                        { label: 'Duplicar carpeta', onClick: () => void duplicateFolder(folderRow) },
                        { label: 'Eliminar carpeta', onClick: () => setDeleteFolderTarget(folderRow), danger: true },
                      ]}
                    />
                  )}
                  <span
                    className={`folder-chevron${isCollapsed ? ' collapsed' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFolder(key); }}
                  >
                    <ChevronDownIcon size={18} />
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="folder-body">
                    {items.length === 0 ? (
                      <div className={`prog-drop${isDragOver ? ' drag-over' : ''}`}>
                        {group.id === null ? (
                          <>Sin programas todavía. <button type="button" className="link-blue" onClick={() => setCreateOpen(true)}>Crear programa</button></>
                        ) : (
                          <>Arrastrá y soltá un programa acá<br /><span style={{ fontSize: 13 }}>o <button type="button" className="link-blue" onClick={() => { setCreateFolderId(group.id); setCreateOpen(true); }}>Crear programa</button></span></>
                        )}
                      </div>
                    ) : (
                      items.map((p, i) => renderProgramRow(p, key, i))
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
              <button type="button" className="btn secondary" onClick={() => { setCreateOpen(false); setCreateFolderId(null); }}>Cancelar</button>
              <button type="button" className="btn primary" disabled={!newName.trim() || creating} onClick={() => void createProgram()}>
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameFolderTarget && (
        <div className="invite-qr-backdrop" onClick={() => setRenameFolderTarget(null)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Renombrar carpeta</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%' }}
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setRenameFolderTarget(null)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={!renameFolderName.trim()} onClick={() => void renameFolder()}>Guardar</button>
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

      <ConfirmDialog
        open={!!deleteFolderTarget}
        title="Eliminar carpeta"
        message={`¿Eliminar "${deleteFolderTarget?.name}"? Los programas que tenga vuelven a "Mis Programas".`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmDeleteFolder()}
        onCancel={() => setDeleteFolderTarget(null)}
        danger
      />

      <style>{`
        .program-card { cursor: pointer; margin-bottom: 0; position: relative; }
        .program-card[draggable="true"] { cursor: grab; }
        .program-drop-zone { transition: background-color 0.15s, outline 0.15s; border-radius: 12px; }
        .program-drop-zone.drag-over { background-color: rgba(59,130,246,0.06); outline: 2px dashed var(--accent, #3b82f6); outline-offset: 4px; }
      `}</style>
    </div>
  );
}
