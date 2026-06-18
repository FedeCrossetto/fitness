import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

/**
 * Helpers de Supabase Storage.
 * Buckets privados (progress-photos, meal-photos): ruta {user_id}/... obligatoria por RLS.
 */

export type PrivateBucket = 'progress-photos' | 'meal-photos';
export type PublicBucket = 'avatars' | 'exercise-media' | 'food-images' | 'brand-illustrations';

/**
 * Lee un archivo local (file://) como bytes. En RN/Expo `fetch(uri).arrayBuffer()`
 * suele devolver un buffer vacío → subía archivos de 0 bytes. La API `File` de
 * expo-file-system lee el contenido real.
 */
async function uriToBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0] ?? uri;
  const ext = clean.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : 'jpg';
}

function contentTypeOf(ext: string): string {
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic':
    case 'heif': return 'image/heic';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'image/jpeg';
  }
}

/** Sube una imagen local a un bucket privado y devuelve el path interno. */
export async function uploadPrivateImage(
  bucket: PrivateBucket,
  userId: string,
  localUri: string,
  name: string
): Promise<string> {
  const ext = extensionOf(localUri);
  const path = `${userId}/${name}.${ext}`;
  const body = await uriToBytes(localUri);
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: contentTypeOf(ext),
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Sube el avatar al bucket público y devuelve la URL pública. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = extensionOf(localUri);
  const path = `${userId}/avatar.${ext}`;
  const body = await uriToBytes(localUri);
  const { error } = await supabase.storage.from('avatars').upload(path, body, {
    contentType: contentTypeOf(ext),
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Elimina un asset de un bucket privado. */
export async function deletePrivateImage(bucket: PrivateBucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}

/** Genera una URL firmada temporal para un asset de bucket privado. */
export async function signedUrl(bucket: PrivateBucket, path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
