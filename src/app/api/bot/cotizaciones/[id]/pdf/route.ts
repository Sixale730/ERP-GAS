/**
 * GET /api/bot/cotizaciones/[id]/pdf
 *
 * Devuelve el PDF de una cotizacion, el mismo que descarga la web.
 * Lo usa el asistente para mandartelo por Telegram o adjuntarlo a un correo.
 *
 * Autenticacion: Bearer con el JWT del usuario del bot, igual que las otras
 * rutas de /api/bot. Aplican RLS y permisos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import { generarPDFCotizacionBytes, type CotizacionPDF } from '@/lib/utils/pdf'
import type { CodigoMoneda } from '@/lib/config/moneda'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = request.headers.get('authorization') ?? ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
    if (!token) return NextResponse.json({ success: false, error: 'Falta el token' }, { status: 401 })

    const supabase = clienteConToken(token)
    const { data: { user }, error: errUser } = await supabase.auth.getUser()
    if (errUser || !user) {
      return NextResponse.json({ success: false, error: 'Token invalido o expirado' }, { status: 401 })
    }

    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, rol, permisos, organizacion_id, is_active')
      .eq('auth_user_id', user.id)
      .single()
    if (!erpUser || !erpUser.is_active) {
      return NextResponse.json({ success: false, error: 'Usuario no autorizado' }, { status: 403 })
    }

    const { getPermisosEfectivos } = await import('@/lib/permisos')
    const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
    if (!permisos.cotizaciones?.ver) {
      return NextResponse.json({ success: false, error: 'Sin permisos para ver cotizaciones' }, { status: 403 })
    }

    const erp = supabase.schema('erp')

    const { data: cot, error: errCot } = await erp
      .from('cotizaciones')
      .select('*, clientes:cliente_id (nombre_comercial, rfc)')
      .eq('id', params.id)
      .eq('organizacion_id', erpUser.organizacion_id)
      .single()
    if (errCot || !cot) {
      return NextResponse.json({ success: false, error: 'Cotizacion no encontrada' }, { status: 404 })
    }

    const { data: items, error: errItems } = await erp
      .from('cotizacion_items')
      .select('descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, productos:producto_id (sku)')
      .eq('cotizacion_id', params.id)
      .order('created_at')
    if (errItems) {
      return NextResponse.json({ success: false, error: 'Error al leer las partidas' }, { status: 500 })
    }

    const cliente = cot.clientes as unknown as { nombre_comercial?: string; rfc?: string | null } | null

    const datos: CotizacionPDF = {
      folio: cot.folio,
      fecha: cot.fecha,
      fecha_vencimiento: dayjs(cot.fecha).add(cot.vigencia_dias ?? 30, 'day').format('YYYY-MM-DD'),
      cliente_nombre: cliente?.nombre_comercial ?? 'Cliente',
      cliente_rfc: cliente?.rfc ?? null,
      subtotal: Number(cot.subtotal ?? 0),
      descuento_porcentaje: Number(cot.descuento_porcentaje ?? 0),
      descuento_monto: Number(cot.descuento_monto ?? 0),
      iva: Number(cot.iva ?? 0),
      total: Number(cot.total ?? 0),
      notas: cot.notas,
      vendedor_nombre: cot.vendedor_nombre,
      atencion: cot.atencion,
      condiciones_pago: cot.condiciones_pago,
      moneda: cot.moneda,
    }

    const partidas = (items ?? []).map((i) => {
      const prod = i.productos as unknown as { sku?: string } | null
      return {
        sku: prod?.sku,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        descuento_porcentaje: Number(i.descuento_porcentaje ?? 0),
        subtotal: Number(i.subtotal),
      }
    })

    const bytes = await generarPDFCotizacionBytes(datos, partidas, {
      moneda: (cot.moneda as CodigoMoneda) || 'MXN',
      tipoCambio: cot.tipo_cambio ?? undefined,
    })

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cot.folio}.pdf"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
