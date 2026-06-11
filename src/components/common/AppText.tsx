import React from 'react';
import { Text, TextProps, TextStyle, StyleProp } from 'react-native';
import { colors, typography, TypographyVariant } from '../../theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

export function AppText({
  variant = 'body14',
  color = colors.text.primary,
  align,
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
