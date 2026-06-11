import { supabase } from '../lib/supabase';

/**
 * Helpers de Supabase Storage.
 * Buckets privados (progress-photos, meal-photos): ruta {user_id}/... obligatoria por RLS.
 */

export type PrivateBucket = 'progress-photos' | 'meal-photos';
export type PublicBucket = 'avatars' | 'exercise-media' | 'food-images' | 'brand-illustrations';

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0] ?? uri;
  const ext = clean.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : 'jpg';
}

/** Sube una imagen local a un bucket privado y devuelve el path interno. */
export async function uploadPrivateImage(
  bucket: PrivateBucket,
  userId: string,
  localUri: string,
  name: string
): Promise<string> {
  const path = `${userId}/${name}.${extensionOf(localUri)}`;
  const body = await uriToArrayBuffer(localUri);
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Sube el avatar al bucket público y devuelve la URL pública. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/avatar.${extensionOf(localUri)}`;
  const body = await uriToArrayBuffer(localUri);
  const { error } = await supabase.storage.from('avatars').upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Genera una URL firmada temporal para un asset de bucket privado. */
export async function signedUrl(bucket: PrivateBucket, path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
