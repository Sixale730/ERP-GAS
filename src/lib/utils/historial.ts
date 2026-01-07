import { getSupabaseClient } from '@/lib/supabase/client'

export type DocumentoTipo = 'cotizacion' | 'orden_compra' | 'orden_venta' | 'factura'
export type AccionTipo = 'creado' | 'editado' | 'status_cambiado' | 'cancelado' | 'convertido'

interface RegistrarHistorialParams {
  documentoTipo: DocumentoTipo
  documentoId: string
  documentoFolio?: string
  usuarioId?: string
  usuarioNombre?: string
  accion: AccionTipo
  descripcion?: string
  datosAnteriores?: Record<string, unknown>
  datosNuevos?: Record<string, unknown>
}

/**
 * Registra un movimiento en el historial de documentos
 */
export async function registrarHistorial({
  documentoTipo,
  documentoId,
  documentoFolio,
  usuarioId,
  usuarioNombre,
  accion,
  descripcion,
  datosAnteriores,
  datosNuevos,
}: RegistrarHistorialParams): Promise<void> {
  const supabase = getSupabaseClient()

  try {
    const { error } = await supabase
      .schema('erp')
      .from('historial_documentos')
      .insert({
        documento_tipo: documentoTipo,
        documento_id: documentoId,
        documento_folio: documentoFolio,
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre,
        accion,
        descripcion,
        datos_anteriores: datosAnteriores,
        datos_nuevos: datosNuevos,
      })

    if (error) {
      console.error('[Historial] Error al registrar:', error)
    }
  } catch (err) {
    console.error('[Historial] Exception:', err)
  }
}

/**
 * Genera una descripción automática basada en la acción
 */
export function generarDescripcion(accion: AccionTipo, extras?: string): string {
  const descripciones: Record<AccionTipo, string> = {
    creado: 'Documento creado',
    editado: 'Documento editado',
    status_cambiado: 'Estado cambiado',
    cancelado: 'Documento cancelado',
    convertido: 'Documento convertido',
  }

  return extras ? `${descripciones[accion]}: ${extras}` : descripciones[accion]
}
