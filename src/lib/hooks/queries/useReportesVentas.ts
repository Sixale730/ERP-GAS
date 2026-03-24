import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchDescripcionesFacturas } from './useReportesHelpers'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VentaPorClienteRow {
  cliente_id: string
  cliente_nombre: string
  num_ventas: number
  subtotal: number
  iva: number
  total: number
}

export interface VentaPorVendedorRow {
  vendedor_nombre: string
  num_ventas: number
  subtotal: number
  iva: number
  total: number
}

export interface ComparativoVentasRow {
  periodo: string
  total_p1: number
  total_p2: number
  variacion: number
  variacion_pct: number
}

export interface ConversionCotizacionRow {
  id: string
  folio: string
  fecha: string
  cliente_nombre: string
  vendedor_nombre: string | null
  total: number
  moneda: string
  status: string
  factura_id: string | null
  sucursal_nombre: string | null
}

export interface VentaPorCategoriaRow {
  categoria_id: string | null
  categoria_nombre: string
  unidades_vendidas: number
  num_productos_distintos: number
  total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type VentaSource = 'facturas' | 'pos' | 'both'

function determinarFuente(modulosActivos: string[]): VentaSource {
  const tieneFacturas = modulosActivos.includes('facturas')
  const tienePOS = modulosActivos.includes('pos')
  if (tieneFacturas && tienePOS) return 'both'
  if (tieneFacturas) return 'facturas'
  return 'pos'
}

// ─── R1: Ventas por Cliente ───────────────────────────────────────────────────

export function useVentasPorCliente(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-ventas-cliente', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const agrupado = new Map<string, VentaPorClienteRow>()

      // Fuente: Facturas
      if (fuente === 'facturas' || fuente === 'both') {
        let q = supabase
          .schema('erp')
          .from('v_facturas')
          .select('cliente_id, cliente_nombre, subtotal, iva, total')
          .eq('organizacion_id', orgId!)
          .not('status', 'eq', 'cancelada')

        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)

        const { data, error } = await q
        if (error) throw error

        for (const row of data || []) {
          const key = row.cliente_id || 'sin-cliente'
          const existing = agrupado.get(key)
          if (existing) {
            existing.num_ventas++
            existing.subtotal += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(key, {
              cliente_id: row.cliente_id,
              cliente_nombre: row.cliente_nombre || 'Sin cliente',
              num_ventas: 1,
              subtotal: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }
      }

      // Fuente: POS
      if (fuente === 'pos' || fuente === 'both') {
        let q = supabase
          .schema('erp')
          .from('ventas_pos')
          .select('cliente_id, cliente_nombre, subtotal, iva, total')
          .eq('status', 'completada')
          .eq('organizacion_id', orgId!)

        if (fechaDesde) q = q.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) q = q.lte('created_at', `${fechaHasta}T23:59:59`)

        const { data, error } = await q
        if (error) throw error

        for (const row of data || []) {
          const key = row.cliente_id || 'publico-general-pos'
          const nombre = row.cliente_nombre || 'Publico en General'
          const existing = agrupado.get(key)
          if (existing) {
            existing.num_ventas++
            existing.subtotal += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(key, {
              cliente_id: key,
              cliente_nombre: nombre,
              num_ventas: 1,
              subtotal: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }
      }

      return Array.from(agrupado.values()).sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R2: Ventas por Vendedor ──────────────────────────────────────────────────

export function useVentasPorVendedor(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-ventas-vendedor', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const agrupado = new Map<string, VentaPorVendedorRow>()

      if (fuente === 'facturas' || fuente === 'both') {
        let q = supabase
          .schema('erp')
          .from('v_facturas')
          .select('vendedor_nombre, subtotal, iva, total')
          .eq('organizacion_id', orgId!)
          .not('status', 'eq', 'cancelada')

        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)

        const { data, error } = await q
        if (error) throw error

        for (const row of data || []) {
          const key = row.vendedor_nombre || 'Sin vendedor'
          const existing = agrupado.get(key)
          if (existing) {
            existing.num_ventas++
            existing.subtotal += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(key, {
              vendedor_nombre: key,
              num_ventas: 1,
              subtotal: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }
      }

      if (fuente === 'pos' || fuente === 'both') {
        let q = supabase
          .schema('erp')
          .from('ventas_pos')
          .select('vendedor_nombre, subtotal, iva, total')
          .eq('status', 'completada')
          .eq('organizacion_id', orgId!)

        if (fechaDesde) q = q.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) q = q.lte('created_at', `${fechaHasta}T23:59:59`)

        const { data, error } = await q
        if (error) throw error

        for (const row of data || []) {
          const key = row.vendedor_nombre || 'Sin vendedor'
          const existing = agrupado.get(key)
          if (existing) {
            existing.num_ventas++
            existing.subtotal += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(key, {
              vendedor_nombre: key,
              num_ventas: 1,
              subtotal: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }
      }

      return Array.from(agrupado.values()).sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R3: Ventas por Categoría ─────────────────────────────────────────────────

export function useVentasPorCategoria(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-ventas-categoria', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener categorías
      const { data: categorias } = await supabase
        .schema('erp')
        .from('categorias')
        .select('id, nombre')
        .eq('organizacion_id', orgId!)

      const catMap = new Map((categorias || []).map((c) => [c.id, c.nombre]))

      // Obtener productos con su categoría
      const { data: productos } = await supabase
        .schema('erp')
        .from('productos')
        .select('id, categoria_id')
        .eq('organizacion_id', orgId!)

      const prodCatMap = new Map((productos || []).map((p) => [p.id, p.categoria_id]))

      const agrupado = new Map<string, VentaPorCategoriaRow>()
      const productosDistintos = new Map<string, Set<string>>()

      function agregarItem(productoId: string, cantidad: number, subtotal: number) {
        const catId = prodCatMap.get(productoId) || 'sin-categoria'
        const catNombre = catId === 'sin-categoria' ? 'Sin categoria' : (catMap.get(catId) || 'Sin categoria')
        const key = catId

        if (!productosDistintos.has(key)) productosDistintos.set(key, new Set())
        productosDistintos.get(key)!.add(productoId)

        const existing = agrupado.get(key)
        if (existing) {
          existing.unidades_vendidas += Number(cantidad)
          existing.total += Number(subtotal)
        } else {
          agrupado.set(key, {
            categoria_id: catId === 'sin-categoria' ? null : catId,
            categoria_nombre: catNombre,
            unidades_vendidas: Number(cantidad),
            num_productos_distintos: 0,
            total: Number(subtotal),
          })
        }
      }

      // Fuente: Factura items
      if (fuente === 'facturas' || fuente === 'both') {
        // Primero obtener facturas del periodo
        let fq = supabase
          .schema('erp')
          .from('facturas')
          .select('id')
          .eq('organizacion_id', orgId!)
          .not('status', 'eq', 'cancelada')

        if (fechaDesde) fq = fq.gte('fecha', fechaDesde)
        if (fechaHasta) fq = fq.lte('fecha', fechaHasta)

        const { data: facturas } = await fq
        if (facturas && facturas.length > 0) {
          const facturaIds = facturas.map((f) => f.id)
          const { data: items } = await supabase
            .schema('erp')
            .from('factura_items')
            .select('producto_id, cantidad, subtotal')
            .in('factura_id', facturaIds)

          for (const item of items || []) {
            if (item.producto_id) agregarItem(item.producto_id, item.cantidad, item.subtotal)
          }
        }
      }

      // Fuente: POS items
      if (fuente === 'pos' || fuente === 'both') {
        let vq = supabase
          .schema('erp')
          .from('ventas_pos')
          .select('id')
          .eq('status', 'completada')
          .eq('organizacion_id', orgId!)

        if (fechaDesde) vq = vq.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) vq = vq.lte('created_at', `${fechaHasta}T23:59:59`)

        const { data: ventas } = await vq
        if (ventas && ventas.length > 0) {
          const ventaIds = ventas.map((v) => v.id)
          const { data: items } = await supabase
            .schema('erp')
            .from('venta_pos_items')
            .select('producto_id, cantidad, subtotal')
            .in('venta_pos_id', ventaIds)

          for (const item of items || []) {
            if (item.producto_id) agregarItem(item.producto_id, item.cantidad, item.subtotal)
          }
        }
      }

      // Añadir productos distintos
      const result = Array.from(agrupado.values())
      for (const row of result) {
        const key = row.categoria_id || 'sin-categoria'
        row.num_productos_distintos = productosDistintos.get(key)?.size || 0
      }

      return result.sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R9: Comparativo de Ventas ────────────────────────────────────────────────

async function fetchTotalPeriodo(
  supabase: ReturnType<typeof getSupabaseClient>,
  desde: string,
  hasta: string,
  orgId: string,
  fuente: VentaSource
): Promise<Map<string, number>> {
  const porMes = new Map<string, number>()

  if (fuente === 'facturas' || fuente === 'both') {
    const { data } = await supabase
      .schema('erp')
      .from('v_facturas')
      .select('fecha, total')
      .eq('organizacion_id', orgId)
      .not('status', 'eq', 'cancelada')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    for (const r of data || []) {
      const mes = (r.fecha || '').substring(0, 7)
      porMes.set(mes, (porMes.get(mes) || 0) + Number(r.total || 0))
    }
  }

  if (fuente === 'pos' || fuente === 'both') {
    const { data } = await supabase
      .schema('erp')
      .from('ventas_pos')
      .select('created_at, total')
      .eq('status', 'completada')
      .eq('organizacion_id', orgId)
      .gte('created_at', `${desde}T00:00:00`)
      .lte('created_at', `${hasta}T23:59:59`)

    for (const r of data || []) {
      const mes = (r.created_at || '').substring(0, 7)
      porMes.set(mes, (porMes.get(mes) || 0) + Number(r.total || 0))
    }
  }

  return porMes
}

export function useComparativoVentas(
  desde1: string | null,
  hasta1: string | null,
  desde2: string | null,
  hasta2: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-comparativo-ventas', desde1, hasta1, desde2, hasta2, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      const [p1, p2] = await Promise.all([
        fetchTotalPeriodo(supabase, desde1!, hasta1!, orgId!, fuente),
        fetchTotalPeriodo(supabase, desde2!, hasta2!, orgId!, fuente),
      ])

      // Obtener todos los meses de ambos periodos
      const allMeses = new Set<string>()
      p1.forEach((_, m) => allMeses.add(m))
      p2.forEach((_, m) => allMeses.add(m))

      // Para comparar, crear filas por mes relativo (mes 1, mes 2, etc.)
      const meses1 = Array.from(p1.keys()).sort()
      const meses2 = Array.from(p2.keys()).sort()
      const maxLen = Math.max(meses1.length, meses2.length)

      const resultado: ComparativoVentasRow[] = []
      let acum1 = 0
      let acum2 = 0

      for (let i = 0; i < maxLen; i++) {
        const mes1 = meses1[i]
        const mes2 = meses2[i]
        const t1 = mes1 ? (p1.get(mes1) || 0) : 0
        const t2 = mes2 ? (p2.get(mes2) || 0) : 0
        acum1 += t1
        acum2 += t2

        const label = mes1 && mes2 ? `${mes1} vs ${mes2}` : (mes1 || mes2 || `Mes ${i + 1}`)

        resultado.push({
          periodo: label,
          total_p1: t1,
          total_p2: t2,
          variacion: t2 - t1,
          variacion_pct: t1 > 0 ? ((t2 - t1) / t1) * 100 : t2 > 0 ? 100 : 0,
        })
      }

      // Agregar fila de totales
      resultado.push({
        periodo: 'TOTAL',
        total_p1: acum1,
        total_p2: acum2,
        variacion: acum2 - acum1,
        variacion_pct: acum1 > 0 ? ((acum2 - acum1) / acum1) * 100 : acum2 > 0 ? 100 : 0,
      })

      return resultado
    },
    enabled: !!desde1 && !!hasta1 && !!desde2 && !!hasta2 && !!orgId,
  })
}

// ─── R10: Conversión de Cotizaciones ──────────────────────────────────────────

export function useConversionCotizaciones(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-conversion-cotizaciones', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let q = supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('id, folio, fecha, cliente_nombre, vendedor_nombre, total, moneda, status, factura_id, sucursal_nombre')
        .eq('organizacion_id', orgId!)
        .not('status', 'eq', 'cancelada')
        .not('folio', 'like', 'OV-%')
        .order('fecha', { ascending: false })

      if (fechaDesde) q = q.gte('fecha', fechaDesde)
      if (fechaHasta) q = q.lte('fecha', fechaHasta)

      const { data, error } = await q
      if (error) throw error
      return (data || []) as ConversionCotizacionRow[]
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R23: Devoluciones y Cancelaciones ────────────────────────────────────────

export interface DevolucionRow {
  id: string
  fecha: string
  tipo: 'factura' | 'pos'
  folio: string
  cliente_nombre: string
  monto: number
  status: string
  sucursal_nombre: string | null
  productos_desc: string | null
}

export function useDevolucionesCancelaciones(
  fechaDesde: string | null, fechaHasta: string | null, orgId: string | undefined, modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)
  return useQuery({
    queryKey: ['reporte-devoluciones', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const resultado: DevolucionRow[] = []

      if (fuente === 'facturas' || fuente === 'both') {
        let q = supabase.schema('erp').from('v_facturas')
          .select('id, fecha, folio, cliente_nombre, total, status, sucursal_nombre')
          .eq('organizacion_id', orgId!).eq('status', 'cancelada')
        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)
        const { data } = await q

        const facturaIds = (data || []).map((r) => r.id)
        const descMap = await fetchDescripcionesFacturas(facturaIds)

        for (const r of data || []) {
          resultado.push({ id: r.id, fecha: r.fecha, tipo: 'factura', folio: r.folio, cliente_nombre: r.cliente_nombre || '-', monto: Number(r.total || 0), status: 'Cancelada', sucursal_nombre: (r as Record<string, unknown>).sucursal_nombre as string | null, productos_desc: descMap.get(r.id) || null })
        }
      }

      if (fuente === 'pos' || fuente === 'both') {
        let q = supabase.schema('erp').from('ventas_pos')
          .select('id, created_at, folio, cliente_nombre, total, status')
          .eq('organizacion_id', orgId!).eq('status', 'cancelada')
        if (fechaDesde) q = q.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) q = q.lte('created_at', `${fechaHasta}T23:59:59`)
        const { data } = await q
        for (const r of data || []) {
          resultado.push({ id: r.id, fecha: r.created_at, tipo: 'pos', folio: r.folio, cliente_nombre: r.cliente_nombre || 'Publico General', monto: Number(r.total || 0), status: 'Cancelada', sucursal_nombre: null, productos_desc: null })
        }
      }

      return resultado.sort((a, b) => b.fecha.localeCompare(a.fecha))
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
