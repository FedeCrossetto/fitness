import type { ResetFitnessClient } from '../supabase/client';

interface MirrorInput {
  /** avatar_url actual del perfil (path de storage o URL externa o null). */
  stored: string | null | undefined;
  /** user_metadata de la sesión OAuth; de ahí sale la foto del proveedor. */
  userMetadata?: Record<string, unknown> | null;
}

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && (value.startsWith('http://') || value.startsWith('https://'));
}

/** Path versionado propio: avatar-<timestamp>.ext. Su URL es única por contenido. */
function isVersionedPath(value: string | null): value is string {
  return !!value && !isHttpUrl(value) && /\/avatar-\d+\.(png|jpe?g)$/i.test(value);
}

/**
 * Asegura que el perfil tenga una foto utilizable tras un login OAuth, y la
 * persiste de forma permanente en el bucket "avatars" con nombre versionado.
 *
 * Un path versionado ya subido es de confianza (su URL es única por contenido,
 * así que ningún cache muestra una versión vieja o rota) y se devuelve sin tocar
 * la red. Cualquier otro estado —URL del proveedor, path legacy de nombre fijo o
 * vacío— se (re)construye desde la foto del proveedor OAuth. Si la subida falla,
 * deja la URL del proveedor en la DB (mobile <Image> y web <img> la cargan sin
 * problema de CORS).
 *
 * Nunca lanza. Devuelve el avatar_url final o null.
 */
export async function mirrorOAuthAvatar(
  client: ResetFitnessClient,
  userId: string,
  { stored, userMetadata }: MirrorInput,
): Promise<string | null> {
  const storedVal = stored?.trim() || null;
  if (isVersionedPath(storedVal)) return storedVal;

  // Origen para (re)construir: la foto del proveedor (Google/Apple en
  // user_metadata) o el propio stored si ya era una URL http.
  const providerUrl =
    (userMetadata?.avatar_url as string | undefined) ??
    (userMetadata?.picture as string | undefined) ??
    null;
  const source = providerUrl?.trim() || (isHttpUrl(storedVal) ? storedVal : null);
  if (!source) return storedVal;

  // Persistir la URL del proveedor de inmediato (garantiza que se vea ya).
  try {
    await client.from('profiles').update({ avatar_url: source }).eq('id', userId);
  } catch {
    // seguimos al intento de subida
  }

  // Best-effort: subir a storage para permanencia.
  try {
    const response = await fetch(source);
    if (!response.ok) return source;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return source;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(path, buffer, { upsert: true, contentType });
    if (uploadError) return source;

    await client.from('profiles').update({ avatar_url: path }).eq('id', userId);
    return path;
  } catch {
    return source; // queda la URL del proveedor, que igual se muestra
  }
}
