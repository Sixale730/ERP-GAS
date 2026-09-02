/**
 * GET /api/bot/buscar?tipo=producto|cliente&q=texto[&cliente_id=uuid]
 *
 * Busqueda para el asistente de Telegram.
 *
 * Devuelve SIEMPRE todas las coincidencias (hasta el limite), nunca "la mejor".
 * Es a proposito: el modelo no debe elegir SKU por su cuenta. Si hay mas de una
 * coincidencia, la herramienta del bot esta obligada a preguntarle a Jose.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CodigoMoneda } from '@/lib/config/moneda'

export const dynamic = 'force-dynamic'

const LIMITE = 15

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

export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams
    const tipo = sp.get('tipo')
    const q = (sp.get('q') ?? '').trim()
    if (q.length < 2) {
      return NextResponse.json({ success: false, error: 'Escribe al menos 2 caracteres' }, { status: 400 })
    }

    const erp = supabase.schema('erp')
    const orgId = erpUser.organizacion_id
    const patron = `%${q}%`

    // ---------------------------------------------------------------- CLIENTES
    if (tipo === 'cliente') {
      const { data, error } = await erp
        .from('clientes')
        .select('id, codigo, nombre_comercial, razon_social, rfc, lista_precio_id, dias_credito, saldo_pendiente')
        .eq('organizacion_id', orgId)
        .eq('is_active', true)
        .or(`nombre_comercial.ilike.${patron},razon_social.ilike.${patron},codigo.ilike.${patron},rfc.ilike.${patron}`)
        .order('nombre_comercial')
        .limit(LIMITE)
      if (error) throw error

      const ids = Array.from(
        new Set((data ?? []).map((c) => c.lista_precio_id).filter(Boolean)),
      ) as string[]
      const nombreLista = new Map<string, string>()
      if (ids.length) {
        const { data: listas } = await erp.from('listas_precios').select('id, nombre').in('id', ids)
        for (const l of listas ?? []) nombreLista.set(l.id, l.nombre)
      }

      return NextResponse.json({
        success: true,
        tipo: 'cliente',
        total: data?.length ?? 0,
        resultados: (data ?? []).map((c) => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre_comercial,
          razon_social: c.razon_social,
          rfc: c.rfc,
          dias_credito: c.dias_credito,
          saldo_pendiente: Number(c.saldo_pendiente ?? 0),
          lista_precio: c.lista_precio_id
            ? nombreLista.get(c.lista_precio_id) ?? 'desconocida'
            : 'sin asignar (usara Publico General)',
        })),
      })
    }

    // --------------------------------------------------------------- PRODUCTOS
    if (tipo === 'producto') {
      const { data: productos, error } = await erp
        .from('productos')
        .select('id, sku, nombre, unidad_medida, es_servicio')
        .eq('organizacion_id', orgId)
        .eq('is_active', true)
        .or(`nombre.ilike.${patron},sku.ilike.${patron}`)
        .order('nombre')
        .limit(LIMITE)
      if (error) throw error
      const lista = productos ?? []
      if (!lista.length) {
        return NextResponse.json({ success: true, tipo: 'producto', total: 0, resultados: [] })
      }

      const ids = lista.map((p) => p.id)

      // Lista de precios: la del cliente si viene, si no la default de la org.
      let listaPrecioId: string | null = null
      const clienteId = sp.get('cliente_id')
      if (clienteId) {
        const { data: cli } = await erp
          .from('clientes').select('lista_precio_id').eq('id', clienteId).maybeSingle()
        listaPrecioId = cli?.lista_precio_id ?? null
      }
      if (!listaPrecioId) {
        const { data: def } = await erp
          .from('listas_precios').select('id')
          .eq('organizacion_id', orgId).eq('is_default', true).eq('is_active', true)
          .limit(1).maybeSingle()
        listaPrecioId = def?.id ?? null
      }

      const precioDe = new Map<string, { precio: number; moneda: CodigoMoneda }>()
      if (listaPrecioId) {
        const { data: precios } = await erp
          .from('precios_productos').select('producto_id, precio, moneda')
          .eq('lista_precio_id', listaPrecioId).in('producto_id', ids)
        for (const p of precios ?? []) {
          precioDe.set(p.producto_id, { precio: Number(p.precio), moneda: (p.moneda || 'USD') as CodigoMoneda })
        }
      }

      const stockDe = new Map<string, { fisico: number; disponible: number; en_transito: number }>()
      const { data: stock } = await erp
        .from('v_productos_stock')
        .select('id, stock_total, disponible_total, en_transito_total')
        .in('id', ids)
      for (const s of stock ?? []) {
        stockDe.set(s.id, {
          fisico: Number(s.stock_total ?? 0),
          disponible: Number(s.disponible_total ?? 0),
          en_transito: Number(s.en_transito_total ?? 0),
        })
      }

      return NextResponse.json({
        success: true,
        tipo: 'producto',
        total: lista.length,
        truncado: lista.length === LIMITE,
        resultados: lista.map((p) => {
          const pr = precioDe.get(p.id)
          const st = stockDe.get(p.id)
          return {
            id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            unidad: p.unidad_medida,
            es_servicio: p.es_servicio,
            precio: pr?.precio ?? null,
            moneda: pr?.moneda ?? null,
            sin_precio: !pr,
            stock_fisico: p.es_servicio ? null : st?.fisico ?? 0,
            disponible: p.es_servicio ? null : st?.disponible ?? 0,
            en_transito: p.es_servicio ? null : st?.en_transito ?? 0,
          }
        }),
      })
    }

    return NextResponse.json({ success: false, error: 'tipo debe ser "producto" o "cliente"' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
