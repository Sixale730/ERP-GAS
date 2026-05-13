import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RotacionInventarioRow {
  producto_id: string
  sku: string
  nombre: string
  stock_actual: number
  unidades_vendidas: number
  rotacion: number       // veces en el periodo
  dias_inventario: number
}

export interface ProductoSinMovimientoRow {
  producto_id: string
  sku: string
  nombre: string
  almacen_nombre: string
  cantidad: number
  costo_unitario: number
  valor_retenido: number
  ultimo_movimiento: string | null
  dias_sin_movimiento: number
}

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

// ─── R11: Rotación de Inventario ──────────────────────────────────────────────

export function useRotacionInventario(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-rotacion-inventario', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Stock actual agrupado por producto
      const { data: inv } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('id, sku, nombre, stock_total')
        .eq('organizacion_id', orgId!)

      const stockMap = new Map((inv || []).map((p) => [p.id, { sku: p.sku, nombre: p.nombre, stock: Number(p.stock_total || 0) }]))

      // Salidas en el periodo (movimientos tipo salida)
      let mq = supabase
        .schema('erp')
        .from('v_movimientos')
        .select('producto_id, cantidad')
        .eq('organizacion_id', orgId!)
        .eq('tipo', 'salida')

      if (fechaDesde) mq = mq.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) mq = mq.lte('created_at', `${fechaHasta}T23:59:59`)

      const { data: movimientos } = await mq

      // Agrupar salidas por producto
      const salidasMap = new Map<string, number>()
      for (const m of movimientos || []) {
        salidasMap.set(m.producto_id, (salidasMap.get(m.producto_id) || 0) + Number(m.cantidad || 0))
      }

      // Calcular días del periodo
      const dias = fechaDesde && fechaHasta
        ? Math.max(1, Math.ceil((new Date(fechaHasta).getTime() - new Date(fechaDesde).getTime()) / (1000 * 60 * 60 * 24)))
        : 30

      const resultado: RotacionInventarioRow[] = []
      stockMap.forEach((prod, id) => {
        const vendidas = salidasMap.get(id) || 0
        const stockPromedio = prod.stock > 0 ? prod.stock : 1
        const rotacion = vendidas / stockPromedio
        const diasInv = rotacion > 0 ? dias / rotacion : 999

        resultado.push({
          producto_id: id,
          sku: prod.sku,
          nombre: prod.nombre,
          stock_actual: prod.stock,
          unidades_vendidas: vendidas,
          rotacion: Math.round(rotacion * 100) / 100,
          dias_inventario: Math.round(diasInv),
        })
      })

      return resultado.sort((a, b) => b.rotacion - a.rotacion)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R12: Productos Sin Movimiento ────────────────────────────────────────────

export function useProductosSinMovimiento(
  diasMinimos: number,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-productos-sin-movimiento', diasMinimos, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Inventario con stock > 0
      const { data: inv } = await supabase
        .schema('erp')
        .from('v_inventario_detalle')
        .select('producto_id, sku, producto_nombre, almacen_nombre, cantidad, unidad_medida')
        .eq('organizacion_id', orgId!)
        .gt('cantidad', 0)

      if (!inv || inv.length === 0) return []

      // Costos
      const prodIds = Array.from(new Set(inv.map((i) => i.producto_id)))
      const { data: productos } = await supabase
        .schema('erp')
        .from('productos')
        .select('id, costo_promedio')
        .in('id', prodIds)

      const costoMap = new Map((productos || []).map((p) => [p.id, Number(p.costo_promedio || 0)]))

      // Último movimiento de salida por producto
      const { data: movimientos } = await supabase
        .schema('erp')
        .from('v_movimientos')
        .select('producto_id, created_at')
        .eq('organizacion_id', orgId!)
        .eq('tipo', 'salida')
        .order('created_at', { ascending: false })

      const ultimoMovMap = new Map<string, string>()
      for (const m of movimientos || []) {
        if (!ultimoMovMap.has(m.producto_id)) {
          ultimoMovMap.set(m.producto_id, m.created_at)
        }
      }

      const hoy = new Date()
      const resultado: ProductoSinMovimientoRow[] = []

      for (const row of inv) {
        const ultimoMov = ultimoMovMap.get(row.producto_id) || null
        let diasSin = 999
        if (ultimoMov) {
          diasSin = Math.ceil((hoy.getTime() - new Date(ultimoMov).getTime()) / (1000 * 60 * 60 * 24))
        }

        if (diasSin >= diasMinimos) {
          const costo = costoMap.get(row.producto_id) || 0
          const cantidad = Number(row.cantidad || 0)
          resultado.push({
            producto_id: row.producto_id,
            sku: row.sku,
            nombre: row.producto_nombre,
            almacen_nombre: row.almacen_nombre,
            cantidad,
            costo_unitario: costo,
            valor_retenido: cantidad * costo,
            ultimo_movimiento: ultimoMov,
            dias_sin_movimiento: diasSin,
          })
        }
      }

      return resultado.sort((a, b) => b.dias_sin_movimiento - a.dias_sin_movimiento)
    },
    enabled: !!orgId,
  })
}

// ─── R24: Punto de Reorden ────────────────────────────────────────────────────

export interface PuntoReordenRow {
  producto_id: string
  sku: string
  nombre: string
  almacen_nombre: string
  stock_actual: number
  reservado: number
  en_transito: number
  disponible_neto: number
  stock_minimo: number
  stock_maximo: number
  cantidad_sugerida: number
  nivel: string
}

export function usePuntoReorden(orgId: string | undefined) {
  return useQuery({
    queryKey: ['reporte-punto-reorden', orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      // v_inventario_detalle ya expone cantidad_reservada y en_transito calculados dinamicos.
      const { data, error } = await supabase.schema('erp').from('v_inventario_detalle')
        .select('producto_id, sku, producto_nombre, almacen_nombre, cantidad, cantidad_reservada, en_transito, stock_minimo, stock_maximo, nivel_stock')
        .eq('organizacion_id', orgId!)
        .in('nivel_stock', ['bajo', 'sin_stock'])

      if (error) throw error

      return (data || []).map((r): PuntoReordenRow => {
        const actual = Number(r.cantidad || 0)
        const reservado = Number(r.cantidad_reservada || 0)
        const transito = Number(r.en_transito || 0)
        const maximo = Number(r.stock_maximo || 0)
        // Disponible neto: lo que realmente quedara despues de cubrir OVs y recibir OCs en transito.
        const disponibleNeto = actual + transito - reservado
        return {
          producto_id: r.producto_id, sku: r.sku, nombre: r.producto_nombre,
          almacen_nombre: r.almacen_nombre,
          stock_actual: actual,
          reservado,
          en_transito: transito,
          disponible_neto: disponibleNeto,
          stock_minimo: Number(r.stock_minimo || 0), stock_maximo: maximo,
          cantidad_sugerida: Math.max(0, maximo - disponibleNeto),
          nivel: r.nivel_stock,
        }
      }).sort((a, b) => a.disponible_neto - b.disponible_neto)
    },
    enabled: !!orgId,
  })
}

// ─── R25: Conciliación de Inventario ──────────────────────────────────────────

export interface ConciliacionRow {
  producto_id: string
  sku: string
  nombre: string
  almacen_nombre: string
  cantidad_sistema: number
  unidad_medida: string
}

export function useConciliacionInventario(almacenId: string | null, orgId: string | undefined) {
  return useQuery({
    queryKey: ['reporte-conciliacion', almacenId, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let q = supabase.schema('erp').from('v_inventario_detalle')
        .select('producto_id, sku, producto_nombre, almacen_nombre, cantidad, unidad_medida')
        .eq('organizacion_id', orgId!)
      if (almacenId) q = q.eq('almacen_id', almacenId)

      const { data, error } = await q
      if (error) throw error

      return (data || []).map((r): ConciliacionRow => ({
        producto_id: r.producto_id, sku: r.sku, nombre: r.producto_nombre,
        almacen_nombre: r.almacen_nombre, cantidad_sistema: Number(r.cantidad || 0),
        unidad_medida: r.unidad_medida,
      })).sort((a, b) => a.sku.localeCompare(b.sku))
    },
    enabled: !!orgId,
  })
}

// ─── R26: SKUs con Movimiento (P3) ────────────────────────────────────────────
// Diagnostico para SOLAC: lista solo SKUs que se movieron en los ultimos 30 dias
// (vendidos vía OV/factura, comprados vía OC, o reservados por OV activa).

export type SemaforoSku = 'critico' | 'vigilar' | 'estable'

export interface SkuMovimientoRow {
  producto_id: string
  sku: string
  nombre: string
  unidad_medida: string | null
  stock_fisico: number
  stock_minimo: number
  stock_maximo: number
  reservado: number
  en_transito: number
  disponible_neto: number
  vendidas_30d: number
  tiene_min_max: boolean
  tiene_proveedor: boolean
  proveedor_nombre: string | null
  requiere_proveedor: boolean
  semaforo: SemaforoSku
}

export function useSkusConMovimiento(orgId: string | undefined) {
  return useQuery({
    queryKey: ['reporte-skus-movimiento', orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const desde = new Date()
      desde.setDate(desde.getDate() - 30)
      const desdeIso = desde.toISOString()

      // Snapshot de productos con stocks/reservado/transito desde la vista agregada
      const { data: productos, error: errProd } = await supabase.schema('erp')
        .from('v_productos_stock')
        .select('id, sku, nombre, unidad_medida, stock_minimo, stock_maximo, stock_total, reservado_total, en_transito_total, proveedor_principal_id, proveedor_nombre, es_servicio')
        .eq('organizacion_id', orgId!)
        .eq('es_servicio', false)

      if (errProd) throw errProd

      // Movimientos de salida (factura) ultimos 30 dias por producto
      const { data: ventas } = await supabase.schema('erp')
        .from('movimientos_inventario')
        .select('producto_id, cantidad')
        .eq('organizacion_id', orgId!)
        .eq('tipo', 'salida')
        .in('referencia_tipo', ['factura', 'cotizacion'])
        .gte('created_at', desdeIso)

      const ventasMap = new Map<string, number>()
      ventas?.forEach((m) => {
        const prev = ventasMap.get(m.producto_id) ?? 0
        ventasMap.set(m.producto_id, prev + Number(m.cantidad || 0))
      })

      // OCs creadas en los ultimos 30 dias (cualquier item de OC dispara "movimiento")
      const { data: ocsRecientes } = await supabase.schema('erp')
        .from('ordenes_compra')
        .select('id, orden_compra_items(producto_id)')
        .eq('organizacion_id', orgId!)
        .eq('is_active', true)
        .gte('created_at', desdeIso)

      const skusConOC = new Set<string>()
      ocsRecientes?.forEach((oc: any) => {
        (oc.orden_compra_items || []).forEach((it: any) => {
          if (it.producto_id) skusConOC.add(it.producto_id)
        })
      })

      const filas: SkuMovimientoRow[] = (productos || [])
        .map((p) => {
          const fisico = Number(p.stock_total || 0)
          const reservado = Number(p.reservado_total || 0)
          const transito = Number(p.en_transito_total || 0)
          const vendidas = ventasMap.get(p.id) ?? 0
          const tieneMovimiento = vendidas > 0 || skusConOC.has(p.id) || reservado > 0
          if (!tieneMovimiento) return null
          const disponibleNeto = fisico + transito - reservado
          const minimo = Number(p.stock_minimo || 0)
          const maximo = Number(p.stock_maximo || 0)
          const tieneMinMax = minimo > 0 || maximo > 0
          const tieneProveedor = !!p.proveedor_principal_id
          // Semaforo
          let semaforo: SemaforoSku = 'estable'
          if (disponibleNeto <= 0) semaforo = 'critico'
          else if (tieneMinMax && minimo > 0 && disponibleNeto <= minimo) semaforo = 'critico'
          else if (tieneMinMax && maximo > 0 && disponibleNeto <= maximo * 0.3) semaforo = 'vigilar'
          else if (!tieneMinMax && vendidas > 0 && disponibleNeto < vendidas) semaforo = 'vigilar'
          return {
            producto_id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            unidad_medida: p.unidad_medida,
            stock_fisico: fisico,
            stock_minimo: minimo,
            stock_maximo: maximo,
            reservado,
            en_transito: transito,
            disponible_neto: disponibleNeto,
            vendidas_30d: vendidas,
            tiene_min_max: tieneMinMax,
            tiene_proveedor: tieneProveedor,
            proveedor_nombre: p.proveedor_nombre,
            // P5: SKU con movimiento real pero sin proveedor → bandera para SOLAC
            requiere_proveedor: !tieneProveedor,
            semaforo,
          } as SkuMovimientoRow
        })
        .filter((r): r is SkuMovimientoRow => r !== null)
        .sort((a, b) => {
          // Prioriza criticos → vigilar → estable, luego por mayor venta
          const ordenSemaforo = { critico: 0, vigilar: 1, estable: 2 }
          if (ordenSemaforo[a.semaforo] !== ordenSemaforo[b.semaforo]) {
            return ordenSemaforo[a.semaforo] - ordenSemaforo[b.semaforo]
          }
          return b.vendidas_30d - a.vendidas_30d
        })

      return filas
    },
    enabled: !!orgId,
  })
}
