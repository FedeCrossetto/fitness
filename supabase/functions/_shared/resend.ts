// Helper compartido para mandar mails vía la API HTTP de Resend — usado por las
// funciones de auth "custom" (reset de contraseña, código de verificación) que
// bypasean el mailer de Supabase (Custom SMTP pide plan Pro en este proyecto).
//
// Secrets requeridos: RESEND_API_KEY, RESEND_FROM_EMAIL (ej. "R3SET <noreply@alegerezcoach.com>")

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) {
    console.error('[resend] faltan RESEND_API_KEY / RESEND_FROM_EMAIL');
    return { ok: false, error: 'email_not_configured' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    console.error('[resend] error enviando mail:', resp.status, detail);
    return { ok: false, error: 'send_failed' };
  }
  return { ok: true };
}

/** Hash SHA-256 en hex — para no guardar tokens/códigos en texto plano. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Código numérico de `length` dígitos, criptográficamente aleatorio. */
export function randomDigitCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => String(b % 10)).join('');
}
