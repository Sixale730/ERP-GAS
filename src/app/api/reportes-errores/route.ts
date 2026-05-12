/**
 * API Route para reportes de error de usuarios.
 *
 * - POST   /api/reportes-errores  -> crea un nuevo reporte (cualquier usuario autenticado)
 * - GET    /api/reportes-errores  -> lista reportes (super_admin: todos, admin_cliente: su org)
 *
 * Para crear, autocompleta usuario_id / organizacion_id desde la sesion via la RPC
 * erp.reportar_error (SECURITY DEFINER). Para listar, hace SELECT directo y deja que
 * RLS filtre por rol.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ORIGENES_VALIDOS = ['manual', 'boundary', 'window_error', 'unhandled_rejection', 'api'] as const
const STATUSES_VALIDOS = ['nuevo', 'en_revision', 'resuelto', 'descartado'] as const

// ─── POST: crear reporte ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : ''
    if (descripcion.length < 5) {
      return NextResponse.json(
        { success: false, error: 'La descripcion debe tener al menos 5 caracteres' },
        { status: 400 }
      )
    }

    const origen = ORIGENES_VALIDOS.includes(body.origen) ? body.origen : 'manual'

    const { data, error } = await supabase.schema('erp').rpc('reportar_error', {
      p_descripcion_usuario: descripcion.slice(0, 5000),
      p_pasos_reproduccion: typeof body.pasos === 'string' ? body.pasos.slice(0, 3000) : null,
      p_ruta: typeof body.ruta === 'string' ? body.ruta.slice(0, 500) : null,
      p_mensaje_tecnico: typeof body.mensaje_tecnico === 'string' ? body.mensaje_tecnico.slice(0, 4000) : null,
      p_stack: typeof body.stack === 'string' ? body.stack.slice(0, 20000) : null,
      p_contexto: body.contexto ?? null,
      p_origen: origen,
      p_user_agent: typeof body.user_agent === 'string' ? body.user_agent.slice(0, 500) : null,
      p_viewport: typeof body.viewport === 'string' ? body.viewport.slice(0, 40) : null,
    })

    if (error) {
      console.error('[reportes-errores] RPC error:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Error al guardar el reporte' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data })
  } catch (err) {
    console.error('[reportes-errores] POST unexpected:', err)
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

// ─── GET: listar reportes ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const scope = searchParams.get('scope') // 'mine' | 'inbox'
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500)

    let query = supabase
      .schema('erp')
      .from('reportes_errores')
      .select(`
        id, organizacion_id, usuario_id, usuario_email, usuario_nombre, usuario_rol,
        ruta, descripcion_usuario, pasos_reproduccion, mensaje_tecnico,
        origen, status, prioridad, nota_admin, resolved_by, resolved_at,
        visto_por_reportante, visto_por_reportante_at, created_at, updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && STATUSES_VALIDOS.includes(status as typeof STATUSES_VALIDOS[number])) {
      query = query.eq('status', status)
    }

    if (scope === 'mine') {
      // Solo los reportes del usuario actual
      const { data: erpUser } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (erpUser?.id) {
        query = query.eq('usuario_id', erpUser.id)
      }
    }

    const { data, error } = await query
    if (error) {
      console.error('[reportes-errores] GET error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[reportes-errores] GET unexpected:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
