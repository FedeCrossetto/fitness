import React from 'react';
import { Modal, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { FlowBackdrop, FlowGradientBanner } from '../common';
import { WaiverScreen } from '../../screens/waiver/WaiverScreen';
import { useTranslation } from '../../stores/i18nStore';

interface WaiverConfig {
  title: string;
  body: string;
  require_before_start: boolean;
}

interface Props {
  config: WaiverConfig;
  trainerId: string;
  onSigned: () => void;
}

function WaiverGateContent({ config, trainerId, onSigned }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <FlowBackdrop style={[styles.root, { paddingTop: insets.top }]}>
      <FlowGradientBanner
        icon={<Ionicons name="document-text" size={20} color={colors.primary.default} />}
        title={t.waiver.banner_title}
        body={t.waiver.banner_body}
      />
      <WaiverScreen
        config={config}
        trainerId={trainerId}
        onSigned={onSigned}
        embedded
        bottomInset={insets.bottom}
      />
    </FlowBackdrop>
  );
}

export function WaiverBlockingGate({ config, trainerId, onSigned }: Props): React.JSX.Element {
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
        <WaiverGateContent config={config} trainerId={trainerId} onSigned={onSigned} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
