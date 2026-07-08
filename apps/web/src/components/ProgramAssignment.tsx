import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

/** Asignación de un Programa de la Librería a este cliente. Un programa
 * asignado es, por default, la plantilla compartida (edita a TODOS los
 * clientes que la tengan asignada). "Personalizar para este cliente" clona
 * el programa entero (fases/rutinas/ejercicios) en una copia exclusiva de
 * este cliente — a partir de ahí, editarla no toca la plantilla original. */
export function ProgramAssignment({ clientId }: { clientId: string }): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [assignedKey, setAssignedKey] = useState<string | null>(null);
  const [assignedProgram, setAssignedProgram] = useState<ProgramRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectValue, setSelectValue] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  const load = async () => {
    if (!trainerProfile?.id) return;
    setLoading(true);
    const [{ data: templateRows }, { data: clientRow }] = await Promise.all([
      supabase.from('programs').select('*').eq('trainer_id', trainerProfile.id).is('client_id', null).order('name'),
      supabase.from('profiles').select('assigned_program_key').eq('id', clientId).maybeSingle(),
    ]);
    setTemplates((templateRows as ProgramRow[] | null) ?? []);
    const key = (clientRow as { assigned_program_key: string | null } | null)?.assigned_program_key ?? null;
    setAssignedKey(key);
    if (key) {
      const { data: programRow } = await supabase.from('programs').select('*').eq('program_key', key).maybeSingle();
      setAssignedProgram((programRow as ProgramRow | null) ?? null);
    } else {
      setAssignedProgram(null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id, clientId]);

  const assignProgram = async (programKey: string) => {
    if (!programKey || assigning) return;
    setAssigning(true);
    await supabase.from('profiles').update({ assigned_program_key: programKey }).eq('id', clientId);
    setAssigning(false);
    setSelectValue('');
    showToast('success', 'Programa asignado.');
    void load();
  };

  const makeCustom = async () => {
    if (!assignedProgram || customizing) return;
    setCustomizing(true);
    const { data: newId, error } = await supabase.rpc('clone_program', {
      p_program_id: assignedProgram.id,
      p_new_name: assignedProgram.name,
      p_client_id: clientId,
    });
    if (error || !newId) {
      setCustomizing(false);
      showToast('error', 'No pudimos crear la versión personalizada.');
      return;
    }
    const { data: cloned } = await supabase.from('programs').select('program_key').eq('id', newId).maybeSingle();
    const newKey = (cloned as { program_key: string } | null)?.program_key;
    if (newKey) await supabase.from('profiles').update({ assigned_program_key: newKey }).eq('id', clientId);
    setCustomizing(false);
    showToast('success', 'Ahora tiene su propia versión de este programa.');
    void load();
  };

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programa…</p></div>;

  const isCustom = !!assignedProgram?.client_id;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Programa asignado</div>

      {assignedProgram ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{assignedProgram.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {isCustom ? 'Versión personalizada — no afecta la plantilla original' : 'Plantilla compartida'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn secondary sm" onClick={() => navigate(`/programs/${assignedProgram.id}`)}>
                Editar
              </button>
              {!isCustom && (
                <button type="button" className="btn primary sm" disabled={customizing} onClick={() => void makeCustom()}>
                  {customizing ? 'Creando…' : 'Personalizar para este cliente'}
                </button>
              )}
            </div>
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
          {templates.filter((t) => t.program_key !== assignedKey).map((t) => (
            <option key={t.id} value={t.program_key}>{t.name}</option>
          ))}
        </select>
        <button type="button" className="btn secondary sm" disabled={!selectValue || assigning} onClick={() => void assignProgram(selectValue)}>
          Asignar
        </button>
      </div>
    </div>
  );
}
