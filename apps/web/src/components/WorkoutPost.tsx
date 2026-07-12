import { useMemo, useState } from 'react';
import type { WorkoutLogRow } from '@reset-fitness/shared/types/database';
import { formatWorkoutVolume, summarizeWorkoutForFeed } from '@reset-fitness/shared';
import { HeartIcon, ShareIcon, TrashIcon } from '@/components/icons';
import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';
import { useWorkoutSocial, type WorkoutSocial } from '@/hooks/useWorkoutSocial';

interface Author { name: string; avatarUrl: string | null }

/** Lista de posts de entrenamiento; centraliza la carga social (likes +
 * comentarios en batch) para todos los logs visibles. */
export function WorkoutFeed({
  workouts,
  author,
  viewer,
}: {
  workouts: WorkoutLogRow[];
  author: Author;
  viewer: Author;
}): React.JSX.Element {
  const logIds = useMemo(() => workouts.map((w) => w.id), [workouts]);
  const social = useWorkoutSocial(logIds);
  return (
    <>
      {workouts.map((w) => (
        <WorkoutPost key={w.id} workout={w} author={author} viewer={viewer} social={social} />
      ))}
    </>
  );
}

interface ExerciseLine { name: string; sets: number; imageUrl: string | null }

function relativeEs(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} meses`;
}

function fmtDuration(w: WorkoutLogRow): string {
  const secs = w.duration_seconds ?? (w.elapsed_seconds ?? 0);
  const mins = secs > 0 ? Math.round(secs / 60) : (w.duration_min ?? 0);
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function Avatar({ name, url, size = 34 }: { name: string; url: string | null; size?: number }): React.JSX.Element {
  const resolved = resolveAvatarUrl(url);
  return resolved ? (
    <span className="wp-avatar" style={{ width: size, height: size }}>
      <img src={resolved} alt="" />
    </span>
  ) : (
    <span className="wp-avatar wp-avatar--initial" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

/** Un entrenamiento registrado, presentado como post social estilo Hevy:
 * header, stats, ejercicios con miniatura, barra de like/compartir y
 * comentarios. Los likes/comentarios los maneja useWorkoutSocial (funcional). */
export function WorkoutPost({
  workout: w,
  author,
  viewer,
  social,
}: {
  workout: WorkoutLogRow;
  author: Author;
  viewer: Author;
  social: WorkoutSocial;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const lines: ExerciseLine[] = useMemo(() => {
    const detail = w.session_detail;
    if (detail && detail.exercises.length > 0) {
      return detail.exercises.map((ex) => ({
        name: ex.exerciseName,
        sets: ex.sets.filter((s) => s.completed).length || ex.sets.length || ex.targetSets,
        imageUrl: ex.imageUrl,
      }));
    }
    return summarizeWorkoutForFeed(w.session_detail).map((l) => ({ name: l.name, sets: l.completedSets, imageUrl: null }));
  }, [w.session_detail]);

  const visible = expanded ? lines : lines.slice(0, 3);
  const hidden = lines.length - visible.length;

  const likeCount = social.likeCount(w.id);
  const liked = social.likedByMe(w.id);
  const comments = social.comments(w.id);
  const volumeLabel = w.total_volume_kg != null && w.total_volume_kg > 0 ? formatWorkoutVolume(w.total_volume_kg) : '—';

  const submit = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    await social.addComment(w.id, draft);
    setDraft('');
    setPosting(false);
  };

  return (
    <article className="wp-card">
      <header className="wp-head">
        <Avatar name={author.name} url={author.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div className="wp-author">{author.name}</div>
          <div className="wp-date">{new Date(w.date).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <span className="wp-when">{relativeEs(w.date)}</span>
      </header>

      <h3 className="wp-title">{w.workout_name || 'Entrenamiento'}</h3>

      <div className="wp-stats">
        <div><span className="wp-stat-v">{fmtDuration(w)}</span><span className="wp-stat-l">Duración</span></div>
        <div><span className="wp-stat-v">{volumeLabel}</span><span className="wp-stat-l">Volumen</span></div>
        <div><span className="wp-stat-v">{w.rpe != null ? `${w.rpe}/10` : (w.completed_sets || '—')}</span><span className="wp-stat-l">{w.rpe != null ? 'RPE' : 'Series'}</span></div>
      </div>

      {lines.length > 0 && (
        <div className="wp-ex-list">
          <div className="wp-ex-label">Workout</div>
          {visible.map((ex, i) => (
            <div key={`${w.id}-${i}`} className="wp-ex">
              {ex.imageUrl ? (
                <span className="wp-ex-thumb"><img src={ex.imageUrl} alt="" /></span>
              ) : (
                <span className="wp-ex-thumb wp-ex-thumb--empty" aria-hidden />
              )}
              <span className="wp-ex-name">{ex.sets} sets · {ex.name}</span>
            </div>
          ))}
          {hidden > 0 && (
            <button type="button" className="wp-more" onClick={() => setExpanded(true)}>
              Ver {hidden} ejercicio{hidden === 1 ? '' : 's'} más
            </button>
          )}
          {expanded && lines.length > 3 && (
            <button type="button" className="wp-more" onClick={() => setExpanded(false)}>Ver menos</button>
          )}
        </div>
      )}

      {(likeCount > 0 || comments.length > 0) && (
        <div className="wp-counts">
          <span>{likeCount} like{likeCount === 1 ? '' : 's'}</span>
          <span>{comments.length} comentario{comments.length === 1 ? '' : 's'}</span>
        </div>
      )}

      <div className="wp-actions">
        <button type="button" className={`wp-action${liked ? ' liked' : ''}`} onClick={() => void social.toggleLike(w.id)}>
          <HeartIcon size={18} filled={liked} /> Me gusta
        </button>
        <button
          type="button"
          className="wp-action"
          onClick={() => { void navigator.clipboard?.writeText(`${author.name} — ${w.workout_name}`); }}
        >
          <ShareIcon size={18} /> Compartir
        </button>
      </div>

      {comments.length > 0 && (
        <div className="wp-comments">
          {comments.map((c) => (
            <div key={c.id} className="wp-comment">
              <Avatar name={c.authorName} url={c.authorAvatar} size={28} />
              <div className="wp-comment-body">
                <span className="wp-comment-author">{c.authorName}</span>
                <span className="wp-comment-text">{c.body}</span>
              </div>
              {c.isMine && (
                <button type="button" className="wp-comment-del" onClick={() => void social.deleteComment(w.id, c.id)} aria-label="Borrar comentario">
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="wp-composer">
        <Avatar name={viewer.name} url={viewer.avatarUrl} size={28} />
        <input
          className="wp-composer-input"
          placeholder="Escribí un comentario…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <button type="button" className="wp-post" disabled={!draft.trim() || posting} onClick={() => void submit()}>
          {posting ? '…' : 'Publicar'}
        </button>
      </div>

      <style>{`
        .wp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; margin-bottom: 14px; box-shadow: var(--card-shadow); }
        .wp-head { display: flex; align-items: center; gap: 10px; }
        .wp-avatar { border-radius: 50%; overflow: hidden; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-elevated); color: var(--text-secondary); font-weight: 700; }
        .wp-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .wp-avatar--initial { background: var(--accent-soft); color: var(--accent-text); }
        .wp-author { font-weight: 650; font-size: 14px; }
        .wp-date { font-size: 12px; color: var(--text-tertiary); text-transform: capitalize; }
        .wp-when { margin-left: auto; font-size: 11.5px; color: var(--text-tertiary); white-space: nowrap; }
        .wp-title { font-size: 16px; font-weight: 700; margin: 12px 0 0; letter-spacing: -0.01em; }
        .wp-stats { display: flex; gap: 26px; margin: 12px 0 4px; }
        .wp-stat-v { display: block; font-weight: 700; font-size: 14px; }
        .wp-stat-l { display: block; font-size: 11px; color: var(--text-tertiary); margin-top: 1px; }
        .wp-ex-list { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
        .wp-ex-label { font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .wp-ex { display: flex; align-items: center; gap: 12px; padding: 5px 0; }
        .wp-ex-thumb { width: 40px; height: 40px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: var(--surface-elevated); display: inline-flex; align-items: center; justify-content: center; }
        .wp-ex-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .wp-ex-thumb--empty { border: 1px dashed var(--border-strong); }
        .wp-ex-name { font-size: 13.5px; font-weight: 500; }
        .wp-more { display: block; width: 100%; text-align: center; background: none; border: none; color: var(--text-secondary); font-size: 12.5px; font-weight: 600; padding: 8px 0 2px; cursor: pointer; }
        .wp-more:hover { color: var(--accent-text); }
        .wp-counts { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-tertiary); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
        .wp-actions { display: flex; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
        .wp-action { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; background: none; border: none; cursor: pointer; padding: 9px 0; font-size: 13px; font-weight: 600; color: var(--text-secondary); border-radius: 8px; transition: background 120ms ease, color 120ms ease; }
        .wp-action:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .wp-action.liked { color: var(--accent-text); }
        .wp-comments { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
        .wp-comment { display: flex; align-items: flex-start; gap: 8px; }
        .wp-comment-body { background: var(--surface-elevated); border-radius: 12px; padding: 7px 11px; font-size: 13px; min-width: 0; }
        .wp-comment-author { font-weight: 650; margin-right: 6px; }
        .wp-comment-text { color: var(--text-primary); overflow-wrap: anywhere; }
        .wp-comment-del { margin-left: auto; background: none; border: none; color: var(--text-tertiary); cursor: pointer; padding: 4px; flex-shrink: 0; }
        .wp-comment-del:hover { color: var(--bad); }
        .wp-composer { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .wp-composer-input { flex: 1; min-width: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 8px 14px; font-size: 13px; color: var(--text-primary); outline: none; transition: border-color 120ms ease; }
        .wp-composer-input:focus { border-color: var(--accent-ring); }
        .wp-post { background: none; border: none; color: var(--accent-text); font-weight: 700; font-size: 13px; cursor: pointer; padding: 6px 4px; flex-shrink: 0; }
        .wp-post:disabled { color: var(--text-tertiary); cursor: default; }
      `}</style>
    </article>
  );
}
