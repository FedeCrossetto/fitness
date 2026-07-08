import { useEffect, useState } from 'react';
import type { ProfileRow, ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';

type ClientOption = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'assigned_program_key'>;

/** Asigna un programa de la librería (plantilla compartida) a uno o más
 * clientes de una — equivalente a "Copy Program to Clients" de Hevy. Look &
 * feel: app.hevycoach.com/programs (kebab por programa). */
export function AssignProgramModal({
  program,
  onClose,
}: {
  program: ProgramRow;
  onClose: () => void;
}): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trainerProfile?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, assigned_program_key')
        .eq('trainer_id', trainerProfile.id)
        .order('full_name');
      setClients((data as ClientOption[] | null) ?? []);
      setLoading(false);
    })();
  }, [trainerProfile?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const assign = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    await Promise.all(
      Array.from(selected).map((id) =>
        supabase.from('profiles').update({ assigned_program_key: program.program_key }).eq('id', id),
      ),
    );
    setSaving(false);
    showToast('success', `Programa asignado a ${selected.size} cliente${selected.size === 1 ? '' : 's'}.`);
    onClose();
  };

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Asignar "{program.name}"</div>
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 16px' }}>
          Elegí a quién asignarle esta plantilla compartida.
        </p>
        {loading ? (
          <p className="muted">Cargando clientes…</p>
        ) : clients.length === 0 ? (
          <p className="muted">Todavía no tenés clientes.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clients.map((c) => {
              const resolved = resolveAvatarUrl(c.avatar_url);
              const alreadyThis = c.assigned_program_key === program.program_key;
              return (
                <label key={c.id} className="client-row-menu-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    style={{ marginRight: 4 }}
                  />
                  {resolved ? (
                    <span className="avatar sm" style={{ padding: 0, overflow: 'hidden' }}>
                      <img src={resolved} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    </span>
                  ) : (
                    <span className="avatar sm">{initials(c.full_name)}</span>
                  )}
                  <span style={{ flex: 1 }}>{c.full_name ?? 'Alumno'}</span>
                  {alreadyThis ? <span className="muted" style={{ fontSize: 11 }}>Ya asignado</span> : null}
                </label>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={selected.size === 0 || saving} onClick={() => void assign()}>
            {saving ? 'Asignando…' : `Asignar${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
