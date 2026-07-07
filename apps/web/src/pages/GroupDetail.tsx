import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CommunityMemberRow, CommunityRow, ProfileRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { uploadCommunityAvatar } from '@/lib/communityImage';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { FullScreenLoader } from '@/components/ui';
import { GroupAvatar, UserAvatar } from '@/components/UserAvatar';
import { MessageIcon, PlusIcon, TrashIcon } from '@/components/icons';

type MemberWithProfile = CommunityMemberRow & {
  full_name: string | null;
  avatar_url: string | null;
};

type AvailableClient = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;

export function GroupDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { showToast } = useToast();
  const trainerId = session?.user.id;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableClient[]>([]);
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !trainerId) return;
    setLoading(true);
    const [{ data: comm, error: commError }, { data: mem }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', id).eq('trainer_id', trainerId).maybeSingle(),
      supabase
        .from('community_members')
        .select('*')
        .eq('community_id', id)
        .order('joined_at'),
    ]);
    if (commError || !comm) {
      setCommunity(null);
    } else {
      setCommunity(comm as CommunityRow);
      const memberRows = (mem as CommunityMemberRow[] | null) ?? [];
      const userIds = memberRows.map((m) => m.user_id);
      let profileMap = new Map<string, Pick<ProfileRow, 'full_name' | 'avatar_url'>>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        profileMap = new Map(
          ((profiles as (Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>)[] | null) ?? []).map((p) => [
            p.id,
            { full_name: p.full_name, avatar_url: p.avatar_url },
          ]),
        );
      }
      setMembers(
        memberRows.map((m) => ({
          ...m,
          full_name: profileMap.get(m.user_id)?.full_name ?? null,
          avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        })),
      );
    }
    setLoading(false);
  }, [id, trainerId]);

  useEffect(() => { void load(); }, [load]);

  const loadAvailable = useCallback(async () => {
    if (!trainerId || !id) return;
    const memberIds = new Set(members.map((m) => m.user_id));
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('trainer_id', trainerId)
      .eq('client_status', 'active');
    setAvailable(((data as AvailableClient[] | null) ?? []).filter((s) => !memberIds.has(s.id)));
  }, [trainerId, id, members]);

  useEffect(() => {
    if (addOpen) void loadAvailable();
  }, [addOpen, loadAvailable]);

  const openEdit = () => {
    if (!community) return;
    setEditName(community.name);
    setEditDescription(community.description ?? '');
    setEditImage(null);
    setEditPreview(null);
    setEditOpen(true);
  };

  const onPickEditImage = (file: File | null) => {
    setEditImage(file);
    if (editPreview) URL.revokeObjectURL(editPreview);
    setEditPreview(file ? URL.createObjectURL(file) : null);
  };

  const onSaveEdit = async () => {
    if (!id || !trainerId || !community || saving) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('error', 'El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = community.avatar_url;
      if (editImage) {
        avatarUrl = await uploadCommunityAvatar(trainerId, id, editImage);
      }
      const { error } = await supabase
        .from('communities')
        .update({
          name: trimmed,
          description: editDescription.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('id', id);
      if (error) throw error;
      showToast('success', 'Grupo actualizado.');
      setEditOpen(false);
      void load();
    } catch {
      showToast('error', 'No se pudo guardar los cambios.');
    }
    setSaving(false);
  };

  const onQuickImageChange = async (file: File | null) => {
    if (!file || !id || !trainerId || uploadingImage) return;
    setUploadingImage(true);
    try {
      const avatarUrl = await uploadCommunityAvatar(trainerId, id, file);
      const { error } = await supabase.from('communities').update({ avatar_url: avatarUrl }).eq('id', id);
      if (error) throw error;
      showToast('success', 'Imagen actualizada.');
      void load();
    } catch {
      showToast('error', 'No se pudo subir la imagen.');
    }
    setUploadingImage(false);
  };

  const onDeleteGroup = async () => {
    if (!id || !community || deleting) return;
    if (!window.confirm(`¿Eliminar el grupo "${community.name}"? Se borrarán los mensajes y miembros.`)) return;
    setDeleting(true);
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) {
      showToast('error', 'No se pudo eliminar el grupo.');
      setDeleting(false);
      return;
    }
    showToast('success', 'Grupo eliminado.');
    navigate('/groups');
  };

  const onAddMembers = async () => {
    if (!id || selectedAdd.size === 0) return;
    const rows = [...selectedAdd].map((userId) => ({ community_id: id, user_id: userId }));
    const { error } = await supabase.from('community_members').insert(rows);
    if (error) {
      showToast('error', 'No se pudieron agregar miembros.');
      return;
    }
    showToast('success', 'Miembros agregados.');
    setAddOpen(false);
    setSelectedAdd(new Set());
    void load();
  };

  const onRemoveMember = async (userId: string, name: string | null) => {
    if (!id || !window.confirm(`¿Sacar a ${name ?? 'este alumno'} del grupo?`)) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', id)
      .eq('user_id', userId);
    if (error) showToast('error', 'No se pudo quitar al miembro.');
    else void load();
  };

  if (loading) return <FullScreenLoader />;
  if (!community) {
    return (
      <div className="card page-empty">
        <h2>Grupo no encontrado</h2>
        <Link to="/groups" className="btn secondary">Volver a grupos</Link>
      </div>
    );
  }

  return (
    <div className="gd-page">
      <Link to="/groups" className="back-link">← Grupos</Link>

      <div className="gd-hero card">
        <div className="gd-hero-top">
          <div className="gd-identity">
            <button
              type="button"
              className="gd-avatar-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              title="Cambiar imagen del grupo"
            >
              <GroupAvatar name={community.name} url={community.avatar_url} size="lg" className="gd-avatar" />
              <span className="gd-avatar-overlay">{uploadingImage ? '…' : 'Cambiar'}</span>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onQuickImageChange(e.target.files?.[0] ?? null)}
            />
            <div className="gd-header-info">
              <h1 className="gd-name">{community.name}</h1>
              {community.description ? <p className="gd-desc">{community.description}</p> : null}
              <p className="gd-meta">
                {members.length} miembro{members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="gd-actions">
            <button type="button" className="btn secondary gd-action" onClick={openEdit}>
              Editar
            </button>
            <button type="button" className="btn secondary gd-action" onClick={() => setAddOpen(true)}>
              <PlusIcon size={15} /> Agregar alumnos
            </button>
            <button
              type="button"
              className="btn gd-action"
              onClick={() => navigate(`/messages?group=${community.id}`)}
            >
              <MessageIcon size={15} /> Abrir chat
            </button>
          </div>
        </div>
      </div>

      <div className="card gd-members">
        <div className="gd-members-hd">
          <span>Miembros</span>
          <span className="gd-members-count">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <p className="gd-members-empty">Todavía no hay alumnos en este grupo.</p>
        ) : (
          <div className="gd-member-list">
            {members.map((m) => (
              <div key={m.id} className="gd-member-row">
                <UserAvatar name={m.full_name} url={m.avatar_url} size="sm" />
                <span className="gd-member-name">{m.full_name ?? 'Alumno'}</span>
                <button
                  type="button"
                  className="gd-member-remove"
                  onClick={() => void onRemoveMember(m.user_id, m.full_name)}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gd-footer">
        <button
          type="button"
          className="btn danger-outline gd-delete"
          disabled={deleting}
          onClick={() => void onDeleteGroup()}
        >
          <TrashIcon size={15} />
          {deleting ? 'Eliminando…' : 'Eliminar grupo'}
        </button>
      </div>

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
            <h2 style={{ marginTop: 0 }}>Agregar alumnos</h2>
            <div className="gd-picker-list">
              {available.length === 0 ? (
                <p className="muted">Todos tus alumnos activos ya están en el grupo.</p>
              ) : (
                available.map((s) => (
                  <label key={s.id} className="gd-picker-row">
                    <input
                      type="checkbox"
                      checked={selectedAdd.has(s.id)}
                      onChange={() => {
                        setSelectedAdd((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                    />
                    <UserAvatar name={s.full_name} url={s.avatar_url} size="sm" />
                    <span>{s.full_name ?? 'Alumno'}</span>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button type="button" className="btn" disabled={selectedAdd.size === 0} onClick={() => void onAddMembers()}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-backdrop" onClick={() => !saving && setEditOpen(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '100%' }}>
            <h2 style={{ marginTop: 0 }}>Editar grupo</h2>
            <label className="field-label">Imagen</label>
            <div className="gd-edit-image">
              <GroupAvatar name={editName || community.name} url={editPreview ?? community.avatar_url} size="lg" className="gd-avatar" />
              <label className="btn secondary" style={{ cursor: 'pointer' }}>
                Elegir imagen
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onPickEditImage(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <label className="field-label">Nombre</label>
            <input className="field-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label className="field-label" style={{ marginTop: 12 }}>Descripción (opcional)</label>
            <input className="field-input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" disabled={saving} onClick={() => setEditOpen(false)}>Cancelar</button>
              <button type="button" className="btn" disabled={saving || !editName.trim()} onClick={() => void onSaveEdit()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .gd-page { max-width: 880px; }
        .gd-hero { padding: 0; margin-bottom: 16px; overflow: hidden; }
        .gd-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 24px;
          flex-wrap: wrap;
        }
        .gd-identity { display: flex; align-items: center; gap: 18px; min-width: 0; flex: 1; }
        .gd-avatar-btn {
          position: relative;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: 14px;
          flex-shrink: 0;
        }
        .gd-avatar-btn:disabled { cursor: wait; opacity: 0.7; }
        .gd-avatar, .gd-avatar-fallback {
          width: 72px !important;
          height: 72px !important;
          border-radius: 14px !important;
          font-size: 22px !important;
        }
        .gd-avatar-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 6px;
          border-radius: 14px;
          background: linear-gradient(to top, rgba(0,0,0,.55), transparent 55%);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 140ms ease;
        }
        .gd-avatar-btn:hover .gd-avatar-overlay { opacity: 1; }
        .gd-name {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.2;
          color: var(--text-primary);
        }
        .gd-desc {
          margin: 6px 0 0;
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .gd-meta {
          margin: 10px 0 0;
          font-size: 13px;
          color: var(--text-tertiary);
        }
        .gd-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .gd-action { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
        .gd-action svg { opacity: 0.85; }
        .gd-members { padding: 0; overflow: hidden; }
        .gd-members-hd {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          font-weight: 600;
          font-size: 14px;
        }
        .gd-members-count {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-tertiary);
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 2px 9px;
        }
        .gd-members-empty { padding: 28px 20px; margin: 0; color: var(--text-tertiary); font-size: 14px; }
        .gd-member-list { display: flex; flex-direction: column; }
        .gd-member-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--border);
          transition: background 120ms ease;
        }
        .gd-member-row:last-child { border-bottom: none; }
        .gd-member-row:hover { background: var(--surface-elevated); }
        .gd-member-name { flex: 1; font-weight: 600; font-size: 14px; min-width: 0; }
        .gd-member-remove {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-tertiary);
          padding: 6px 10px;
          border-radius: 8px;
          transition: color 120ms ease, background 120ms ease;
        }
        .gd-member-remove:hover { color: #b91c1c; background: #fef2f2; }
        .gd-footer {
          margin-top: 20px;
          padding-top: 4px;
          border-top: 1px solid var(--border);
        }
        .gd-delete { font-size: 13px; padding: 9px 14px; }
        .gd-picker-list { max-height: 260px; overflow-y: auto; }
        .gd-picker-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 4px;
          cursor: pointer;
          border-radius: 10px;
        }
        .gd-picker-row:hover { background: var(--surface-elevated); }
        .gd-edit-image { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        @media (max-width: 640px) {
          .gd-hero-top { padding: 18px; }
          .gd-actions { width: 100%; justify-content: stretch; }
          .gd-action { flex: 1; }
        }
      `}</style>
    </div>
  );
}

export default GroupDetailPage;
