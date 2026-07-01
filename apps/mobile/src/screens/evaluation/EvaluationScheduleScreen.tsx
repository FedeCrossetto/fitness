import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { LIMA } from '../auth/formFields';

// TODO: reemplazar si cambia el link de Calendly del coach.
const CALENDLY_URL = 'https://calendly.com/r3set-method/30min';

// Calendly emite eventos por postMessage al iframe/WebView embebido (event_type_viewed,
// date_and_time_selected, event_scheduled). Los reenviamos a React Native para saber
// cuándo terminó de agendar sin depender de que el usuario "cierre" nada — con un
// WebView embebido no hay un gesto de cierre equivalente al del navegador in-app.
const INJECTED_JS = `
  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.event === 'string' && e.data.event.indexOf('calendly.') === 0) {
      window.ReactNativeWebView.postMessage(e.data.event);
    }
  });
  true;
`;

interface EvaluationScheduleScreenProps {
  onBack: () => void;
  onDone: () => void;
}

/** Agendar la llamada 1-1 de evaluación con Calendly embebido en la pantalla. */
export function EvaluationScheduleScreen({ onBack, onDone }: EvaluationScheduleScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const onMessage = (event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === 'calendly.event_scheduled') {
      onDone();
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing.md }]}>
        <IconButton
          icon="chevron-back"
          onPress={onBack}
          accessibilityLabel="Volver"
          color={authColors.textPrimary}
          backgroundColor={authColors.surface}
          style={styles.backBtn}
        />
        <AppText variant="h2" color={authColors.textPrimary} style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          AGENDÁ TU LLAMADA
        </AppText>
      </View>
      <AppText variant="body13" color={authColors.textSecondary} style={styles.hint}>
        Elegí un horario que te quede cómodo para la llamada donde revisamos tu caso.
      </AppText>

      <View style={styles.webviewWrap}>
        <WebView
          source={{ uri: CALENDLY_URL }}
          injectedJavaScript={INJECTED_JS}
          onMessage={onMessage}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          style={styles.webview}
        />
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={LIMA} size="large" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  backBtn: { borderColor: authColors.border, flexShrink: 0 },
  title: { flex: 1, letterSpacing: -0.5 },
  hint: { paddingHorizontal: spacing.xl, marginBottom: spacing.md, lineHeight: 18 },

  webviewWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: authColors.background },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.background,
  },
});
