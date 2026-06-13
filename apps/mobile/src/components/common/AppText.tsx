import React from 'react';
import { Text, TextProps, TextStyle, StyleProp } from 'react-native';
import { typography, TypographyVariant, useTheme } from '../../theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

export function AppText({
  variant = 'body14',
  color,
  align,
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[
        typography[variant],
        { color: color ?? colors.text.primary },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
