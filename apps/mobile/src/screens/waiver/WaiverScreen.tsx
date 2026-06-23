import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme, spacing } from '../../theme';
import { AppText } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';

interface Point { x: number; y: number }
type Stroke = Point[];

interface WaiverConfig {
  title: string;
  body: string;
  require_before_start: boolean;
}

interface WaiverScreenProps {
  config: WaiverConfig;
  trainerId: string;
  onSigned: () => void;
  embedded?: boolean;
  bottomInset?: number;
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

const PAD_HEIGHT = 140;
const H_PAD = spacing.lg;

function SignaturePad({
  width,
  strokes,
  onStrokeEnd,
  onClear,
  onDrawingChange,
  hint,
  clearLabel,
}: {
  width: number;
  strokes: Stroke[];
  onStrokeEnd: (strokes: Stroke[]) => void;
  onClear: () => void;
  onDrawingChange?: (drawing: boolean) => void;
  hint: string;
  clearLabel: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const currentStroke = useRef<Stroke>([]);
  const strokesRef = useRef(strokes);
  const [, setTick] = useState(0);

  strokesRef.current = strokes;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        onDrawingChange?.(true);
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current = [{ x, y }];
        setTick((n) => n + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current.push({ x, y });
        setTick((n) => n + 1);
      },
      onPanResponderRelease: () => {
        onDrawingChange?.(false);
        if (currentStroke.current.length > 1) {
          onStrokeEnd([...strokesRef.current, [...currentStroke.current]]);
        }
        currentStroke.current = [];
        setTick((n) => n + 1);
      },
      onPanResponderTerminate: () => {
        onDrawingChange?.(false);
        currentStroke.current = [];
        setTick((n) => n + 1);
      },
    }),
  ).current;

  const pathD = (stroke: Stroke) => {
    if (stroke.length < 2) return '';
    return stroke
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
  };

  const live = currentStroke.current.length > 1 ? currentStroke.current : null;
  const allPaths = live ? [...strokes, live] : strokes;

  return (
    <View>
      <View
        style={[
          styles.padBorder,
          {
            width,
            height: PAD_HEIGHT,
            borderColor: colors.border.default,
            backgroundColor: colors.surface.elevated,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Svg width={width} height={PAD_HEIGHT}>
          {allPaths.map((s, i) => (
            <Path
              key={i}
              d={pathD(s)}
              stroke={colors.text.primary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {strokes.length === 0 && !live && (
          <View style={styles.padHint} pointerEvents="none">
            <AppText variant="body13" color={colors.text.tertiary}>
              {hint}
            </AppText>
          </View>
        )}
      </View>
      {strokes.length > 0 ? (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={8}>
          <AppText variant="body13" color={colors.text.secondary}>{clearLabel}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function WaiverScreen({
  config,
  trainerId,
  onSigned,
  embedded = false,
  bottomInset = 0,
}: WaiverScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState(false);

  const padWidth = screenWidth - H_PAD * 2;
  const canSign = strokes.length > 0 && fullName.trim().length > 0;

  const serializeStrokes = (data: Stroke[]) =>
    JSON.stringify(data.map((s) => s.map((pt) => [Math.round(pt.x), Math.round(pt.y)])));

  const saveSignature = async (): Promise<{ ok: boolean; error?: string }> => {
    const clientId = profile?.id;
    const resolvedTrainerId = trainerId;
    if (!clientId || !resolvedTrainerId) {
      return { ok: false, error: 'no_trainer_linked' };
    }

    const signatureData = serializeStrokes(strokes);
    const payload = {
      p_trainer_id: resolvedTrainerId,
      p_full_name: fullName.trim(),
      p_signature_data: signatureData,
      p_document_snapshot: config.body ?? '',
      p_document_title: config.title ?? 'Deslinde de Responsabilidad',
    };

    const { error: rpcError } = await supabase.rpc('save_client_waiver_signature', payload);
    if (!rpcError) return { ok: true };

    const rpcMessage = rpcError.message ?? 'rpc_failed';
    if (__DEV__) console.warn('[waiver] RPC save failed:', rpcMessage, rpcError);

    const { error: upsertError } = await anyClient.from('waiver_signatures').upsert({
      client_id: clientId,
      trainer_id: resolvedTrainerId,
      full_name: fullName.trim(),
      signature_data: signatureData,
      document_snapshot: config.body ?? '',
      document_title: config.title ?? 'Deslinde de Responsabilidad',
      signed_at: new Date().toISOString(),
    }, { onConflict: 'client_id,trainer_id' });

    if (!upsertError) return { ok: true };

    const upsertMessage = upsertError.message ?? 'upsert_failed';
    if (__DEV__) console.warn('[waiver] upsert failed:', upsertMessage, upsertError);
    return { ok: false, error: rpcMessage || upsertMessage };
  };

  const handleSign = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert(t.waiver.name_required, t.waiver.name_required_msg);
      return;
    }
    if (strokes.length === 0) {
      Alert.alert(t.waiver.sig_required, t.waiver.sig_required_msg);
      return;
    }
    if (!profile?.id) return;
    setSaving(true);
    const result = await saveSignature();
    setSaving(false);
    if (!result.ok) {
      const detail = __DEV__ && result.error ? `\n\n${result.error}` : '';
      Alert.alert('Error', `${t.waiver.save_error}${detail}`);
      return;
    }
    onSigned();
  }, [fullName, strokes, profile?.id, trainerId, onSigned, config.body, config.title, t]);

  const content = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={embedded ? 8 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scroll,
          embedded ? styles.scrollEmbedded : null,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawingSignature}
        bounces={!drawingSignature}
      >
        {!embedded ? (
          <View style={[styles.headerBadge, { backgroundColor: colors.surface.elevated, borderColor: colors.border.default }]}>
            <AppText variant="caps11" color={colors.text.tertiary} style={{ letterSpacing: 1 }}>
              {t.waiver.legal_badge}
            </AppText>
          </View>
        ) : null}

        <AppText variant="h2" color={colors.text.primary} style={styles.title}>
          {config.title}
        </AppText>
        <AppText variant="body13" color={colors.text.secondary} style={styles.subtitle}>
          {t.waiver.read_before}
        </AppText>

        <View style={[styles.card, { borderColor: colors.border.default, backgroundColor: colors.surface.elevated }]}>
          <AppText variant="body14" color={colors.text.primary} style={styles.docText}>
            {config.body}
          </AppText>
        </View>

        <AppText variant="body12" color={colors.text.tertiary} style={styles.agreement}>
          {t.waiver.agreement}
        </AppText>
      </ScrollView>

      <View style={[styles.sigPanel, { borderTopColor: colors.border.default, backgroundColor: colors.background }]}>
        <View style={[styles.card, styles.sigCard, { borderColor: colors.border.default, backgroundColor: colors.surface.elevated }]}>
          <AppText variant="body16SemiBold" color={colors.text.primary} style={styles.sigTitle}>
            {t.waiver.sign_section}
          </AppText>

          <AppText variant="caps12" color={colors.text.tertiary} style={styles.fieldLabel}>
            {t.waiver.full_name}
          </AppText>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t.waiver.full_name_ph}
            placeholderTextColor={colors.text.tertiary}
            style={[
              styles.textInput,
              {
                color: colors.text.primary,
                borderColor: colors.border.default,
                backgroundColor: colors.background,
              },
            ]}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <AppText variant="caps12" color={colors.text.tertiary} style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            {t.waiver.signature}
          </AppText>
          <SignaturePad
            width={padWidth}
            strokes={strokes}
            onStrokeEnd={setStrokes}
            onClear={() => setStrokes([])}
            onDrawingChange={setDrawingSignature}
            hint={t.waiver.signature_hint}
            clearLabel={t.waiver.clear}
          />
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border.default,
            backgroundColor: colors.background,
            paddingBottom: Math.max(bottomInset, spacing.md),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.signBtn,
            { backgroundColor: canSign ? colors.primary.default : colors.surface.elevated },
          ]}
          onPress={() => void handleSign()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#0C0C0C" />
          ) : (
            <AppText
              variant="body16SemiBold"
              color={canSign ? '#0C0C0C' : colors.text.tertiary}
            >
              {t.waiver.sign_cta}
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  if (embedded) {
    return <View style={styles.flex}>{content}</View>;
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: H_PAD, paddingTop: spacing.lg, paddingBottom: 16 },
  scrollEmbedded: { paddingTop: spacing.md },
  headerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  title: { marginBottom: 6 },
  subtitle: { marginBottom: 16, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  docText: { lineHeight: 22 },
  sigPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sigCard: { marginBottom: 0 },
  sigTitle: { marginBottom: 16 },
  fieldLabel: { marginBottom: 8, letterSpacing: 0.4 },
  fieldLabelSpaced: { marginTop: 4 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 4,
  },
  padBorder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  padHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  clearBtn: { marginTop: 8, alignSelf: 'flex-end' },
  agreement: { lineHeight: 18, textAlign: 'center', paddingHorizontal: 4, marginTop: 4, marginBottom: 8 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
  },
  signBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
