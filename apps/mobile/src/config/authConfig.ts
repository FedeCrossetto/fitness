/**
 * OAuth / Sign In with Apple.
 * Apple queda deshabilitado en UI hasta que el entrenador active Apple Developer
 * y configure Supabase (ver docs/TRAINER_OAUTH_SETUP.md).
 */
export const isAppleSignInEnabled =
  process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

/** Titular del producto — cuentas Apple/Google/Store deben usar este correo. */
export const productOwnerEmail = 'pmenosvmas@gmail.com';
