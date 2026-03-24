import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ComprasPorProveedorRow {
  proveedor_id: string
  proveedor_nombre: string
  proveedor_rfc: string | null
  num_ordenes: number
  subtotal: number
  iva: number
  total: number
}

export interface HistorialPrecioCompraRow {
  id: string
  fecha: string
  folio: string
  proveedor_nombre: string
  producto_nombre: string
  sku: string
  precio_unitario: number
  cantidad: number
}

// ─── R13: Compras por Proveedor ───────────────────────────────────────────────

export function useComprasPorProveedor(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-compras-proveedor', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let q = supabase
        .schema('erp')
        .from('v_ordenes_compra')
        .select('proveedor_id, proveedor_nombre, proveedor_rfc, subtotal, iva, total')
        .eq('organizacion_id', orgId!)
        .not('status', 'eq', 'cancelada')

      if (fechaDesde) q = q.gte('fecha', fechaDesde)
      if (fechaHasta) q = q.lte('fecha', fechaHasta)

      const { data, error } = await q
      if (error) throw error

      const agrupado = new Map<string, ComprasPorProveedorRow>()
      for (const row of data || []) {
        const key = row.proveedor_id
        const existing = agrupado.get(key)
        if (existing) {
          existing.num_ordenes++
          existing.subtotal += Number(row.subtotal || 0)
          existing.iva += Number(row.iva || 0)
          existing.total += Number(row.total || 0)
        } else {
          agrupado.set(key, {
            proveedor_id: row.proveedor_id,
            proveedor_nombre: row.proveedor_nombre || 'Sin proveedor',
            proveedor_rfc: row.proveedor_rfc || null,
            num_ordenes: 1,
            subtotal: Number(row.subtotal || 0),
            iva: Number(row.iva || 0),
            total: Number(row.total || 0),
          })
        }
      }

      return Array.from(agrupado.values()).sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R14: Historial de Precios de Compra ──────────────────────────────────────

export function useHistorialPreciosCompra(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-historial-precios-compra', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener OC del periodo
      let oq = supabase
        .schema('erp')
        .from('v_ordenes_compra')
        .select('id, folio, fecha, proveedor_nombre')
        .eq('organizacion_id', orgId!)
        .not('status', 'eq', 'cancelada')
        .order('fecha', { ascending: false })

      if (fechaDesde) oq = oq.gte('fecha', fechaDesde)
      if (fechaHasta) oq = oq.lte('fecha', fechaHasta)

      const { data: ordenes, error } = await oq
      if (error) throw error
      if (!ordenes || ordenes.length === 0) return []

      const ordenIds = ordenes.map((o) => o.id)
      const ordenMap = new Map(ordenes.map((o) => [o.id, o]))

      // Items de las OC
      const { data: items } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .select('id, orden_compra_id, producto_id, precio_unitario, cantidad')
        .in('orden_compra_id', ordenIds)

      if (!items || items.length === 0) return []

      // Productos
      const prodIds = Array.from(new Set(items.map((i) => i.producto_id).filter(Boolean)))
      const { data: prods } = await supabase
        .schema('erp')
        .from('productos')
        .select('id, sku, nombre')
        .in('id', prodIds)

      const prodMap = new Map((prods || []).map((p) => [p.id, p]))

      return items.map((item): HistorialPrecioCompraRow => {
        const orden = ordenMap.get(item.orden_compra_id)
        const prod = prodMap.get(item.producto_id)
        return {
          id: item.id,
          fecha: orden?.fecha || '',
          folio: orden?.folio || '',
          proveedor_nombre: orden?.proveedor_nombre || '-',
          producto_nombre: prod?.nombre || '-',
          sku: prod?.sku || '-',
          precio_unitario: Number(item.precio_unitario || 0),
          cantidad: Number(item.cantidad || 0),
        }
      }).sort((a, b) => b.fecha.localeCompare(a.fecha))
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
