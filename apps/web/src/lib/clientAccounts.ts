import { supabase } from '@/lib/supabase';

export type DeleteClientResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteClientAccount(clientId: string): Promise<DeleteClientResult> {
  const { error } = await supabase.rpc('delete_client_account', {
    p_client_id: clientId,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('not_authenticated')) return { ok: false, message: 'Sesión expirada. Volvé a iniciar sesión.' };
    if (msg.includes('forbidden')) return { ok: false, message: 'No tenés permiso para eliminar este cliente.' };
    if (msg.includes('client_not_found')) return { ok: false, message: 'Cliente no encontrado.' };
    if (msg.includes('cannot_delete_non_client')) return { ok: false, message: 'Solo se pueden eliminar cuentas de alumnos.' };
    if (msg.includes('cannot_delete_self')) return { ok: false, message: 'No podés eliminar tu propia cuenta desde aquí.' };
    return { ok: false, message: 'No se pudo eliminar el cliente. Intentá de nuevo.' };
  }

  return { ok: true };
}
