import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme, spacing } from '../../theme';
import { AppText } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

// ── Signature pad ─────────────────────────────────────────────────────────────

const PAD_WIDTH  = 300;
const PAD_HEIGHT = 130;

function SignaturePad({
  strokes,
  onStrokeEnd,
  onClear,
}: {
  strokes: Stroke[];
  onStrokeEnd: (strokes: Stroke[]) => void;
  onClear: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const currentStroke = useRef<Stroke>([]);
  const allStrokes    = useRef<Stroke[]>([...strokes]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current = [{ x, y }];
      },
      onPanResponderMove: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentStroke.current.push({ x, y });
        // Force re-render by calling a no-op setState via ref trick is complex;
        // instead we collect and update on end
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 1) {
          allStrokes.current = [...allStrokes.current, [...currentStroke.current]];
          onStrokeEnd([...allStrokes.current]);
        }
        currentStroke.current = [];
      },
    })
  ).current;

  const pathD = (stroke: Stroke) => {
    if (stroke.length < 2) return '';
    return stroke
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
  };

  return (
    <View>
      <View
        style={[
          styles.padBorder,
          { borderColor: colors.border.default, backgroundColor: colors.surface.elevated },
        ]}
        {...panResponder.panHandlers}
      >
        <Svg width={PAD_WIDTH} height={PAD_HEIGHT}>
          {allStrokes.current.map((s, i) => (
            <Path
              key={i}
              d={pathD(s)}
              stroke={colors.text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {allStrokes.current.length === 0 && (
          <View style={styles.padHint} pointerEvents="none">
            <AppText variant="body13" color={colors.text.tertiary}>
              Dibujá tu firma con el dedo
            </AppText>
          </View>
        )}
      </View>
      {allStrokes.current.length > 0 && (
        <TouchableOpacity onPress={() => { allStrokes.current = []; onClear(); }} style={styles.clearBtn}>
          <AppText variant="body13" color={colors.text.tertiary}>Limpiar</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function WaiverScreen({ config, trainerId, onSigned }: WaiverScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const profile    = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [strokes, setStrokes]   = useState<Stroke[]>([]);
  const [saving, setSaving]     = useState(false);

  const hasSig = strokes.length > 0;

  const serializeStrokes = (data: Stroke[]) =>
    JSON.stringify(data.map((s) => s.map((pt) => [Math.round(pt.x), Math.round(pt.y)])));

  const handleSign = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor escribí tu nombre completo antes de firmar.');
      return;
    }
    if (!hasSig) {
      Alert.alert('Firma requerida', 'Dibujá tu firma en el recuadro para continuar.');
      return;
    }
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await anyClient.from('waiver_signatures').upsert({
      client_id: profile.id,
      trainer_id: trainerId,
      full_name: fullName.trim(),
      signature_data: serializeStrokes(strokes),
      document_snapshot: config.body,
      document_title: config.title,
      signed_at: new Date().toISOString(),
    }, { onConflict: 'client_id,trainer_id' });
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar la firma. Intentá de nuevo.');
      return;
    }
    onSigned();
  }, [fullName, hasSig, profile?.id, strokes, trainerId, onSigned]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.headerBadge, { backgroundColor: colors.surface.elevated, borderColor: colors.border.default }]}>
            <AppText variant="caps11" color={colors.text.tertiary} style={{ letterSpacing: 1 }}>
              Documento legal
            </AppText>
          </View>
        </View>
        <AppText variant="h2" color={colors.text.primary} style={styles.title}>
          {config.title}
        </AppText>
        <AppText variant="body13" color={colors.text.secondary} style={styles.subtitle}>
          Leé el documento completo antes de firmar.
        </AppText>

        {/* Document body */}
        <View style={[styles.docBox, { borderColor: colors.border.default, backgroundColor: colors.surface.elevated }]}>
          <AppText variant="body14" color={colors.text.primary} style={styles.docText}>
            {config.body}
          </AppText>
        </View>

        {/* Signature section */}
        <View style={[styles.sigSection, { borderColor: colors.border.default }]}>
          <AppText variant="body14" color={colors.text.primary} style={{ fontWeight: '700', marginBottom: 14 }}>
            Firma el documento
          </AppText>

          {/* Full name input */}
          <AppText variant="body13" color={colors.text.secondary} style={styles.fieldLabel}>
            Nombre completo
          </AppText>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre completo"
            placeholderTextColor={colors.text.tertiary}
            style={[
              styles.textInput,
              {
                color: colors.text.primary,
                borderColor: colors.border.default,
                backgroundColor: colors.surface.elevated,
              },
            ]}
            autoCapitalize="words"
          />

          {/* Signature pad */}
          <AppText variant="body13" color={colors.text.secondary} style={[styles.fieldLabel, { marginTop: 16 }]}>
            Firma digital
          </AppText>
          <SignaturePad
            strokes={strokes}
            onStrokeEnd={setStrokes}
            onClear={() => setStrokes([])}
          />
        </View>

        {/* Agreement notice */}
        <View style={styles.notice}>
          <AppText variant="caps11" color={colors.text.tertiary} style={{ lineHeight: 16, textAlign: 'center' }}>
            Al presionar "Firmar y continuar" confirmás que leíste y aceptás el deslinde de responsabilidad en su totalidad.
          </AppText>
        </View>

        {/* Sign button */}
        <TouchableOpacity
          style={[
            styles.signBtn,
            { backgroundColor: hasSig && fullName.trim() ? colors.primary.default : colors.surface.elevated },
          ]}
          onPress={() => void handleSign()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText
              variant="body16SemiBold"
              color={hasSig && fullName.trim() ? '#fff' : colors.text.tertiary}
            >
              Firmar y continuar
            </AppText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', marginBottom: 12 },
  headerBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
  },
  title: { marginBottom: 6 },
  subtitle: { marginBottom: 20, lineHeight: 20 },
  docBox: {
    borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 24,
  },
  docText: { lineHeight: 22 },
  sigSection: {
    borderTopWidth: 1, paddingTop: 24, marginBottom: 20,
  },
  fieldLabel: { marginBottom: 8, fontWeight: '600' },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 4,
  },
  padBorder: {
    width: PAD_WIDTH, height: PAD_HEIGHT,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10,
    overflow: 'hidden', position: 'relative',
  },
  padHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtn: { marginTop: 6, alignSelf: 'flex-start' },
  notice: { marginBottom: 20, paddingHorizontal: 4 },
  signBtn: {
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
});
