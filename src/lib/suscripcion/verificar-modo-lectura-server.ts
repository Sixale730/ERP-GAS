/**
 * Helper server-side para verificar modo lectura desde endpoints API.
 *
 * Llama a la RPC public.verificar_modo_lectura(p_accion) que retorna VOID
 * o lanza excepcion P0001 si la accion esta bloqueada.
 *
 * Si la RPC lanza excepcion, devuelve un objeto con error para que el
 * endpoint responda con 403 sin tener que abrir try/catch.
 *
 * super_admin queda siempre exento (manejado dentro de la RPC).
 */

export type ModoLecturaAccion =
  | 'crear'
  | 'editar'
  | 'timbrar'
  | 'pagos'
  | 'ajustes'
  | 'descargar_pdf'
  | 'exportar_excel'
  | 'config'

export interface ModoLecturaCheckResult {
  bloqueado: boolean
  mensaje: string | null
}

/**
 * Acepta cualquier SupabaseClient (cliente o server). El parametro es 'any'
 * porque el cliente server esta tipado con schema 'erp' por default y no
 * encaja con el SupabaseClient<any> generico.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verificarModoLecturaServer(
  supabase: any,
  accion: ModoLecturaAccion
): Promise<ModoLecturaCheckResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('verificar_modo_lectura', {
    p_accion: accion,
  })
  if (!error) {
    return { bloqueado: false, mensaje: null }
  }
  const msg = String(error.message ?? '')
  if (msg.includes('SUSCRIPCION_MODO_LECTURA')) {
    return {
      bloqueado: true,
      mensaje:
        'La suscripcion del ERP esta en modo solo lectura. No es posible realizar esta accion. Contacta al administrador para confirmar el pago.',
    }
  }
  // Otro error de la RPC: lo dejamos pasar como bloqueo defensivo.
  return { bloqueado: true, mensaje: msg || 'Error al verificar suscripcion' }
}
