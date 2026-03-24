import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ABCClienteRow {
  ranking: number
  cliente_id: string
  cliente_nombre: string
  total_comprado: number
  porcentaje: number
  acumulado: number
  clasificacion: 'A' | 'B' | 'C'
}

export interface ABCProductoRow {
  ranking: number
  producto_id: string
  sku: string
  nombre: string
  total_vendido: number
  unidades: number
  porcentaje: number
  acumulado: number
  clasificacion: 'A' | 'B' | 'C'
}

// ─── Helper: clasificación ABC ────────────────────────────────────────────────

function clasificarABC(acumulado: number): 'A' | 'B' | 'C' {
  if (acumulado <= 80) return 'A'
  if (acumulado <= 95) return 'B'
  return 'C'
}

type VentaSource = 'facturas' | 'pos' | 'both'

function determinarFuente(modulosActivos: string[]): VentaSource {
  const tieneFacturas = modulosActivos.includes('facturas')
  const tienePOS = modulosActivos.includes('pos')
  if (tieneFacturas && tienePOS) return 'both'
  if (tieneFacturas) return 'facturas'
  return 'pos'
}

// ─── R15: ABC de Clientes ─────────────────────────────────────────────────────

export function useABCClientes(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-abc-clientes', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const agrupado = new Map<string, { nombre: string; total: number }>()

      if (fuente === 'facturas' || fuente === 'both') {
        let q = supabase.schema('erp').from('v_facturas')
          .select('cliente_id, cliente_nombre, total')
          .eq('organizacion_id', orgId!)
          .not('status', 'eq', 'cancelada')
        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)
        const { data } = await q
        for (const r of data || []) {
          const key = r.cliente_id || 'sin-cliente'
          const ex = agrupado.get(key)
          if (ex) { ex.total += Number(r.total || 0) }
          else { agrupado.set(key, { nombre: r.cliente_nombre || 'Sin cliente', total: Number(r.total || 0) }) }
        }
      }

      if (fuente === 'pos' || fuente === 'both') {
        let q = supabase.schema('erp').from('ventas_pos')
          .select('cliente_id, cliente_nombre, total')
          .eq('status', 'completada').eq('organizacion_id', orgId!)
        if (fechaDesde) q = q.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) q = q.lte('created_at', `${fechaHasta}T23:59:59`)
        const { data } = await q
        for (const r of data || []) {
          const key = r.cliente_id || 'publico-general'
          const ex = agrupado.get(key)
          if (ex) { ex.total += Number(r.total || 0) }
          else { agrupado.set(key, { nombre: r.cliente_nombre || 'Publico en General', total: Number(r.total || 0) }) }
        }
      }

      const sorted = Array.from(agrupado.entries())
        .map(([id, v]) => ({ cliente_id: id, cliente_nombre: v.nombre, total_comprado: v.total }))
        .sort((a, b) => b.total_comprado - a.total_comprado)

      const totalGeneral = sorted.reduce((s, r) => s + r.total_comprado, 0)
      let acumulado = 0

      return sorted.map((r, i): ABCClienteRow => {
        const pct = totalGeneral > 0 ? (r.total_comprado / totalGeneral) * 100 : 0
        acumulado += pct
        return {
          ranking: i + 1,
          cliente_id: r.cliente_id,
          cliente_nombre: r.cliente_nombre,
          total_comprado: r.total_comprado,
          porcentaje: Math.round(pct * 10) / 10,
          acumulado: Math.round(acumulado * 10) / 10,
          clasificacion: clasificarABC(acumulado),
        }
      })
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R16: ABC de Productos ────────────────────────────────────────────────────

export function useABCProductos(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  modulosActivos: string[]
) {
  const fuente = determinarFuente(modulosActivos)

  return useQuery({
    queryKey: ['reporte-abc-productos', fechaDesde, fechaHasta, orgId, fuente],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const agrupado = new Map<string, { total: number; unidades: number }>()

      if (fuente === 'facturas' || fuente === 'both') {
        let fq = supabase.schema('erp').from('facturas').select('id')
          .eq('organizacion_id', orgId!).not('status', 'eq', 'cancelada')
        if (fechaDesde) fq = fq.gte('fecha', fechaDesde)
        if (fechaHasta) fq = fq.lte('fecha', fechaHasta)
        const { data: facturas } = await fq
        if (facturas && facturas.length > 0) {
          const { data: items } = await supabase.schema('erp').from('factura_items')
            .select('producto_id, cantidad, subtotal').in('factura_id', facturas.map((f) => f.id))
          for (const it of items || []) {
            if (!it.producto_id) continue
            const ex = agrupado.get(it.producto_id)
            if (ex) { ex.total += Number(it.subtotal || 0); ex.unidades += Number(it.cantidad || 0) }
            else { agrupado.set(it.producto_id, { total: Number(it.subtotal || 0), unidades: Number(it.cantidad || 0) }) }
          }
        }
      }

      if (fuente === 'pos' || fuente === 'both') {
        let vq = supabase.schema('erp').from('ventas_pos').select('id')
          .eq('status', 'completada').eq('organizacion_id', orgId!)
        if (fechaDesde) vq = vq.gte('created_at', `${fechaDesde}T00:00:00`)
        if (fechaHasta) vq = vq.lte('created_at', `${fechaHasta}T23:59:59`)
        const { data: ventas } = await vq
        if (ventas && ventas.length > 0) {
          const { data: items } = await supabase.schema('erp').from('venta_pos_items')
            .select('producto_id, cantidad, subtotal').in('venta_pos_id', ventas.map((v) => v.id))
          for (const it of items || []) {
            if (!it.producto_id) continue
            const ex = agrupado.get(it.producto_id)
            if (ex) { ex.total += Number(it.subtotal || 0); ex.unidades += Number(it.cantidad || 0) }
            else { agrupado.set(it.producto_id, { total: Number(it.subtotal || 0), unidades: Number(it.cantidad || 0) }) }
          }
        }
      }

      // Obtener info de productos
      const prodIds = Array.from(agrupado.keys())
      if (prodIds.length === 0) return []
      const { data: prods } = await supabase.schema('erp').from('productos')
        .select('id, sku, nombre').in('id', prodIds)
      const prodMap = new Map((prods || []).map((p) => [p.id, p]))

      const sorted = prodIds
        .map((id) => {
          const prod = prodMap.get(id)
          const vals = agrupado.get(id)!
          return { producto_id: id, sku: prod?.sku || '-', nombre: prod?.nombre || '-', total_vendido: vals.total, unidades: vals.unidades }
        })
        .sort((a, b) => b.total_vendido - a.total_vendido)

      const totalGeneral = sorted.reduce((s, r) => s + r.total_vendido, 0)
      let acumulado = 0

      return sorted.map((r, i): ABCProductoRow => {
        const pct = totalGeneral > 0 ? (r.total_vendido / totalGeneral) * 100 : 0
        acumulado += pct
        return {
          ranking: i + 1,
          producto_id: r.producto_id,
          sku: r.sku,
          nombre: r.nombre,
          total_vendido: r.total_vendido,
          unidades: r.unidades,
          porcentaje: Math.round(pct * 10) / 10,
          acumulado: Math.round(acumulado * 10) / 10,
          clasificacion: clasificarABC(acumulado),
        }
      })
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
