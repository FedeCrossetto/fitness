import React from 'react';
import { Modal, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing } from '../../theme';
import { AppText } from '../common';
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
}

function ImageConsentGateContent({ config, trainerId, onAccepted }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.banner, { backgroundColor: colors.primary.default }]}>
        <View style={styles.bannerIcon}>
          <Ionicons name="images" size={20} color="#0C0C0C" />
        </View>
        <View style={styles.bannerText}>
          <AppText variant="body14SemiBold" color="#0C0C0C">
            {t.image_consent.banner_title}
          </AppText>
          <AppText variant="body13" color="#0C0C0C" style={styles.bannerSub}>
            {t.image_consent.banner_body}
          </AppText>
        </View>
      </View>
      <ImageConsentScreen
        config={config}
        trainerId={trainerId}
        onAccepted={onAccepted}
        embedded
        bottomInset={insets.bottom}
      />
    </View>
  );
}

export function ImageConsentBlockingGate({ config, trainerId, onAccepted }: Props): React.JSX.Element {
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
        <ImageConsentGateContent config={config} trainerId={trainerId} onAccepted={onAccepted} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1 },
  bannerSub: { marginTop: 2, opacity: 0.88, lineHeight: 18 },
});
