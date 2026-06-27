import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={36} color="#ef4444" />
        <AppText variant="body16SemiBold" color="#1a1a1a" style={styles.title}>
          {this.props.fallbackLabel ?? 'Algo salió mal'}
        </AppText>
        {__DEV__ ? (
          <AppText variant="body12" color="#666" style={styles.detail} numberOfLines={4}>
            {this.state.message}
          </AppText>
        ) : null}
        <Pressable onPress={this.reset} style={styles.btn}>
          <AppText variant="body13SemiBold" color="#fff">
            Reintentar
          </AppText>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: { textAlign: 'center' },
  detail: { textAlign: 'center', opacity: 0.6 },
  btn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
