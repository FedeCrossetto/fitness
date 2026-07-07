import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommunityRow, ProfileRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { ErrorState, LoadingRows } from '@/components/ui';
import { GroupAvatar, UserAvatar } from '@/components/UserAvatar';
import { uploadCommunityAvatar } from '@/lib/communityImage';
import { GroupsIcon, PlusIcon, SearchIcon } from '@/components/icons';

type Client = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'> & { client_status: 'pending' | 'active' };

interface CommunityWithCount extends CommunityRow {
  member_count: number;
}

export function GroupsPage(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const trainerId = session?.user.id;

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const { data: groups, loading, error, refetch } = useSupabaseQuery<CommunityWithCount[]>(
    async () => {
      const { data, error: fetchError } = await supabase
        .from('communities')
        .select('*')
        .eq('trainer_id', trainerId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      const rows = (data as CommunityRow[] | null) ?? [];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      const { data: members } = await supabase
        .from('community_members')
        .select('community_id')
        .in('community_id', ids);

      const countMap = new Map<string, number>();
      for (const m of members ?? []) {
        countMap.set(m.community_id, (countMap.get(m.community_id) ?? 0) + 1);
      }

      return rows.map((row) => ({
        ...row,
        member_count: countMap.get(row.id) ?? 0,
      }));
    },
    [trainerId],
  );

  const loadClients = useCallback(async () => {
    if (!trainerId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, client_status')
      .eq('trainer_id', trainerId)
      .eq('client_status', 'active')
      .order('full_name');
    setClients((data as Client[] | null) ?? []);
  }, [trainerId]);

  useEffect(() => {
    if (createOpen) void loadClients();
  }, [createOpen, loadClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups ?? [];
    return (groups ?? []).filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const toggleClient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !trainerId || creating) return;
    if (selectedIds.size === 0) {
      showToast('error', 'Elegí al menos un alumno.');
      return;
    }
    setCreating(true);
    const { data: community, error: createError } = await supabase
      .from('communities')
      .insert({ trainer_id: trainerId, name: trimmed, description: description.trim() || null })
      .select()
      .single();
    if (createError || !community) {
      showToast('error', 'No se pudo crear el grupo.');
      setCreating(false);
      return;
    }
    const memberRows = [...selectedIds].map((userId) => ({
      community_id: (community as CommunityRow).id,
      user_id: userId,
    }));
    const { error: membersError } = await supabase.from('community_members').insert(memberRows);
    if (membersError) {
      showToast('error', 'Grupo creado pero falló agregar miembros.');
    } else {
      const communityId = (community as CommunityRow).id;
      if (createImage) {
        try {
          const avatarUrl = await uploadCommunityAvatar(trainerId, communityId, createImage);
          await supabase.from('communities').update({ avatar_url: avatarUrl }).eq('id', communityId);
        } catch {
          showToast('error', 'Grupo creado pero falló subir la imagen.');
        }
      }
      await supabase.from('community_messages').insert({
        community_id: communityId,
        sender_id: trainerId,
        content: `¡Bienvenidos a ${trimmed}! Este es el chat del grupo.`,
        kind: 'system',
      });
      showToast('success', 'Grupo creado.');
      setCreateOpen(false);
      setName('');
      setDescription('');
      setSelectedIds(new Set());
      setCreateImage(null);
      if (createImagePreview) URL.revokeObjectURL(createImagePreview);
      setCreateImagePreview(null);
      void refetch();
      navigate(`/messages?group=${communityId}`);
    }
    setCreating(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Grupos</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setCreateOpen(true)}>
          <PlusIcon size={15} /> Nuevo grupo
        </button>
      </div>
      <p className="page-sub">Creá comunidades con chat grupal y elegí qué alumnos participan.</p>

      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <div className="search-field">
          <SearchIcon size={14} />
          <input placeholder="Buscar grupo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingRows rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <div className="card page-empty">
          <div className="page-empty-ico"><GroupsIcon size={24} /></div>
          <h2>{search ? 'Sin resultados' : 'Todavía no tenés grupos'}</h2>
          <p>
            {search
              ? 'Probá con otro nombre.'
              : 'Creá un grupo, elegí alumnos y empezá a chatear en comunidad.'}
          </p>
          {!search && (
            <button className="btn" onClick={() => setCreateOpen(true)}>Crear grupo</button>
          )}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((g) => (
            <div
              key={g.id}
              className="card"
              style={{ cursor: 'pointer', marginBottom: 0 }}
              onClick={() => navigate(`/groups/${g.id}`)}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <GroupAvatar name={g.name} url={g.avatar_url} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 16 }}>{g.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                    {g.member_count} miembro{g.member_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              {g.description ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {g.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="modal-backdrop" onClick={() => !creating && setCreateOpen(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '100%' }}>
            <h2 style={{ marginTop: 0 }}>Nuevo grupo</h2>
            <label className="field-label">Nombre</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Grupo mañana" />
            <label className="field-label" style={{ marginTop: 12 }}>Descripción (opcional)</label>
            <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Reto de junio, check-ins diarios…" />
            <label className="field-label" style={{ marginTop: 16 }}>Imagen (opcional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <GroupAvatar name={name || 'Grupo'} url={createImagePreview} size="md" />
              <label className="btn secondary" style={{ cursor: 'pointer' }}>
                Elegir imagen
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setCreateImage(file);
                    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
                    setCreateImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
            </div>
            <label className="field-label" style={{ marginTop: 16 }}>Alumnos</label>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
              {clients.length === 0 ? (
                <p className="muted" style={{ margin: 8 }}>No hay alumnos activos.</p>
              ) : (
                clients.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleClient(s.id)} />
                    <UserAvatar name={s.full_name} url={s.avatar_url} size="sm" />
                    <span>{s.full_name ?? 'Alumno'}</span>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn secondary" disabled={creating} onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button className="btn" disabled={creating || !name.trim()} onClick={() => void onCreate()}>
                {creating ? 'Creando…' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
