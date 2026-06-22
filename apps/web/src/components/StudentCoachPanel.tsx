import { useCallback, useEffect, useState } from 'react';
import type { GoalAssignmentRow, GoalType, GoalUnit } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

const GOAL_PRESETS: { type: GoalType; unit: GoalUnit; label: string; defaultTarget: number }[] = [
  { type: 'hydration', label: 'Hidratación', unit: 'ml', defaultTarget: 3000 },
  { type: 'steps', label: 'Pasos', unit: 'steps', defaultTarget: 10000 },
  { type: 'training', label: 'Entrenar hoy', unit: 'boolean', defaultTarget: 1 },
  { type: 'meals', label: 'Comidas registradas', unit: 'meals', defaultTarget: 3 },
];

interface Props {
  studentId: string;
  assignedProgramKey: string | null;
  defaultProgramKey: string;
  onProgramKeyChange: (key: string | null) => void;
}

export function StudentCoachPanel({
  studentId,
  assignedProgramKey,
  defaultProgramKey,
  onProgramKeyChange,
}: Props): React.JSX.Element {
  const { session } = useAuth();
  const { showToast } = useToast();
  const trainerId = session?.user.id;

  const [programKeys, setProgramKeys] = useState<string[]>([]);
  const [savingProgram, setSavingProgram] = useState(false);
  const [assignments, setAssignments] = useState<GoalAssignmentRow[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [addingGoal, setAddingGoal] = useState<GoalType | null>(null);

  useEffect(() => {
    if (!trainerId) return;
    void (async () => {
      const { data } = await supabase
        .from('training_phases')
        .select('program_key')
        .eq('trainer_id', trainerId);
      const keys = [...new Set(((data as { program_key: string | null }[] | null) ?? []).map((r) => r.program_key).filter(Boolean))] as string[];
      setProgramKeys(keys.sort());
    })();
  }, [trainerId]);

  const loadAssignments = useCallback(async () => {
    setLoadingGoals(true);
    const { data } = await supabase
      .from('goal_assignments')
      .select('*')
      .eq('user_id', studentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAssignments((data as GoalAssignmentRow[] | null) ?? []);
    setLoadingGoals(false);
  }, [studentId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const saveProgramKey = async (value: string) => {
    const next = value === defaultProgramKey ? null : value;
    setSavingProgram(true);
    const { error } = await supabase
      .from('profiles')
      .update({ assigned_program_key: next })
      .eq('id', studentId);
    setSavingProgram(false);
    if (error) {
      showToast('error', 'No pudimos asignar el programa.');
      return;
    }
    onProgramKeyChange(next);
    showToast('success', 'Programa actualizado.');
  };

  const addGoal = async (preset: (typeof GOAL_PRESETS)[number]) => {
    if (!trainerId || addingGoal) return;
    setAddingGoal(preset.type);
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const { error } = await supabase.from('goal_assignments').insert({
      user_id: studentId,
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

  const effectiveKey = assignedProgramKey ?? defaultProgramKey;

  return (
    <div className="card sd-panel" style={{ marginTop: 16 }}>
      <div className="sd-panel-head">
        <div className="section-title">Asignación del coach</div>
        <div className="sd-panel-sub">Programa y metas diarias del alumno</div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Programa de entrenamiento</label>
        <select
          className="inline-select"
          value={effectiveKey}
          disabled={savingProgram}
          onChange={(e) => void saveProgramKey(e.target.value)}
        >
          {[defaultProgramKey, ...programKeys.filter((k) => k !== defaultProgramKey)].map((key) => (
            <option key={key} value={key}>
              {key === defaultProgramKey ? `${key} (predeterminado)` : key}
            </option>
          ))}
        </select>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
          {assignedProgramKey
            ? `Asignado: ${assignedProgramKey}`
            : `Usa el programa predeterminado del branding (${defaultProgramKey}).`}
        </p>
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
