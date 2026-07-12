import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalAssignmentRow, GoalType, GoalUnit, ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { fmtEsAr as fmt, parseIsoDateLocal, resolveActiveProgramKey } from '@/lib/activeProgram';

const GOAL_PRESETS: { type: GoalType; unit: GoalUnit; label: string; defaultTarget: number }[] = [
  { type: 'hydration', label: 'Hidratación', unit: 'ml', defaultTarget: 3000 },
  { type: 'steps', label: 'Pasos', unit: 'steps', defaultTarget: 10000 },
  { type: 'training', label: 'Entrenar hoy', unit: 'boolean', defaultTarget: 1 },
  { type: 'meals', label: 'Comidas registradas', unit: 'meals', defaultTarget: 3 },
];

interface Props {
  clientId: string;
  assignedProgramKey: string | null;
  defaultProgramKey: string;
  onProgramKeyChange: (key: string | null) => void;
}

export function ClientCoachPanel({
  clientId,
}: Props): React.JSX.Element {
  const { session } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const trainerId = session?.user.id;

  const [activeProgram, setActiveProgram] = useState<ProgramRow | null>(null);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [assignments, setAssignments] = useState<GoalAssignmentRow[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [addingGoal, setAddingGoal] = useState<GoalType | null>(null);

  // El "activo hoy" se calcula EN VIVO a partir de los programas del
  // cliente (misma lógica que resolve_active_program_key en la base) en vez
  // de depender de profiles.assigned_program_key, que solo se recalcula
  // cuando se escribe en `programs` — si un programa agendado termina y
  // nadie edita nada ese día, la columna cacheada queda vieja.
  useEffect(() => {
    setLoadingProgram(true);
    void (async () => {
      const { data } = await supabase.from('programs').select('*').eq('client_id', clientId);
      const programs = (data as ProgramRow[] | null) ?? [];
      const activeKey = resolveActiveProgramKey(programs);
      setActiveProgram(programs.find((p) => p.program_key === activeKey) ?? null);
      setLoadingProgram(false);
    })();
  }, [clientId]);

  const loadAssignments = useCallback(async () => {
    setLoadingGoals(true);
    const { data } = await supabase
      .from('goal_assignments')
      .select('*')
      .eq('user_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAssignments((data as GoalAssignmentRow[] | null) ?? []);
    setLoadingGoals(false);
  }, [clientId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const addGoal = async (preset: (typeof GOAL_PRESETS)[number]) => {
    if (!trainerId || addingGoal) return;
    setAddingGoal(preset.type);
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const { error } = await supabase.from('goal_assignments').insert({
      user_id: clientId,
      assigned_by: trainerId,
      title: preset.label,
      goal_type: preset.type,
      target_value: preset.defaultTarget,
      target_unit: preset.unit,
      start_date: today,
      end_date: end.toISOString().slice(0, 10),
      is_active: true,
    });
    setAddingGoal(null);
    if (error) {
      showToast('error', 'No pudimos asignar la meta.');
      return;
    }
    showToast('success', 'Meta asignada.');
    void loadAssignments();
  };

  const deactivateGoal = async (id: string) => {
    const { error } = await supabase.from('goal_assignments').update({ is_active: false }).eq('id', id);
    if (error) {
      showToast('error', 'No pudimos quitar la meta.');
      return;
    }
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    showToast('success', 'Meta desactivada.');
  };

  const weekInfo = (() => {
    if (!activeProgram?.start_date || !activeProgram.duration_weeks) return null;
    const start = parseIsoDateLocal(activeProgram.start_date);
    const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
    const week = Math.min(activeProgram.duration_weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
    return `Semana ${week} de ${activeProgram.duration_weeks}`;
  })();

  return (
    <div className="card sd-panel" style={{ marginTop: 16 }}>
      <div className="sd-panel-head">
        <div className="section-title">Programa de entrenamiento</div>
        <div className="sd-panel-sub">Programa activo hoy y metas diarias del alumno</div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        {loadingProgram ? (
          <p className="muted" style={{ margin: 0 }}>Cargando…</p>
        ) : activeProgram ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/programs/${activeProgram.id}`)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', padding: '4px 0' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{activeProgram.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {activeProgram.start_date && activeProgram.duration_weeks
                  ? `Desde ${fmt(parseIsoDateLocal(activeProgram.start_date))}${weekInfo ? ` · ${weekInfo}` : ''}`
                  : 'Sin fecha — ilimitado'}
              </div>
            </div>
            <button type="button" className="btn secondary sm" onClick={(e) => { e.stopPropagation(); navigate(`/programs/${activeProgram.id}`); }}>
              Editar
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Este cliente no tiene un programa activo para hoy.</p>
        )}
      </div>

      <div>
        <div className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>Metas asignadas</div>
        {loadingGoals ? (
          <p className="muted" style={{ margin: 0 }}>Cargando metas…</p>
        ) : assignments.length === 0 ? (
          <p className="muted" style={{ margin: '0 0 10px' }}>Sin metas activas del coach.</p>
        ) : (
          <ul className="sd-goal-assign-list">
            {assignments.map((a) => (
              <li key={a.id} className="sd-goal-assign-item">
                <span>
                  <strong>{a.title}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {a.target_value} {a.target_unit} · hasta {a.end_date}
                  </span>
                </span>
                <button type="button" className="icon-btn sm" onClick={() => void deactivateGoal(a.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sd-goal-preset-row">
          {GOAL_PRESETS.map((preset) => (
            <button
              key={preset.type}
              type="button"
              className="btn secondary sm"
              disabled={addingGoal === preset.type}
              onClick={() => void addGoal(preset)}
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
