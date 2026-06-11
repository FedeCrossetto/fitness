import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, layout } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  icon,
  secureTextEntry,
  containerStyle,
  ...rest
}: InputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          error ? styles.errored : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.text.tertiary} /> : null}
        <TextInput
          placeholderTextColor={colors.text.disabled}
          selectionColor={colors.primary.default}
          style={styles.input}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secureTextEntry ? (
          <IconButton
            icon={hidden ? 'eye-outline' : 'eye-off-outline'}
            onPress={() => setHidden((v) => !v)}
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            backgroundColor="transparent"
            size={18}
            color={colors.text.tertiary}
            style={styles.eyeButton}
          />
        ) : null}
      </View>
      {error ? (
        <AppText variant="body12" color={colors.states.error} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  focused: { borderColor: colors.primary.default },
  errored: { borderColor: colors.states.error },
  input: {
    flex: 1,
    ...typography.body16,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  eyeButton: { borderWidth: 0, width: 36, height: 36 },
  error: { marginTop: spacing.xxs },
});
