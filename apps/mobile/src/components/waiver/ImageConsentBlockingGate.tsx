import React from 'react';
import { Modal, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlowGradientBanner } from '../common';
import { ImageConsentScreen } from '../../screens/waiver/ImageConsentScreen';
import { useTranslation } from '../../stores/i18nStore';
import { authColors } from '../../screens/auth/authScreenTheme';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlowGradientBanner
        icon={<Ionicons name="images" size={20} color={authColors.lima} />}
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
    </View>
  );
}

export function ImageConsentBlockingGate({ config, trainerId, onAccepted, onSkip }: Props): React.JSX.Element {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor={authColors.background} />
      <SafeAreaProvider>
        <ImageConsentGateContent config={config} trainerId={trainerId} onAccepted={onAccepted} onSkip={onSkip} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },
});
