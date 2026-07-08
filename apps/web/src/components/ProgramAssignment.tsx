import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

/** Asignación de un Programa de la Librería a este cliente. Asignar SIEMPRE
 * clona el programa (fases/rutinas/ejercicios) en una copia exclusiva del
 * cliente — editar esa copia nunca afecta la plantilla original ni a otros
 * clientes que la tengan asignada. */
export function ProgramAssignment({ clientId }: { clientId: string }): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [clientName, setClientName] = useState('');
  const [assignedProgram, setAssignedProgram] = useState<ProgramRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectValue, setSelectValue] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    if (!trainerProfile?.id) return;
    setLoading(true);
    const [{ data: templateRows }, { data: clientRow }] = await Promise.all([
      supabase.from('programs').select('*').eq('trainer_id', trainerProfile.id).is('client_id', null).order('name'),
      supabase.from('profiles').select('full_name, assigned_program_key').eq('id', clientId).maybeSingle(),
    ]);
    setTemplates((templateRows as ProgramRow[] | null) ?? []);
    const client = clientRow as { full_name: string | null; assigned_program_key: string | null } | null;
    setClientName(client?.full_name ?? '');
    const key = client?.assigned_program_key ?? null;
    if (key) {
      const { data: programRow } = await supabase.from('programs').select('*').eq('program_key', key).maybeSingle();
      setAssignedProgram((programRow as ProgramRow | null) ?? null);
    } else {
      setAssignedProgram(null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id, clientId]);

  const assignProgram = async (program: ProgramRow) => {
    if (assigning) return;
    setAssigning(true);
    const cloneName = clientName ? `${program.name} for ${clientName}` : program.name;
    const { data: newId, error } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: cloneName,
      p_client_id: clientId,
    });
    if (error || !newId) {
      setAssigning(false);
      showToast('error', 'No pudimos asignar el programa.');
      return;
    }
    const { data: cloned } = await supabase.from('programs').select('program_key').eq('id', newId).maybeSingle();
    const newKey = (cloned as { program_key: string } | null)?.program_key;
    if (newKey) await supabase.from('profiles').update({ assigned_program_key: newKey }).eq('id', clientId);
    setAssigning(false);
    setSelectValue('');
    showToast('success', 'Programa asignado.');
    void load();
  };

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programa…</p></div>;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Programa asignado</div>

      {assignedProgram ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{assignedProgram.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                Copia individual de este cliente — no afecta la plantilla original
              </div>
            </div>
            <button type="button" className="btn secondary sm" onClick={() => navigate(`/programs/${assignedProgram.id}`)}>
              Editar
            </button>
          </div>
        </div>
      ) : (
        <p className="muted" style={{ margin: '0 0 12px' }}>Este cliente todavía no tiene un programa asignado.</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <select
          className="inline-select"
          style={{ flex: 1 }}
          value={selectValue}
          onChange={(e) => setSelectValue(e.target.value)}
        >
          <option value="">{assignedProgram ? 'Cambiar a otro programa…' : 'Elegí un programa…'}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn secondary sm"
          disabled={!selectValue || assigning}
          onClick={() => {
            const program = templates.find((t) => t.id === selectValue);
            if (program) void assignProgram(program);
          }}
        >
          {assigning ? 'Asignando…' : 'Asignar'}
        </button>
      </div>
    </div>
  );
}
