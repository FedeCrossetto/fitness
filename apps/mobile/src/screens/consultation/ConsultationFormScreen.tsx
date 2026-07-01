import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, spacing, type Colors } from '../../theme';
import { AppText } from '../../components/common';
import { anyClient } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

// ── DSL Parser (same logic as web ConsultationForm.tsx) ───────────────────────

type FieldType = 'listbox' | 'dropdown' | 'textbox' | 'textarea';

interface FormField {
  type: FieldType;
  label: string;
  options?: string[];
}

function parseFormCode(code: string): FormField[] {
  const fields: FormField[] = [];
  const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;

  const attr = (line: string): string => {
    const m = line.match(/text=['"]([^'"]*)['"]/);
    return m?.[1] ?? '';
  };

  while (i < lines.length) {
    const line = lines[i]!;

    if (/^\[listbox /i.test(line)) {
      const label = attr(line);
      const options: string[] = [];
      i++;
      while (i < lines.length && !/^\[\/listbox\]/i.test(lines[i]!)) {
        if (/^\[value /i.test(lines[i]!)) options.push(attr(lines[i]!));
        i++;
      }
      fields.push({ type: 'listbox', label, options });

    } else if (/^\[dropdown /i.test(line)) {
      const label = attr(line);
      const options: string[] = [];
      i++;
      while (i < lines.length && !/^\[\/dropdown\]/i.test(lines[i]!)) {
        if (/^\[value /i.test(lines[i]!)) {
          const opt = attr(lines[i]!);
          if (opt && opt !== '--') options.push(opt);
        }
        i++;
      }
      fields.push({ type: 'dropdown', label, options });

    } else if (/^\[textbox /i.test(line)) {
      fields.push({ type: 'textbox', label: attr(line) });

    } else if (/^\[textarea /i.test(line)) {
      fields.push({ type: 'textarea', label: attr(line) });
    }

    i++;
  }
  return fields;
}

// ── Answer types ──────────────────────────────────────────────────────────────

type Answer = string | string[];   // string[] for listbox, string for the rest

interface ResponseEntry {
  label: string;
  type: FieldType;
  answer: Answer;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConsultationFormScreenProps {
  formCode: string;
  trainerId: string;
  onSubmitted: () => void;
  onSkip: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsultationFormScreen({
  formCode,
  trainerId,
  onSubmitted,
  onSkip,
}: ConsultationFormScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);

  const fields = React.useMemo(() => parseFormCode(formCode), [formCode]);

  // answers[i] mirrors fields[i]
  const [answers, setAnswers] = useState<Answer[]>(() =>
    fields.map((f) => (f.type === 'listbox' ? [] : ''))
  );
  const [saving, setSaving] = useState(false);

  const setAnswer = (idx: number, value: Answer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const toggleMulti = (idx: number, option: string) => {
    const current = (answers[idx] as string[]) ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setAnswer(idx, next);
  };

  const toggleSingle = (idx: number, option: string) => {
    setAnswer(idx, (answers[idx] as string) === option ? '' : option);
  };

  const handleSubmit = async () => {
    if (!profile?.id) return;
    setSaving(true);

    const responses: ResponseEntry[] = fields.map((f, i) => ({
      label: f.label,
      type: f.type,
      answer: answers[i] ?? (f.type === 'listbox' ? [] : ''),
    }));

    try {
      const { error } = await anyClient
        .from('consultation_responses')
        .upsert({
          client_id: profile.id,
          trainer_id: trainerId,
          responses,
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'client_id,trainer_id' });

      if (error) throw error;
      onSubmitted();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el formulario. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <AppText variant="h2" color={colors.text.primary} style={s.title}>
            Formulario de consulta
          </AppText>
          <AppText variant="body14" color={colors.text.secondary} style={s.subtitle}>
            Tu entrenador necesita esta información para personalizar tu plan.
          </AppText>
        </View>

        {/* Fields */}
        {fields.map((field, idx) => (
          <View key={idx} style={s.fieldBlock}>
            <AppText variant="body16SemiBold" color={colors.text.primary} style={s.label}>
              {field.label}
            </AppText>

            {/* Multi-select (listbox) */}
            {field.type === 'listbox' && (
              <View style={s.optionGroup}>
                {(field.options ?? []).map((opt) => {
                  const selected = ((answers[idx] as string[]) ?? []).includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[s.optionRow, selected && s.optionRowSelected]}
                      onPress={() => toggleMulti(idx, opt)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.checkbox, selected && s.checkboxSelected]}>
                        {selected && <AppText variant="caps11" color={colors.background}>✓</AppText>}
                      </View>
                      <AppText
                        variant="body14"
                        color={selected ? colors.text.primary : colors.text.secondary}
                      >
                        {opt}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Single-select (dropdown) */}
            {field.type === 'dropdown' && (
              <View style={s.optionGroup}>
                {(field.options ?? []).map((opt) => {
                  const selected = (answers[idx] as string) === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[s.optionRow, selected && s.optionRowSelected]}
                      onPress={() => toggleSingle(idx, opt)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.radio, selected && s.radioSelected]}>
                        {selected && <View style={s.radioDot} />}
                      </View>
                      <AppText
                        variant="body14"
                        color={selected ? colors.text.primary : colors.text.secondary}
                      >
                        {opt}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Short text */}
            {field.type === 'textbox' && (
              <TextInput
                style={[s.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                placeholderTextColor={colors.text.tertiary}
                placeholder="Tu respuesta…"
                value={(answers[idx] as string) ?? ''}
                onChangeText={(v) => setAnswer(idx, v)}
                returnKeyType="next"
              />
            )}

            {/* Long text */}
            {field.type === 'textarea' && (
              <TextInput
                style={[s.textarea, { color: colors.text.primary, borderColor: colors.border.default }]}
                placeholderTextColor={colors.text.tertiary}
                placeholder="Tu respuesta…"
                value={(answers[idx] as string) ?? ''}
                onChangeText={(v) => setAnswer(idx, v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          </View>
        ))}

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: colors.primary.default }]}
            onPress={() => void handleSubmit()}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={colors.background} />
              : <AppText variant="body16SemiBold" color={colors.background}>Enviar formulario</AppText>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSkip} onPress={onSkip} activeOpacity={0.7}>
            <AppText variant="body14" color={colors.text.tertiary}>
              Completar más tarde
            </AppText>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: 48 },
    header: { marginBottom: spacing.xl },
    title: { marginBottom: spacing.xs },
    subtitle: { lineHeight: 20 },

    fieldBlock: {
      marginBottom: spacing.xl,
    },
    label: {
      marginBottom: spacing.sm,
      lineHeight: 22,
    },

    optionGroup: { gap: 8 },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.surface.elevated,
    },
    optionRowSelected: {
      borderColor: colors.primary.default,
      backgroundColor: `${colors.primary.default}14`,
    },

    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.primary.default,
      borderColor: colors.primary.default,
    },

    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.primary.default,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary.default,
    },

    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      fontFamily: 'System',
      backgroundColor: colors.surface.elevated,
    },
    textarea: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      fontFamily: 'System',
      backgroundColor: colors.surface.elevated,
      minHeight: 96,
    },

    actions: { gap: 12, marginTop: spacing.lg },
    btnPrimary: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    btnSkip: {
      alignItems: 'center',
      paddingVertical: 10,
    },
  });
}
