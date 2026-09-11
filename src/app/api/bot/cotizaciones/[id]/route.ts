/**
 * GET   /api/bot/cotizaciones/[ref]   Detalle de una cotizacion, por id o por folio (COT-06270)
 * PATCH /api/bot/cotizaciones/[ref]   La edita (ver src/lib/cotizaciones/editar.ts)
 *
 * Para el asistente de Telegram. Autenticacion: src/lib/bot/auth.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autenticarBot } from '@/lib/bot/auth'
import { ErrorCotizacion } from '@/lib/cotizaciones/crear'
import { editarCotizacion, type EntradaEdicion } from '@/lib/cotizaciones/editar'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El asistente puede referirse a la cotizacion por su folio o por su id. */
async function resolverId(supabase: SupabaseClient, orgId: string, ref: string): Promise<string | null> {
  const r = decodeURIComponent(ref).trim()
  if (UUID_RE.test(r)) return r
  const { data } = await supabase
    .schema('erp')
    .from('cotizaciones')
    .select('id')
    .eq('organizacion_id', orgId)
    .eq('folio', r.toUpperCase())
    .maybeSingle()
  return data?.id ?? null
}

function respuestaError(e: unknown) {
  if (e instanceof ErrorCotizacion) {
    return NextResponse.json({ success: false, error: e.message }, { status: e.status })
  }
  const msg = e instanceof Error ? e.message : 'Error desconocido'
  return NextResponse.json({ success: false, error: msg }, { status: 500 })
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sesion = await autenticarBot(request, 'cotizaciones', 'ver')
    if (sesion instanceof NextResponse) return sesion
    const { supabase, usuario } = sesion
    const erp = supabase.schema('erp')

    const id = await resolverId(supabase, usuario.organizacion_id, params.id)
    if (!id) return NextResponse.json({ success: false, error: `No encontre la cotizacion ${params.id}` }, { status: 404 })

    const { data: cot } = await erp
      .from('cotizaciones')
      .select(
        'id, folio, status, fecha, vigencia_dias, cliente_id, direccion_envio_id, moneda, tipo_cambio, ' +
          'descuento_porcentaje, subtotal, iva, total, notas, vendedor_nombre, clientes:cliente_id (nombre_comercial)',
      )
      .eq('id', id)
      .eq('organizacion_id', usuario.organizacion_id)
      .maybeSingle()
    if (!cot) return NextResponse.json({ success: false, error: 'Cotizacion no encontrada' }, { status: 404 })
    const c = cot as unknown as {
      id: string; folio: string; status: string; fecha: string; vigencia_dias: number | null
      cliente_id: string; direccion_envio_id: string | null; moneda: string | null; tipo_cambio: number | null
      descuento_porcentaje: number | null; subtotal: number; iva: number; total: number; notas: string | null
      vendedor_nombre: string | null; clientes: { nombre_comercial?: string } | null
    }

    const { data: items } = await erp
      .from('cotizacion_items')
      .select('producto_id, descripcion, cantidad, precio_unitario, subtotal, productos:producto_id (sku)')
      .eq('cotizacion_id', id)
      .order('created_at')

    let sucursal: { id: string; alias: string } | null = null
    if (c.direccion_envio_id) {
      const { data: dir } = await erp
        .from('direcciones_envio')
        .select('id, alias')
        .eq('id', c.direccion_envio_id)
        .maybeSingle()
      if (dir) sucursal = { id: dir.id, alias: (dir.alias ?? '').trim() }
    }

    return NextResponse.json({
      success: true,
      cotizacion: {
        id: c.id,
        folio: c.folio,
        status: c.status,
        editable: c.status === 'propuesta',
        fecha: c.fecha,
        vigencia_dias: c.vigencia_dias,
        cliente: { id: c.cliente_id, nombre: c.clientes?.nombre_comercial ?? null },
        sucursal,
        moneda: c.moneda,
        tipo_cambio: c.tipo_cambio === null ? null : Number(c.tipo_cambio),
        descuento_porcentaje: Number(c.descuento_porcentaje ?? 0),
        subtotal: Number(c.subtotal),
        iva: Number(c.iva),
        total: Number(c.total),
        notas: c.notas,
        vendedor: c.vendedor_nombre,
        items: (items ?? []).map((i) => ({
          producto_id: i.producto_id,
          sku: (i.productos as unknown as { sku?: string } | null)?.sku ?? null,
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
          subtotal: Number(i.subtotal),
        })),
      },
    })
  } catch (e) {
    return respuestaError(e)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sesion = await autenticarBot(request, 'cotizaciones', 'editar')
    if (sesion instanceof NextResponse) return sesion
    const { supabase, usuario } = sesion

    const id = await resolverId(supabase, usuario.organizacion_id, params.id)
    if (!id) return NextResponse.json({ success: false, error: `No encontre la cotizacion ${params.id}` }, { status: 404 })

    const body = (await request.json()) as EntradaEdicion
    const resultado = await editarCotizacion(supabase, usuario.organizacion_id, id, body, {
      id: usuario.id,
      nombre: usuario.nombre,
    })
    return NextResponse.json({ success: true, cotizacion: resultado })
  } catch (e) {
    return respuestaError(e)
  }
}
