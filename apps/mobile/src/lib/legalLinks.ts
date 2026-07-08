import * as WebBrowser from 'expo-web-browser';
import { APP_TERMS_URL } from '@reset-fitness/shared';

export function openTermsAndConditions(): void {
  void WebBrowser.openBrowserAsync(APP_TERMS_URL);
}
