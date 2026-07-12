import { useCallback, useEffect, useState } from 'react';
import type { WorkoutCommentRow, WorkoutLikeRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CommentView {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
}

interface AuthorProfile { full_name: string | null; avatar_url: string | null }

export interface WorkoutSocial {
  loading: boolean;
  likeCount: (logId: string) => number;
  likedByMe: (logId: string) => boolean;
  commentCount: (logId: string) => number;
  comments: (logId: string) => CommentView[];
  toggleLike: (logId: string) => Promise<void>;
  addComment: (logId: string, body: string) => Promise<void>;
  deleteComment: (logId: string, commentId: string) => Promise<void>;
}

/** Carga en batch likes + comentarios de una lista de workout_logs y expone
 * acciones (like, comentar, borrar) con actualización optimista. Tanto el
 * cliente dueño del log como su entrenador pueden interactuar (ver RLS en
 * 20260712120000_workout_social.sql). */
export function useWorkoutSocial(logIds: string[]): WorkoutSocial {
  const { session, profile } = useAuth();
  const myId = session?.user.id ?? null;

  const [likes, setLikes] = useState<Map<string, Set<string>>>(new Map());
  const [comments, setComments] = useState<Map<string, CommentView[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Clave estable para el efecto: evita recargar si la lista de ids no cambió.
  const idsKey = logIds.slice().sort().join(',');

  const load = useCallback(async () => {
    if (logIds.length === 0) {
      setLikes(new Map());
      setComments(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      supabase.from('workout_likes').select('workout_log_id, author_id').in('workout_log_id', logIds),
      supabase.from('workout_comments').select('*').in('workout_log_id', logIds).order('created_at', { ascending: true }),
    ]);

    const likeMap = new Map<string, Set<string>>();
    for (const r of (likeRows as Pick<WorkoutLikeRow, 'workout_log_id' | 'author_id'>[] | null) ?? []) {
      const set = likeMap.get(r.workout_log_id) ?? new Set<string>();
      set.add(r.author_id);
      likeMap.set(r.workout_log_id, set);
    }

    const commentList = (commentRows as WorkoutCommentRow[] | null) ?? [];
    const authorIds = [...new Set(commentList.map((c) => c.author_id))];
    const authorMap = new Map<string, AuthorProfile>();
    if (authorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', authorIds);
      for (const p of (profs as ({ id: string } & AuthorProfile)[] | null) ?? []) {
        authorMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
      }
    }
    const commentMap = new Map<string, CommentView[]>();
    for (const c of commentList) {
      const author = authorMap.get(c.author_id);
      const view: CommentView = {
        id: c.id,
        authorId: c.author_id,
        authorName: author?.full_name ?? 'Usuario',
        authorAvatar: author?.avatar_url ?? null,
        body: c.body,
        createdAt: c.created_at,
        isMine: c.author_id === myId,
      };
      const list = commentMap.get(c.workout_log_id) ?? [];
      list.push(view);
      commentMap.set(c.workout_log_id, list);
    }

    setLikes(likeMap);
    setComments(commentMap);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, myId]);

  useEffect(() => { void load(); }, [load]);

  const likeCount = useCallback((logId: string) => likes.get(logId)?.size ?? 0, [likes]);
  const likedByMe = useCallback((logId: string) => (myId ? likes.get(logId)?.has(myId) ?? false : false), [likes, myId]);
  const commentCount = useCallback((logId: string) => comments.get(logId)?.length ?? 0, [comments]);
  const commentsFor = useCallback((logId: string) => comments.get(logId) ?? [], [comments]);

  const toggleLike = useCallback(async (logId: string) => {
    if (!myId) return;
    const mine = likes.get(logId)?.has(myId) ?? false;
    // Optimista.
    setLikes((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(logId) ?? []);
      if (mine) set.delete(myId); else set.add(myId);
      next.set(logId, set);
      return next;
    });
    if (mine) {
      await supabase.from('workout_likes').delete().eq('workout_log_id', logId).eq('author_id', myId);
    } else {
      const { error } = await supabase.from('workout_likes').insert({ workout_log_id: logId, author_id: myId });
      if (error) {
        // Revertir si falló.
        setLikes((prev) => {
          const next = new Map(prev);
          const set = new Set(next.get(logId) ?? []);
          set.delete(myId);
          next.set(logId, set);
          return next;
        });
      }
    }
  }, [likes, myId]);

  const addComment = useCallback(async (logId: string, body: string) => {
    if (!myId || !body.trim()) return;
    const { data, error } = await supabase
      .from('workout_comments')
      .insert({ workout_log_id: logId, author_id: myId, body: body.trim() })
      .select()
      .single();
    if (error || !data) return;
    const row = data as WorkoutCommentRow;
    const view: CommentView = {
      id: row.id,
      authorId: myId,
      authorName: profile?.full_name ?? 'Vos',
      authorAvatar: profile?.avatar_url ?? null,
      body: row.body,
      createdAt: row.created_at,
      isMine: true,
    };
    setComments((prev) => {
      const next = new Map(prev);
      next.set(logId, [...(next.get(logId) ?? []), view]);
      return next;
    });
  }, [myId, profile]);

  const deleteComment = useCallback(async (logId: string, commentId: string) => {
    setComments((prev) => {
      const next = new Map(prev);
      next.set(logId, (next.get(logId) ?? []).filter((c) => c.id !== commentId));
      return next;
    });
    await supabase.from('workout_comments').delete().eq('id', commentId);
  }, []);

  return { loading, likeCount, likedByMe, commentCount, comments: commentsFor, toggleLike, addComment, deleteComment };
}
