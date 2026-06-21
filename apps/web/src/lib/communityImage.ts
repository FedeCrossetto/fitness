import { supabase } from '@/lib/supabase';

export async function uploadCommunityAvatar(
  trainerId: string,
  communityId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${trainerId}/communities/${communityId}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
