import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatTime } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import {
  AppText,
  BottomSheet,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import type { MessageRow, RoutineExerciseRow, RoutineRow } from '../../types/database';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoachChat'>;

interface RoutineWithExercises extends RoutineRow {
  exercises: RoutineExerciseRow[];
}

/**
 * Workaround temporal: el tipado de `Database` colapsa a `never` con esta versión de
 * supabase-js (las filas son interfaces sin index signature). El parámetro genérico
 * mantiene el chequeo del payload contra la fila real; borrar cuando se corrija el tipado.
 */
function asWrite<T>(payload: Partial<T>): never {
  return payload as never;
}

export function CoachChatScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [routinesVisible, setRoutinesVisible] = useState(false);
  const [coachAvatar, setCoachAvatar] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', userId)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      setMessages(data);
      // Marcar como leídos los mensajes del coach
      await supabase
        .from('messages')
        .update(asWrite<MessageRow>({ read: true }))
        .eq('client_id', userId)
        .eq('sender_role', 'trainer')
        .eq('read', false);
    } catch {
      setError('No pudimos cargar tus mensajes.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Carga inicial inline: los setState ocurren después del await, no de forma
  // síncrona dentro del efecto.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .eq('client_id', userId)
          .order('created_at', { ascending: true });
        if (fetchError) throw fetchError;
        if (cancelled) return;
        setMessages(data);
        await supabase
          .from('messages')
          .update(asWrite<MessageRow>({ read: true }))
          .eq('client_id', userId)
          .eq('sender_role', 'trainer')
          .eq('read', false);
      } catch {
        if (!cancelled) setError('No pudimos cargar tus mensajes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    void (async () => {
      const { data } = await supabase
        .from('routines')
        .select('*')
        .eq('client_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      const routineRows = (data ?? []) as RoutineRow[];
      if (routineRows.length === 0) {
        setRoutines([]);
        return;
      }
      const { data: exerciseData } = await supabase
        .from('routine_exercises')
        .select('*')
        .in('routine_id', routineRows.map((r) => r.id))
        .order('order_index', { ascending: true });
      if (cancelled) return;
      const exerciseRows = (exerciseData ?? []) as RoutineExerciseRow[];
      setRoutines(
        routineRows.map((routine) => ({
          ...routine,
          exercises: exerciseRows.filter((e) => e.routine_id === routine.id),
        }))
      );
    })();

    // Avatar del coach (para mostrarlo en el chat).
    void (async () => {
      const trainerId = profile?.trainer_id;
      if (!trainerId) return;
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', trainerId).maybeSingle();
      if (!cancelled && data) setCoachAvatar((data as { avatar_url: string | null }).avatar_url);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profile?.trainer_id]);

  // Realtime: nuevos mensajes del coach + recibos de lectura (UPDATE).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            return;
          }
          const incoming = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.sender_role === 'trainer') {
            void supabase.from('messages').update(asWrite<MessageRow>({ read: true })).eq('id', incoming.id);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !userId || sending) return;
    setSending(true);
    const temp: MessageRow = {
      id: `temp-${Date.now()}`,
      client_id: userId,
      content,
      sender_role: 'client',
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    const { data, error: insertError } = await supabase
      .from('messages')
      .insert(asWrite<MessageRow>({ client_id: userId, content, sender_role: 'client' }))
      .select()
      .single();
    if (insertError || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
      useUiStore.getState().showToast('error', 'No pudimos enviar el mensaje.');
    } else {
      const saved = data as MessageRow;
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
    }
    setSending(false);
  }, [draft, userId, sending]);

  const invertedData = useMemo(() => [...messages].reverse(), [messages]);

  const renderMessage = useCallback(({ item }: { item: MessageRow }) => {
    const own = item.sender_role === 'client';
    const avatarUrl = own ? profile?.avatar_url ?? null : coachAvatar;
    const avatar = (
      <View style={styles.chatAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.chatAvatarImg} contentFit="cover" />
        ) : (
          <Ionicons name="person" size={14} color={colors.text.tertiary} />
        )}
      </View>
    );

    const bubbleContent = (
      <AppText variant="body14" color={own ? colors.text.inverse : colors.text.primary}>
        {item.content}
      </AppText>
    );

    return (
      <View style={[styles.messageLine, own ? styles.messageLineOwn : styles.messageLineCoach]}>
        {!own && avatar}
        <View style={[styles.messageRow, own ? styles.messageRowOwn : styles.messageRowCoach]}>
          {own ? (
            <LinearGradient
              colors={[colors.primary.default, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.bubble, styles.bubbleOwn]}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleCoach]}>{bubbleContent}</View>
          )}
          <View style={styles.bubbleMeta}>
            <AppText variant="body12" color={colors.text.disabled}>
              {formatTime(item.created_at)}
            </AppText>
            {own ? (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read ? colors.water : colors.text.disabled}
                style={styles.bubbleCheck}
              />
            ) : null}
          </View>
        </View>
        {own && avatar}
      </View>
    );
  }, [colors, styles, profile?.avatar_url, coachAvatar]);

  let body: React.JSX.Element;
  if (loading && messages.length === 0) {
    body = (
      <View style={styles.statePad}>
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  } else if (error && messages.length === 0) {
    body = (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          void loadMessages();
        }}
      />
    );
  } else if (messages.length === 0) {
    body = (
      <EmptyState
        pillar="generic"
        title="Sin mensajes"
        message="Todavía no hablaste con tu coach. Mandale tu primer mensaje."
      />
    );
  } else {
    body = (
      <FlatList
        data={invertedData}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        inverted
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Mi coach
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {routines.length > 0 ? (
        <Card
          onPress={() => setRoutinesVisible(true)}
          accessibilityLabel="Ver rutinas asignadas"
          style={styles.routinesCard}
        >
          <View style={styles.routinesRow}>
            <View style={styles.routinesIcon}>
              <Ionicons name="barbell-outline" size={18} color={colors.primary.default} />
            </View>
            <View style={styles.routinesInfo}>
              <AppText variant="body14SemiBold" color={colors.text.primary}>
                Rutinas asignadas
              </AppText>
              <AppText variant="body12" color={colors.text.tertiary}>
                {routines.length} {routines.length === 1 ? 'rutina activa' : 'rutinas activas'}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </View>
        </Card>
      ) : null}

      <View style={styles.body}>{body}</View>

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Input
          placeholder="Escribile a tu coach…"
          value={draft}
          onChangeText={setDraft}
          multiline
          containerStyle={styles.composerInput}
        />
        <IconButton
          icon="send"
          onPress={() => void onSend()}
          accessibilityLabel="Enviar mensaje"
          color={colors.text.inverse}
          backgroundColor={colors.primary.default}
        />
      </View>

      <BottomSheet visible={routinesVisible} onClose={() => setRoutinesVisible(false)} title="Rutinas asignadas">
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {routines.map((routine) => (
            <View key={routine.id} style={styles.routineBlock}>
              <AppText variant="body16SemiBold" color={colors.text.primary}>
                {routine.name}
              </AppText>
              {routine.description ? (
                <AppText variant="body13" color={colors.text.secondary} style={styles.routineDescription}>
                  {routine.description}
                </AppText>
              ) : null}
              {routine.days_per_week ? (
                <AppText variant="body12Medium" color={colors.text.tertiary} style={styles.routineDays}>
                  {routine.days_per_week} días por semana
                </AppText>
              ) : null}
              {routine.exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <AppText variant="body14Medium" color={colors.text.primary} style={styles.exerciseName}>
                    {exercise.name}
                  </AppText>
                  <AppText variant="body13" color={colors.text.secondary}>
                    {exercise.sets ?? '—'} x {exercise.reps ?? '—'}
                  </AppText>
                  {exercise.rest_secs !== null ? (
                    <AppText variant="body13" color={colors.text.tertiary} style={styles.exerciseRest}>
                      {exercise.rest_secs}s descanso
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  routinesCard: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  routinesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routinesIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routinesInfo: { flex: 1 },
  body: { flex: 1 },
  statePad: { paddingHorizontal: layout.screenPadding },
  chatContent: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  messageLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    maxWidth: '86%',
  },
  messageLineOwn: { alignSelf: 'flex-end' },
  messageLineCoach: { alignSelf: 'flex-start' },
  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chatAvatarImg: { width: '100%', height: '100%' },
  messageRow: { flexShrink: 1 },
  messageRowOwn: { alignItems: 'flex-end' },
  messageRowCoach: { alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleOwn: {
    borderBottomRightRadius: radius.sm,
  },
  bubbleCoach: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  bubbleCheck: { marginLeft: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background,
  },
  composerInput: { flex: 1 },
  sheetScroll: { maxHeight: 420 },
  routineBlock: { marginBottom: spacing.lg },
  routineDescription: { marginTop: spacing.xxs },
  routineDays: { marginTop: spacing.xxs, marginBottom: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  exerciseName: { flex: 1 },
  exerciseRest: { minWidth: 90, textAlign: 'right' },
});
