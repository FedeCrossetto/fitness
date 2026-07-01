import React from 'react';
import { Modal, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlowGradientBanner } from '../common';
import { WaiverScreen } from '../../screens/waiver/WaiverScreen';
import { useTranslation } from '../../stores/i18nStore';
import { authColors } from '../../screens/auth/authScreenTheme';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlowGradientBanner
        icon={<Ionicons name="document-text" size={20} color={authColors.lima} />}
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
    </View>
  );
}

export function WaiverBlockingGate({ config, trainerId, onSigned }: Props): React.JSX.Element {
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
        <WaiverGateContent config={config} trainerId={trainerId} onSigned={onSigned} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },
});
