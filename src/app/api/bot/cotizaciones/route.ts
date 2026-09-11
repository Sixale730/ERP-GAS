/**
 * POST /api/bot/cotizaciones
 *
 * Crea una cotizacion desde el asistente de Telegram.
 *
 * Autenticacion: Bearer con el JWT de un usuario de Supabase (el usuario
 * dedicado del bot). No se usa service_role: el token viaja al cliente de
 * Supabase para que apliquen RLS y los permisos del usuario, igual que en la web.
 *
 * Usa la misma logica que /cotizaciones/nueva (src/lib/cotizaciones), para que
 * la web y el bot no puedan calcular precios distintos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { crearCotizacion, ErrorCotizacion, type EntradaCotizacion } from '@/lib/cotizaciones/crear'
import { autenticarBot } from '@/lib/bot/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bot/cotizaciones?cliente_id=uuid[&limite=5]
 *
 * Las ultimas cotizaciones de un cliente, para que el asistente le pregunte a
 * Jose cual quiere corregir cuando no le dice el folio.
 */
export async function GET(request: NextRequest) {
  try {
    const sesion = await autenticarBot(request, 'cotizaciones', 'ver')
    if (sesion instanceof NextResponse) return sesion
    const { supabase, usuario } = sesion

    const sp = request.nextUrl.searchParams
    const clienteId = sp.get('cliente_id')
    if (!clienteId) return NextResponse.json({ success: false, error: 'Falta cliente_id' }, { status: 400 })
    const limite = Math.min(Math.max(Number(sp.get('limite')) || 5, 1), 20)

    const erp = supabase.schema('erp')
    const { data, error } = await erp
      .from('cotizaciones')
      .select('id, folio, fecha, status, total, moneda, direccion_envio_id')
      .eq('organizacion_id', usuario.organizacion_id)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error

    const dirIds = Array.from(new Set((data ?? []).map((c) => c.direccion_envio_id).filter(Boolean))) as string[]
    const alias = new Map<string, string>()
    if (dirIds.length) {
      const { data: dirs } = await erp.from('direcciones_envio').select('id, alias').in('id', dirIds)
      for (const d of dirs ?? []) alias.set(d.id, (d.alias ?? '').trim())
    }

    return NextResponse.json({
      success: true,
      total: data?.length ?? 0,
      resultados: (data ?? []).map((c) => ({
        id: c.id,
        folio: c.folio,
        fecha: c.fecha,
        status: c.status,
        editable: c.status === 'propuesta',
        total: Number(c.total),
        moneda: c.moneda,
        sucursal: c.direccion_envio_id ? alias.get(c.direccion_envio_id) ?? null : null,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

function clienteConToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') ?? ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
    if (!token) {
      return NextResponse.json({ success: false, error: 'Falta el token' }, { status: 401 })
    }

    const supabase = clienteConToken(token)

    const { data: { user }, error: errUser } = await supabase.auth.getUser()
    if (errUser || !user) {
      return NextResponse.json({ success: false, error: 'Token invalido o expirado' }, { status: 401 })
    }

    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, nombre, rol, permisos, organizacion_id, is_active')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser || !erpUser.is_active) {
      return NextResponse.json({ success: false, error: 'Usuario no autorizado' }, { status: 403 })
    }

    const { getPermisosEfectivos } = await import('@/lib/permisos')
    const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
    if (!permisos.cotizaciones?.crear) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para crear cotizaciones' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as EntradaCotizacion & { vendedor_nombre?: string }

    const resultado = await crearCotizacion(
      supabase,
      erpUser.organizacion_id,
      // La cotizacion sale a nombre del vendedor que se indique (normalmente Jose);
      // el registro de quien la creo queda en el usuario autenticado.
      { id: erpUser.id, nombre: body.vendedor_nombre?.trim() || erpUser.nombre },
      body,
    )

    return NextResponse.json({ success: true, cotizacion: resultado })
  } catch (e) {
    if (e instanceof ErrorCotizacion) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
