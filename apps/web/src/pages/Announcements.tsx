import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AnnouncementRow,
  AnnouncementTargetType,
  CommunityRow,
  ProfileRow,
} from '@reset-fitness/shared/types/database';
import { i } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { FullScreenLoader } from '@/components/ui';
import { MegaphoneIcon, PlusIcon } from '@/components/icons';
import { UserAvatar } from '@/components/UserAvatar';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnnouncementsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, language } = useTranslation();
  const { showToast } = useToast();
  const ap = t.web.announcements_page;
  const trainerId = session?.user.id;

  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<CommunityRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<AnnouncementTargetType>('all_clients');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [sendAtLocal, setSendAtLocal] = useState(() => toLocalDatetimeValue(new Date()));

  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s.full_name])), [students]);

  const loadRows = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.message.includes('announcements')) {
        setDbMissing(true);
      }
      setRows([]);
      setLoading(false);
      return;
    }

    setDbMissing(false);
    setRows((data as AnnouncementRow[] | null) ?? []);
    setLoading(false);
  }, [trainerId]);

  const loadOptions = useCallback(async () => {
    if (!trainerId) return;
    const [{ data: comms }, { data: clients }] = await Promise.all([
      supabase.from('communities').select('*').eq('trainer_id', trainerId).eq('is_active', true).order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('trainer_id', trainerId)
        .eq('client_status', 'active')
        .order('full_name'),
    ]);
    setGroups((comms as CommunityRow[] | null) ?? []);
    setStudents((clients as Student[] | null) ?? []);
  }, [trainerId]);

  useEffect(() => {
    if (!trainerId) return;
    void loadOptions();
    void (async () => {
      await supabase.rpc('process_due_announcements');
      await loadRows();
    })();
  }, [trainerId, loadRows, loadOptions]);

  const openModal = () => {
    setTitle('');
    setContent('');
    setTargetType('all_clients');
    setSelectedIds(new Set());
    setSendMode('now');
    setSendAtLocal(toLocalDatetimeValue(new Date()));
    void loadOptions();
    setModalOpen(true);
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const targetLabel = (row: AnnouncementRow): string => {
    if (row.target_type === 'all_clients') return ap.target_all_label;
    if (row.target_type === 'groups') {
      const names = row.target_ids.map((id) => groupMap.get(id)).filter(Boolean);
      if (names.length > 0) return names.join(', ');
      return i(ap.target_groups_n, { n: row.target_ids.length });
    }
    const names = row.target_ids.map((id) => studentMap.get(id)).filter(Boolean);
    if (names.length > 0) return names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');
    return i(ap.target_clients_n, { n: row.target_ids.length });
  };

  const statusLabel = (status: AnnouncementRow['status']): string => {
    switch (status) {
      case 'scheduled': return ap.status_scheduled;
      case 'sent': return ap.status_sent;
      case 'failed': return ap.status_failed;
      case 'cancelled': return ap.status_cancelled;
      default: return status;
    }
  };

  const saveAnnouncement = async () => {
    if (!trainerId || saving) return;
    const trimmed = content.trim();
    if (!trimmed) {
      showToast('error', ap.content_required);
      return;
    }
    if (targetType !== 'all_clients' && selectedIds.size === 0) {
      showToast('error', ap.target_required);
      return;
    }

    const sendAt = sendMode === 'now' ? new Date().toISOString() : new Date(sendAtLocal).toISOString();
    setSaving(true);

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        trainer_id: trainerId,
        title: title.trim() || null,
        content: trimmed,
        target_type: targetType,
        target_ids: targetType === 'all_clients' ? [] : [...selectedIds],
        send_at: sendAt,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error || !data) {
      setSaving(false);
      if (error?.code === '42P01') setDbMissing(true);
      showToast('error', ap.create_error);
      return;
    }

    const row = data as AnnouncementRow;
    const dueNow = new Date(sendAt).getTime() <= Date.now();

    if (dueNow) {
      const { data: delivered, error: deliverError } = await supabase.rpc('deliver_announcement', {
        p_announcement_id: row.id,
      });
      setSaving(false);
      if (deliverError || !delivered) {
        showToast('error', ap.create_error);
      } else {
        showToast('success', ap.sent_ok);
      }
    } else {
      setSaving(false);
      showToast('success', ap.scheduled_ok);
    }

    setModalOpen(false);
    void loadRows();
  };

  const cancelAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'scheduled');
    if (error) {
      showToast('error', ap.cancel_error);
      return;
    }
    showToast('success', ap.cancel_ok);
    void loadRows();
  };

  if (loading && rows.length === 0 && !dbMissing) {
    return <FullScreenLoader />;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{ap.title}</h1>
        <button type="button" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openModal}>
          <PlusIcon size={15} /> {ap.new}
        </button>
      </div>
      <p className="page-sub">{ap.subtitle}</p>

      {dbMissing ? (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ fontSize: 13, color: '#92400e' }}>{ap.db_missing}</div>
        </div>
      ) : null}

      {rows.length === 0 && !loading ? (
        <div className="card page-empty">
          <div className="page-empty-ico"><MegaphoneIcon size={24} /></div>
          <h2>{ap.empty_title}</h2>
          <p>{ap.empty_body}</p>
          <button type="button" className="btn" onClick={openModal}>{ap.create_first}</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ann-table">
            <thead>
              <tr>
                <th>{ap.table_when}</th>
                <th>{ap.table_target}</th>
                <th>{ap.table_message}</th>
                <th>{ap.table_status}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    {formatWhen(row.status === 'sent' && row.sent_at ? row.sent_at : row.send_at, language)}
                  </td>
                  <td style={{ fontSize: 13, maxWidth: 180 }}>{targetLabel(row)}</td>
                  <td style={{ fontSize: 13, maxWidth: 320 }}>
                    {row.title ? <strong style={{ display: 'block', marginBottom: 2 }}>{row.title}</strong> : null}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {row.content.length > 120 ? `${row.content.slice(0, 120)}…` : row.content}
                    </span>
                  </td>
                  <td>
                    <span className={`ann-status ann-status--${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.status === 'scheduled' ? (
                      <button type="button" className="btn secondary sm" onClick={() => void cancelAnnouncement(row.id)}>
                        {ap.cancel_action}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="modal-backdrop" onClick={() => !saving && setModalOpen(false)}>
          <div
            className="modal card ann-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ann-modal-title"
          >
            <h2 id="ann-modal-title" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
              {ap.modal_title}
            </h2>
            <p className="muted" style={{ margin: '0 0 20px', fontSize: 13 }}>{ap.modal_sub}</p>

            <div className="modal-form-section">
              <label className="field-label" htmlFor="ann-title">{ap.field_title}</label>
              <input
                id="ann-title"
                className="field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cambio de horario"
              />
            </div>

            <div className="modal-form-section">
              <label className="field-label" htmlFor="ann-content">{ap.field_content}</label>
              <textarea
                id="ann-content"
                className="field-textarea"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribí el comunicado…"
              />
            </div>

            <div className="modal-form-section">
              <span className="field-label">{ap.field_target}</span>
              <div className="ann-target-tabs">
                {([
                  ['all_clients', ap.target_all],
                  ['groups', ap.target_groups],
                  ['clients', ap.target_clients],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`ann-target-tab${targetType === key ? ' active' : ''}`}
                    onClick={() => {
                      setTargetType(key);
                      setSelectedIds(new Set());
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {targetType === 'groups' ? (
                <div className="ann-pick-list">
                  {groups.length === 0 ? (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>No tenés grupos creados.</p>
                  ) : (
                    groups.map((g) => (
                      <label key={g.id} className="ann-pick-item">
                        <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleId(g.id)} />
                        <span>{g.name}</span>
                      </label>
                    ))
                  )}
                </div>
              ) : null}

              {targetType === 'clients' ? (
                <div className="ann-pick-list">
                  {students.length === 0 ? (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>No tenés alumnos activos.</p>
                  ) : (
                    students.map((s) => (
                      <label key={s.id} className="ann-pick-item">
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleId(s.id)} />
                        <UserAvatar name={s.full_name} url={s.avatar_url} size="sm" />
                        <span>{s.full_name ?? 'Alumno'}</span>
                      </label>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="modal-form-section">
              <span className="field-label">{ap.field_schedule}</span>
              <div className="ann-target-tabs">
                <button
                  type="button"
                  className={`ann-target-tab${sendMode === 'now' ? ' active' : ''}`}
                  onClick={() => setSendMode('now')}
                >
                  {ap.send_now}
                </button>
                <button
                  type="button"
                  className={`ann-target-tab${sendMode === 'later' ? ' active' : ''}`}
                  onClick={() => setSendMode('later')}
                >
                  {ap.send_later}
                </button>
              </div>
              {sendMode === 'later' ? (
                <input
                  type="datetime-local"
                  className="field-input"
                  value={sendAtLocal}
                  onChange={(e) => setSendAtLocal(e.target.value)}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" disabled={saving} onClick={() => setModalOpen(false)}>
                {ap.cancel}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => void saveAnnouncement()}>
                {saving ? ap.saving : ap.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .ann-modal { max-width: 520px; width: 100%; max-height: min(90vh, 720px); overflow-y: auto; }
        .ann-table { width: 100%; border-collapse: collapse; }
        .ann-table th, .ann-table td {
          padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        .ann-table th {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .05em; color: var(--text-tertiary); background: var(--surface-elevated);
        }
        .ann-target-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
        .ann-target-tab {
          border: 1px solid var(--border); background: var(--surface-elevated);
          color: var(--text-secondary); border-radius: 999px; padding: 6px 12px;
          font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .ann-target-tab.active {
          background: var(--primary-soft); border-color: var(--primary);
          color: var(--primary-strong);
        }
        .ann-pick-list {
          margin-top: 10px; max-height: 180px; overflow: auto;
          border: 1px solid var(--border); border-radius: 10px; padding: 8px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .ann-pick-item {
          display: flex; align-items: center; gap: 8px; padding: 6px 8px;
          border-radius: 8px; cursor: pointer; font-size: 13px;
        }
        .ann-pick-item:hover { background: var(--surface-elevated); }
        .ann-status {
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
          padding: 3px 8px; border-radius: 999px;
        }
        .ann-status--scheduled { background: #ede9fe; color: #5b21b6; }
        .ann-status--sent { background: var(--green-soft); color: var(--green-strong); }
        .ann-status--failed { background: #fee2e2; color: #b91c1c; }
        .ann-status--cancelled { background: var(--surface-elevated); color: var(--text-tertiary); }
        [data-theme="dark"] .ann-status--scheduled { background: #2e1065; color: #c4b5fd; }
        [data-theme="dark"] .ann-status--failed { background: #450a0a; color: #fca5a5; }
      `}</style>
    </div>
  );
}
