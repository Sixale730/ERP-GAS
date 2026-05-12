/**
 * PATCH /api/reportes-errores/[id]
 *
 * Permite:
 *  - Al admin (super_admin / admin_cliente): cambiar status, nota, prioridad
 *  - Al propio reportante: marcar como visto (action=marcar_visto)
 *
 * Ambas acciones delegan a RPCs SECURITY DEFINER que validan los permisos.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const STATUSES_VALIDOS = ['nuevo', 'en_revision', 'resuelto', 'descartado'] as const
const PRIORIDADES_VALIDAS = ['baja', 'normal', 'alta', 'critica'] as const

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Se requiere el id del reporte' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action

    if (action === 'marcar_visto') {
      const { error } = await supabase.schema('erp').rpc('marcar_reporte_visto', { p_reporte_id: id })
      if (error) {
        console.error('[reportes-errores/marcar_visto]', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    // Default: actualizar status / nota / prioridad
    const status = body.status
    if (!status || !STATUSES_VALIDOS.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status invalido' }, { status: 400 })
    }
    const prioridad = body.prioridad && PRIORIDADES_VALIDAS.includes(body.prioridad) ? body.prioridad : null
    const nota = typeof body.nota_admin === 'string' ? body.nota_admin.slice(0, 5000) : null

    const { error } = await supabase.schema('erp').rpc('actualizar_status_reporte_error', {
      p_reporte_id: id,
      p_status: status,
      p_nota_admin: nota,
      p_prioridad: prioridad,
    })

    if (error) {
      console.error('[reportes-errores/PATCH]', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[reportes-errores PATCH] unexpected:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
