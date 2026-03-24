import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ValuacionInventarioRow {
  producto_id: string
  sku: string
  nombre: string
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  costo_unitario: number
  valor_total: number
  unidad_medida: string
}

// ─── R8: Valuación de Inventario ──────────────────────────────────────────────

export function useValuacionInventario(
  almacenId: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-valuacion-inventario', almacenId, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener inventario con detalle
      let q = supabase
        .schema('erp')
        .from('v_inventario_detalle')
        .select('producto_id, sku, producto_nombre, almacen_id, almacen_nombre, cantidad, unidad_medida')
        .eq('organizacion_id', orgId!)
        .gt('cantidad', 0)

      if (almacenId) q = q.eq('almacen_id', almacenId)

      const { data: inventario, error } = await q
      if (error) throw error
      if (!inventario || inventario.length === 0) return []

      // Obtener costos de productos
      const productoIds = Array.from(new Set(inventario.map((i) => i.producto_id)))
      const { data: productos } = await supabase
        .schema('erp')
        .from('productos')
        .select('id, costo_promedio')
        .in('id', productoIds)

      const costoMap = new Map((productos || []).map((p) => [p.id, Number(p.costo_promedio || 0)]))

      return inventario.map((row): ValuacionInventarioRow => {
        const costo = costoMap.get(row.producto_id) || 0
        const cantidad = Number(row.cantidad || 0)
        return {
          producto_id: row.producto_id,
          sku: row.sku,
          nombre: row.producto_nombre,
          almacen_id: row.almacen_id,
          almacen_nombre: row.almacen_nombre,
          cantidad,
          costo_unitario: costo,
          valor_total: cantidad * costo,
          unidad_medida: row.unidad_medida,
        }
      }).sort((a, b) => b.valor_total - a.valor_total)
    },
    enabled: !!orgId,
  })
}
