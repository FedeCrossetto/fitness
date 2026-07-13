import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';

function fmtLong(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

interface Props {
  clientId: string;
  fullName: string | null;
  phone: string | null;
  clientStatus: 'active' | 'pending';
  createdAt: string;
  onSaved: (patch: { full_name?: string; phone?: string }) => void;
}

export function ClientSettingsPanel({ clientId, fullName, phone, clientStatus, createdAt, onSaved }: Props): React.JSX.Element {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(fullName ?? '');
  const [phoneDraft, setPhoneDraft] = useState(phone ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc('get_client_email', { p_client: clientId });
      setEmail((data as string | null) ?? null);
    })();
  }, [clientId]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === (fullName ?? '')) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ full_name: trimmed }).eq('id', clientId);
    setSavingName(false);
    if (error) { showToast('error', 'No pudimos guardar el nombre.'); return; }
    onSaved({ full_name: trimmed });
    showToast('success', 'Nombre actualizado.');
  };

  const savePhone = async () => {
    const trimmed = phoneDraft.trim();
    if (trimmed === (phone ?? '')) return;
    setSavingPhone(true);
    const { error } = await supabase.from('profiles').update({ phone: trimmed || null }).eq('id', clientId);
    setSavingPhone(false);
    if (error) { showToast('error', 'No pudimos guardar el teléfono.'); return; }
    onSaved({ phone: trimmed });
    showToast('success', 'Teléfono actualizado.');
  };

  return (
    <div className="cfg-layout">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 14 }}>Perfil</div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Nombre del cliente</label>
          <input className="inline-select" style={{ width: '100%' }} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => void saveName()} disabled={savingName} />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Teléfono</label>
          <input className="inline-select" style={{ width: '100%' }} value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} onBlur={() => void savePhone()} disabled={savingPhone} placeholder="+54 9 11…" />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="inline-select" style={{ width: '100%' }} value={email ?? '—'} disabled readOnly />
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>Estado</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className={`badge${clientStatus === 'active' ? ' active' : ' amber'}`}>
            <span className="dot" />{clientStatus === 'active' ? 'Activo' : 'Pendiente'}
          </span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Cliente desde {fmtLong(createdAt)}</p>
      </div>

      <div className="card" style={{ borderColor: 'rgba(220,38,38,0.25)' }}>
        <div className="section-title" style={{ marginBottom: 6, color: 'var(--bad)' }}>Zona de peligro</div>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          Eliminar la cuenta de este cliente es permanente y borra todo su historial. Esta acción se hace desde el listado de clientes, con confirmación explícita.
        </p>
        <button type="button" className="btn danger-outline sm" onClick={() => navigate('/clients')}>Ir al listado de clientes</button>
      </div>

      <style>{`
        .cfg-layout { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
      `}</style>
    </div>
  );
}
