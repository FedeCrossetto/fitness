import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_marketing_shown';

// ── Set to true to restore normal persistence behaviour before shipping ────────
const DEV_ALWAYS_SHOW = true;

/**
 * Returns whether the marketing slider has already been seen.
 *
 * null  = still reading AsyncStorage (show loading overlay)
 * false = first time → show slider
 * true  = already logged in once → skip slider
 *
 * While DEV_ALWAYS_SHOW is true the slider appears on every cold start
 * regardless of AsyncStorage, so the team can keep iterating on the design.
 */
export function useMarketingSlider(): {
  sliderDone: boolean | null;
  markSliderDone: () => Promise<void>;
} {
  const [sliderDone, setSliderDone] = useState<boolean | null>(
    DEV_ALWAYS_SHOW ? false : null,
  );

  useEffect(() => {
    if (DEV_ALWAYS_SHOW) return;
    AsyncStorage.getItem(KEY)
      .then((val) => setSliderDone(val === 'true'))
      .catch(() => setSliderDone(false));
  }, []);

  const markSliderDone = async (): Promise<void> => {
    if (!DEV_ALWAYS_SHOW) await AsyncStorage.setItem(KEY, 'true');
    setSliderDone(true);
  };

  return { sliderDone, markSliderDone };
}
