import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  ExerciseRow,
  ProgramRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { PlusIcon, ChevronDownIcon, CheckIcon, GripIcon } from '@/components/icons';
import { AssignProgramModal } from '@/components/AssignProgramModal';
import { CardMenu } from '@/components/CardMenu';
import { startSortableDrag } from '@/lib/sortableDrag';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Distribución de series por grupo muscular — DATOS SIMULADOS (mock).
 * Reemplazar por el cálculo real (a partir de exercise.target_muscles ya
 * disponible en `summary.muscleRows`) cuando el catálogo tenga el mapeo de
 * músculos completo. El header "Datos simulados" marca esta sección. */
const MOCK_MUSCLE_SETS: [string, number][] = [
  ['Abdominales', 24], ['Abductores', 0], ['Aductores', 0], ['Bíceps', 18],
  ['Gemelos', 2], ['Cardio', 6], ['Pecho', 12], ['Antebrazos', 6],
  ['Cuerpo completo', 0], ['Glúteos', 4], ['Isquiotibiales', 6], ['Dorsales', 10],
  ['Lumbares', 2], ['Cuello', 0], ['Otros', 0], ['Cuádriceps', 6],
  ['Hombros', 18], ['Trapecios', 2], ['Tríceps', 20], ['Espalda alta', 12],
];

/** Un programa nuevo siempre tiene una única fase contenedora (invisible acá) —
 * ver comentario en la migración 20260708010000_program_library.sql. Si por
 * algún motivo no existe todavía, se crea al cargar. */
export function ProgramEditorPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const trainerId = session?.user.id ?? null;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [days, setDays] = useState<DayWithWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DayWithWorkout | null>(null);
  const [draggedDayIndex, setDraggedDayIndex] = useState<number | null>(null);
  const [copyTarget, setCopyTarget] = useState<DayWithWorkout | null>(null);
  const [copyPrograms, setCopyPrograms] = useState<ProgramRow[]>([]);
  const [assignDayTarget, setAssignDayTarget] = useState<DayWithWorkout | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [durationDraft, setDurationDraft] = useState('');

  const load = useCallback(async () => {
    if (!id || !trainerId) return;
    try {
      const { data: programRow, error: pErr } = await supabase.from('programs').select('*').eq('id', id).maybeSingle();
      if (pErr) throw pErr;
      if (!programRow) { setError('Programa no encontrado.'); setLoading(false); return; }
      const p = programRow as ProgramRow;
      setProgram(p);
      setNameDraft(p.name);
      setNoteDraft(p.note ?? '');
      setDurationDraft(p.duration_weeks ? String(p.duration_weeks) : '');

      let { data: phaseRows } = await supabase
        .from('training_phases')
        .select('*')
        .eq('program_key', p.program_key)
        .order('sort_order')
        .limit(1);
      let phase = ((phaseRows as TrainingPhaseRow[] | null) ?? [])[0];
      if (!phase) {
        const { data: created } = await supabase
          .from('training_phases')
          .insert({ program_key: p.program_key, trainer_id: trainerId, phase_number: 1, name: p.name, sort_order: 0, is_active: true })
          .select()
          .single();
        phase = created as TrainingPhaseRow;
      }
      setPhaseId(phase.id);

      const { data: dayRows, error: dErr } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, image_url, target_muscles)))')
        .eq('phase_id', phase.id)
        .order('day_number');
      if (dErr) throw dErr;
      setDays((dayRows ?? []) as unknown as DayWithWorkout[]);
      setError(null);
    } catch {
      setError('No pudimos cargar el programa.');
    } finally {
      setLoading(false);
    }
  }, [id, trainerId]);

  useEffect(() => { void load(); }, [load]);

  const saveProgramField = async (patch: Partial<Pick<ProgramRow, 'name' | 'note' | 'duration_weeks'>>) => {
    if (!program) return;
    await supabase.from('programs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', program.id);
    setProgram((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const addRoutine = async () => {
    if (!trainerId || !phaseId) return;
    const nextNumber = days.reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ trainer_id: trainerId, title: `Rutina ${nextNumber}`, workout_type: 'fuerza', blocks: 1 })
      .select('id')
      .single();
    if (wErr || !workout) return;
    await supabase.from('training_days').insert({
      phase_id: phaseId,
      day_number: nextNumber,
      title: `Rutina ${nextNumber}`,
      day_type: 'fuerza',
      workout_id: (workout as { id: string }).id,
      sort_order: days.length,
    });
    await load();
  };

  const confirmDeleteRoutine = async () => {
    if (!deleteTarget) return;
    const day = deleteTarget;
    if (day.workout) await supabase.from('workout_exercises').delete().eq('workout_id', day.workout.id);
    await supabase.from('training_days').delete().eq('id', day.id);
    if (day.workout) await supabase.from('workouts').delete().eq('id', day.workout.id);
    setDeleteTarget(null);
    await load();
  };

  const renameRoutine = async (dayId: string, title: string) => {
    await supabase.from('training_days').update({ title }).eq('id', dayId);
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, title } : d)));
  };

  // Reorden con card fantasma y reordenamiento visual en vivo (helper compartido).
  const reorderRoutinesLocal = (from: number, to: number) => {
    setDays((prev) => {
      const items = [...prev].sort((a, b) => a.day_number - b.day_number);
      if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return prev;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return items.map((d, i) => ({ ...d, day_number: i + 1 }));
    });
  };
  const commitRoutineOrder = async () => {
    const items = [...days].sort((a, b) => a.day_number - b.day_number);
    await Promise.all(items.map((d, i) => supabase.from('training_days').update({ day_number: i + 1 }).eq('id', d.id)));
  };
  const startRoutineDrag = (e: React.MouseEvent, fromIndex: number) =>
    startSortableDrag({
      event: e, index: fromIndex, cardSelector: '.routine-row', dataAttr: 'routineIndex',
      move: reorderRoutinesLocal, commit: () => void commitRoutineOrder(), setDragIndex: setDraggedDayIndex,
    });

  const duplicateRoutine = async (day: DayWithWorkout) => {
    if (!trainerId || !phaseId) return;
    const nextNumber = days.reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ trainer_id: trainerId, title: `${day.title} (copia)`, workout_type: day.day_type, blocks: day.workout?.blocks ?? 1 })
      .select('id')
      .single();
    if (wErr || !workout) { showToast('error', 'No pudimos duplicar la rutina.'); return; }
    const newWorkoutId = (workout as { id: string }).id;
    const exercises = day.workout?.exercises ?? [];
    if (exercises.length > 0) {
      await supabase.from('workout_exercises').insert(
        exercises.map((we) => ({
          workout_id: newWorkoutId,
          exercise_id: we.exercise_id,
          sort_order: we.sort_order,
          sets: we.sets,
          reps: we.reps,
          weight_kg: we.weight_kg,
          rest_seconds: we.rest_seconds,
        })),
      );
    }
    await supabase.from('training_days').insert({
      phase_id: phaseId,
      day_number: nextNumber,
      title: `${day.title} (copia)`,
      day_type: day.day_type,
      workout_id: newWorkoutId,
      sort_order: days.length,
    });
    showToast('success', 'Rutina duplicada.');
    await load();
  };

  const openCopyToProgram = async (day: DayWithWorkout) => {
    if (!trainerId) return;
    setCopyTarget(day);
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('trainer_id', trainerId)
      .neq('id', program?.id ?? '')
      .order('name');
    setCopyPrograms((data as ProgramRow[] | null) ?? []);
  };

  const copyRoutineToProgram = async (targetProgram: ProgramRow) => {
    if (!copyTarget || !trainerId) return;
    const day = copyTarget;
    let { data: phaseRows } = await supabase
      .from('training_phases')
      .select('*')
      .eq('program_key', targetProgram.program_key)
      .order('sort_order')
      .limit(1);
    let targetPhase = ((phaseRows as TrainingPhaseRow[] | null) ?? [])[0];
    if (!targetPhase) {
      const { data: created } = await supabase
        .from('training_phases')
        .insert({ program_key: targetProgram.program_key, trainer_id: trainerId, phase_number: 1, name: targetProgram.name, sort_order: 0, is_active: true })
        .select()
        .single();
      targetPhase = created as TrainingPhaseRow;
    }
    const { data: existingDays } = await supabase.from('training_days').select('day_number').eq('phase_id', targetPhase.id);
    const nextNumber = ((existingDays as { day_number: number }[] | null) ?? []).reduce((m, d) => Math.max(m, d.day_number), 0) + 1;

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ trainer_id: trainerId, title: day.title, workout_type: day.day_type, blocks: day.workout?.blocks ?? 1 })
      .select('id')
      .single();
    if (wErr || !workout) { showToast('error', 'No pudimos copiar la rutina.'); return; }
    const newWorkoutId = (workout as { id: string }).id;
    const exercises = day.workout?.exercises ?? [];
    if (exercises.length > 0) {
      await supabase.from('workout_exercises').insert(
        exercises.map((we) => ({
          workout_id: newWorkoutId,
          exercise_id: we.exercise_id,
          sort_order: we.sort_order,
          sets: we.sets,
          reps: we.reps,
          weight_kg: we.weight_kg,
          rest_seconds: we.rest_seconds,
        })),
      );
    }
    await supabase.from('training_days').insert({
      phase_id: targetPhase.id,
      day_number: nextNumber,
      title: day.title,
      day_type: day.day_type,
      workout_id: newWorkoutId,
      sort_order: 0,
    });
    setCopyTarget(null);
    showToast('success', `Rutina copiada a "${targetProgram.name}".`);
  };

  const assignToDay = async (day: DayWithWorkout, weekday: number | null) => {
    await supabase.from('training_days').update({ day_of_week: weekday }).eq('id', day.id);
    setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, day_of_week: weekday } : d)));
    setAssignDayTarget(null);
  };

  const duplicateProgram = async () => {
    if (!program) return;
    const { data: newId, error: cloneErr } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: `${program.name} (copia)`,
      p_client_id: null,
    });
    if (cloneErr || !newId) { showToast('error', 'No pudimos duplicar el programa.'); return; }
    showToast('success', 'Programa duplicado.');
    navigate(`/programs/${newId}`);
  };

  // ── Resumen: total real de ejercicios/sets + distribución muscular real
  // (a partir de exercise.target_muscles), sin gráfico de radar — ver
  // conversación de scope: "puede quedar con data mockeada", acá va con
  // data real pero visualización simple (tabla), no el spider chart de Hevy.
  const summary = useMemo(() => {
    let totalExercises = 0;
    let totalSets = 0;
    const muscleCount = new Map<string, number>();
    for (const day of days) {
      for (const we of day.workout?.exercises ?? []) {
        totalExercises += 1;
        const sets = we.sets ?? 0;
        totalSets += sets;
        for (const muscle of we.exercise?.target_muscles ?? []) {
          muscleCount.set(muscle, (muscleCount.get(muscle) ?? 0) + sets);
        }
      }
    }
    const muscleRows = Array.from(muscleCount.entries()).sort((a, b) => b[1] - a[1]);
    return { totalExercises, totalSets, muscleRows };
  }, [days]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>;
  if (error || !program) return <div><Link to="/programs" className="back-link">← Volver a programas</Link><div className="empty-state"><div className="t">{error ?? 'Programa no encontrado'}</div></div></div>;

  const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number);

  return (
    <div>
      <div className="prog-editor-head">
        <button type="button" className="prog-editor-back" onClick={() => navigate('/programs')} aria-label="Volver a programas">←</button>
        <h1 className="prog-editor-title">Editar programa</h1>
        <button type="button" className="btn secondary sm" onClick={() => void duplicateProgram()}>Duplicar</button>
        <button type="button" className="btn blue sm" onClick={() => setAssignOpen(true)}>Asignar programa</button>
      </div>

      <div className="prog-editor-grid">
        <div>
          <div className="prog-fields-row">
            <div>
              <div className="field-label">Título del programa</div>
              <input
                className="hevy-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => nameDraft.trim() && nameDraft !== program.name && void saveProgramField({ name: nameDraft.trim() })}
              />
            </div>
            <div>
              <div className="field-label">Duración</div>
              <DurationSelect
                value={durationDraft}
                onChange={(next) => {
                  setDurationDraft(next);
                  const n = next ? Number(next) : null;
                  if (n !== program.duration_weeks) void saveProgramField({ duration_weeks: n });
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="field-label">Nota del programa</div>
            <textarea
              className="hevy-input"
              placeholder="Agregá una breve descripción del programa"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => noteDraft !== (program.note ?? '') && void saveProgramField({ note: noteDraft || null })}
            />
          </div>

          <div className="routines-bar">
            <div className="routines-bar-title">Rutinas <span className="count-chip">{sortedDays.length}</span></div>
            <button type="button" className="btn blue sm" onClick={() => void addRoutine()}>
              <PlusIcon size={14} /> Agregar rutina
            </button>
          </div>

          {sortedDays.length === 0 ? (
            <div className="prog-drop">Este programa no tiene rutinas todavía. <button type="button" className="link-blue" onClick={() => void addRoutine()}>Agregar rutina</button></div>
          ) : (
            sortedDays.map((day, index) => (
              <RoutineCard
                key={day.id}
                day={day}
                index={index}
                dragging={draggedDayIndex === index}
                onOpen={() => navigate(`/routines/${day.id}`)}
                onRename={(title) => void renameRoutine(day.id, title)}
                onDuplicate={() => void duplicateRoutine(day)}
                onDelete={() => setDeleteTarget(day)}
                onCopyToProgram={() => void openCopyToProgram(day)}
                onAssignDay={() => setAssignDayTarget(day)}
                onDragStart={(e) => startRoutineDrag(e, index)}
              />
            ))
          )}
        </div>

        <div className="card summary-card">
          <div className="summary-title">Resumen</div>
          <SummaryRow label="Total de ejercicios" value={summary.totalExercises} />
          <SummaryRow label="Total de series" value={summary.totalSets} />

          <div className="msum-head">
            <span className="msum-title">Series por grupo muscular</span>
            <span className="mock-badge" title="Datos de ejemplo — reemplazar por el cálculo real cuando el catálogo tenga el mapeo de músculos.">Datos simulados</span>
          </div>
          <div className="msum-thead">
            <span>Grupo muscular</span>
            <span>Series</span>
          </div>
          {MOCK_MUSCLE_SETS.map(([muscle, sets]) => (
            <div key={muscle} className={`msum-row${sets === 0 ? ' zero' : ''}`}>
              <span className="m">{muscle}</span>
              <span className="s">{sets}</span>
            </div>
          ))}
        </div>
      </div>

      {assignOpen && <AssignProgramModal program={program} onClose={() => setAssignOpen(false)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar rutina"
        message={`¿Eliminar "${deleteTarget?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmDeleteRoutine()}
        onCancel={() => setDeleteTarget(null)}
        danger
      />

      {copyTarget && (
        <div className="invite-qr-backdrop" onClick={() => setCopyTarget(null)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Copiar "{copyTarget.title}" a…</div>
            {copyPrograms.length === 0 ? (
              <p className="muted">No hay otros programas todavía.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {copyPrograms.map((p) => (
                  <button key={p.id} type="button" className="client-row-menu-item" onClick={() => void copyRoutineToProgram(p)}>{p.name}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setCopyTarget(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {assignDayTarget && (
        <div className="invite-qr-backdrop" onClick={() => setAssignDayTarget(null)}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Asignar día — "{assignDayTarget.title}"</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {WEEKDAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  className={`client-row-menu-item${assignDayTarget.day_of_week === i ? ' danger' : ''}`}
                  onClick={() => void assignToDay(assignDayTarget, i)}
                >
                  {name}
                </button>
              ))}
              {assignDayTarget.day_of_week !== null && (
                <button type="button" className="client-row-menu-item" onClick={() => void assignToDay(assignDayTarget, null)}>
                  Quitar día asignado
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn secondary" onClick={() => setAssignDayTarget(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DURATION_OPTIONS = ['', ...Array.from({ length: 52 }, (_, i) => String(i + 1))];

function durationLabel(v: string): string {
  if (!v) return 'Sin límite';
  const n = Number(v);
  return `${n} ${n === 1 ? 'semana' : 'semanas'}`;
}

/** Dropdown custom (no <select> nativo) — look & feel de app.hevycoach.com:
 * trigger con chevron, lista scrolleable con fila activa resaltada. */
function DurationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="dur-select">
      <button type="button" className={`hevy-input dur-select-trigger${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span>{durationLabel(value)}</span>
        <ChevronDownIcon size={16} className="dur-select-chevron" />
      </button>
      {open && (
        <>
          <div className="dur-select-backdrop" onClick={() => setOpen(false)} />
          <div className="dur-select-list">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt || 'unlimited'}
                type="button"
                className={`dur-select-opt${opt === value ? ' active' : ''}`}
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                {durationLabel(opt)}
                {opt === value && <CheckIcon size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{value}</span>
    </div>
  );
}

function RoutineCard({
  day,
  index,
  dragging,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onCopyToProgram,
  onAssignDay,
  onDragStart,
}: {
  day: DayWithWorkout;
  index: number;
  dragging: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyToProgram: () => void;
  onAssignDay: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(day.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const exercises = [...(day.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div
      className={`routine-row${dragging ? ' dragging' : ''}`}
      onClick={onOpen}
      onMouseDown={onDragStart}
      data-routine-index={index}
    >
      <div className="routine-row-head">
        <span className="routine-row-grip" aria-hidden>
          <GripIcon size={16} />
        </span>
        <input
          className="inline-input routine-row-title"
          value={title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== day.title && onRename(title.trim())}
        />
        {day.day_of_week !== null && (
          <span className="day-chip" style={{ flexShrink: 0 }}>{WEEKDAY_NAMES[day.day_of_week]}</span>
        )}
        <CardMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          items={[
            { label: 'Editar rutina', onClick: onOpen },
            { label: 'Duplicar rutina', onClick: onDuplicate },
            { label: 'Copiar rutina a programa', onClick: onCopyToProgram },
            { label: 'Asignar a un día', onClick: onAssignDay },
            { label: 'Eliminar rutina', onClick: onDelete, danger: true },
          ]}
        />
      </div>
      {exercises.length === 0 ? (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>Sin ejercicios — abrí la rutina para agregarlos.</p>
      ) : (
        <div className="routine-row-ex">
          {exercises.map((we) => (
            <div key={we.id}><span className="n">{we.sets ?? 0}×</span> {we.exercise?.name ?? 'Ejercicio'}</div>
          ))}
        </div>
      )}
    </div>
  );
}
