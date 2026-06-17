import { useEffect } from 'react';
import { Linking } from 'react-native';
import { parseInviteCodeFromUrl, savePendingInviteCode } from '../services/invite';

/** Guarda el código de invitación si la app se abrió desde un link. */
export function useInviteDeepLink(): void {
  useEffect(() => {
    const handle = (url: string) => {
      const code = parseInviteCodeFromUrl(url);
      if (code) void savePendingInviteCode(code);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}
