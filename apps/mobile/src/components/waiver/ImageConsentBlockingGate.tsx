import React from 'react';
import { Modal, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { FlowBackdrop, FlowGradientBanner } from '../common';
import { ImageConsentScreen } from '../../screens/waiver/ImageConsentScreen';
import { useTranslation } from '../../stores/i18nStore';

interface ImageConsentConfig {
  title: string;
  body: string;
}

interface Props {
  config: ImageConsentConfig;
  trainerId: string;
  onAccepted: () => void;
  onSkip?: () => void;
}

function ImageConsentGateContent({ config, trainerId, onAccepted, onSkip }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <FlowBackdrop style={[styles.root, { paddingTop: insets.top }]}>
      <FlowGradientBanner
        icon={<Ionicons name="images" size={20} color={colors.primary.default} />}
        title={t.image_consent.banner_title}
        body={t.image_consent.banner_body}
      />
      <ImageConsentScreen
        config={config}
        trainerId={trainerId}
        onAccepted={onAccepted}
        onSkip={onSkip}
        embedded
        bottomInset={insets.bottom}
      />
    </FlowBackdrop>
  );
}

export function ImageConsentBlockingGate({ config, trainerId, onAccepted, onSkip }: Props): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <SafeAreaProvider>
        <ImageConsentGateContent config={config} trainerId={trainerId} onAccepted={onAccepted} onSkip={onSkip} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
