import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchDescripcionesFacturas } from './useReportesHelpers'

// ── Tipos ────────────────────────────────────────────

export interface VentaPOSReporte {
  id: string
  folio: string
  created_at: string
  metodo_pago: string
  subtotal: number
  iva: number
  ieps: number
  total: number
  monto_efectivo: number
  monto_tarjeta: number
  monto_transferencia: number
  vendedor_nombre: string | null
}

export interface VentaFormaPagoRow {
  metodo_pago: string
  num_ventas: number
  total: number
  total_efectivo: number
  total_tarjeta: number
  total_transferencia: number
}

export interface ProductoVendidoRow {
  id: string
  sku: string
  nombre: string
  unidad_medida: string
  unidades_vendidas: number
  importe_total: number
  num_ventas: number
}

export interface MargenUtilidadRow {
  id: string
  sku: string
  nombre: string
  costo_promedio: number | null
  precio_venta: number | null
  moneda_precio: string | null
  margen_bruto: number | null
  margen_porcentaje: number | null
}

export interface FacturaSaldoRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  monto_pagado: number
  saldo: number
  moneda: string
  dias_vencida: number
  cliente_nombre: string
  sucursal_nombre: string | null
  productos_desc: string | null
}

export interface CarteraVencidaRow {
  id: string
  folio: string
  fecha: string
  total: number
  saldo: number
  dias_vencida: number
  cliente_nombre: string
  moneda: string
  sucursal_nombre: string | null
  productos_desc: string | null
}

export interface ResumenTurnoReporte {
  id: string
  caja_nombre: string
  caja_codigo: string
  usuario_nombre: string
  fecha_apertura: string
  fecha_cierre: string | null
  status: string
  num_ventas: number
  total_ventas: number
  total_efectivo: number
  total_tarjeta: number
  total_transferencia: number
  monto_apertura: number
  monto_cierre_real: number | null
  diferencia: number | null
}

// ── Hooks ────────────────────────────────────────────

export function useVentasPOSReporte(fechaDesde: string | null, fechaHasta: string | null, orgId?: string) {
  return useQuery({
    queryKey: ['reporte-ventas-pos', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('ventas_pos')
        .select('id, folio, created_at, metodo_pago, subtotal, iva, ieps, total, monto_efectivo, monto_tarjeta, monto_transferencia, vendedor_nombre')
        .eq('status', 'completada')
        .eq('organizacion_id', orgId!)
        .order('created_at', { ascending: false })

      if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as VentaPOSReporte[]
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

export function useVentasFormaPago(fechaDesde: string | null, fechaHasta: string | null, orgId?: string) {
  return useQuery({
    queryKey: ['reporte-ventas-forma-pago', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('ventas_pos')
        .select('metodo_pago, total, monto_efectivo, monto_tarjeta, monto_transferencia')
        .eq('status', 'completada')
        .eq('organizacion_id', orgId!)

      if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`)

      const { data, error } = await query
      if (error) throw error

      // Agrupar client-side por metodo_pago
      const agrupado = new Map<string, VentaFormaPagoRow>()
      for (const row of (data || [])) {
        const key = row.metodo_pago || 'otro'
        const existing = agrupado.get(key)
        if (existing) {
          existing.num_ventas++
          existing.total += Number(row.total)
          existing.total_efectivo += Number(row.monto_efectivo)
          existing.total_tarjeta += Number(row.monto_tarjeta)
          existing.total_transferencia += Number(row.monto_transferencia)
        } else {
          agrupado.set(key, {
            metodo_pago: key,
            num_ventas: 1,
            total: Number(row.total),
            total_efectivo: Number(row.monto_efectivo),
            total_tarjeta: Number(row.monto_tarjeta),
            total_transferencia: Number(row.monto_transferencia),
          })
        }
      }
      return Array.from(agrupado.values())
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

export function useProductosMasVendidos(fechaDesde: string | null, fechaHasta: string | null, orgId?: string) {
  return useQuery({
    queryKey: ['reporte-productos-vendidos', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener ventas del periodo
      let ventasQuery = supabase
        .schema('erp')
        .from('ventas_pos')
        .select('id')
        .eq('status', 'completada')
        .eq('organizacion_id', orgId!)

      if (fechaDesde) ventasQuery = ventasQuery.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) ventasQuery = ventasQuery.lte('created_at', `${fechaHasta}T23:59:59`)

      const { data: ventas, error: ventasErr } = await ventasQuery
      if (ventasErr) throw ventasErr
      if (!ventas || ventas.length === 0) return []

      const ventaIds = ventas.map((v) => v.id)

      // Obtener items de esas ventas
      const { data: items, error: itemsErr } = await supabase
        .schema('erp')
        .from('venta_pos_items')
        .select('producto_id, cantidad, subtotal, venta_pos_id')
        .in('venta_pos_id', ventaIds)

      if (itemsErr) throw itemsErr
      if (!items || items.length === 0) return []

      // Agrupar por producto client-side
      const productoIds = Array.from(new Set(items.map((i) => i.producto_id)))
      const { data: productos, error: prodErr } = await supabase
        .schema('erp')
        .from('productos')
        .select('id, sku, nombre, unidad_medida')
        .in('id', productoIds)

      if (prodErr) throw prodErr
      const prodMap = new Map((productos || []).map((p) => [p.id, p]))

      const agrupado = new Map<string, ProductoVendidoRow>()
      for (const item of items) {
        const prod = prodMap.get(item.producto_id)
        if (!prod) continue
        const existing = agrupado.get(item.producto_id)
        if (existing) {
          existing.unidades_vendidas += Number(item.cantidad)
          existing.importe_total += Number(item.subtotal)
          existing.num_ventas++
        } else {
          agrupado.set(item.producto_id, {
            id: prod.id,
            sku: prod.sku,
            nombre: prod.nombre,
            unidad_medida: prod.unidad_medida,
            unidades_vendidas: Number(item.cantidad),
            importe_total: Number(item.subtotal),
            num_ventas: 1,
          })
        }
      }

      return Array.from(agrupado.values()).sort((a, b) => b.importe_total - a.importe_total)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

export function useMargenUtilidad(orgId?: string) {
  return useQuery({
    queryKey: ['reporte-margen-utilidad', orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('v_margen_utilidad')
        .select('*')
        .eq('organizacion_id', orgId!)
        .order('margen_porcentaje', { ascending: false, nullsFirst: false })

      if (error) throw error
      return (data || []) as MargenUtilidadRow[]
    },
    enabled: !!orgId,
  })
}

export function useFacturasSaldos(fechaDesde: string | null, fechaHasta: string | null, orgId?: string, statusFilter?: string | null) {
  return useQuery({
    queryKey: ['reporte-facturas-saldos', fechaDesde, fechaHasta, orgId, statusFilter],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, fecha, status, total, monto_pagado, saldo, moneda, dias_vencida, cliente_nombre, sucursal_nombre')
        .eq('organizacion_id', orgId!)
        .order('fecha', { ascending: false })

      if (fechaDesde) query = query.gte('fecha', fechaDesde)
      if (fechaHasta) query = query.lte('fecha', fechaHasta)
      if (statusFilter) query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw error

      const rows = (data || []) as FacturaSaldoRow[]
      const descMap = await fetchDescripcionesFacturas(rows.map((r) => r.id))
      return rows.map((r) => ({ ...r, productos_desc: descMap.get(r.id) || null }))
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

export function useCarteraVencida(orgId?: string) {
  return useQuery({
    queryKey: ['reporte-cartera-vencida', orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, fecha, total, saldo, dias_vencida, cliente_nombre, moneda, sucursal_nombre')
        .eq('organizacion_id', orgId!)
        .gt('saldo', 0)
        .gt('dias_vencida', 0)
        .order('dias_vencida', { ascending: false })

      if (error) throw error

      const rows = (data || []) as CarteraVencidaRow[]
      const descMap = await fetchDescripcionesFacturas(rows.map((r) => r.id))
      return rows.map((r) => ({ ...r, productos_desc: descMap.get(r.id) || null }))
    },
    enabled: !!orgId,
  })
}

export function useCortesReporte(fechaDesde: string | null, fechaHasta: string | null, orgId?: string) {
  return useQuery({
    queryKey: ['reporte-cortes-caja', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_resumen_turno')
        .select('id, caja_nombre, caja_codigo, usuario_nombre, fecha_apertura, fecha_cierre, status, num_ventas, total_ventas, total_efectivo, total_tarjeta, total_transferencia, monto_apertura, monto_cierre_real, diferencia')
        .eq('organizacion_id', orgId!)
        .order('fecha_apertura', { ascending: false })

      if (fechaDesde) query = query.gte('fecha_apertura', `${fechaDesde}T00:00:00`)
      if (fechaHasta) query = query.lte('fecha_apertura', `${fechaHasta}T23:59:59`)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as ResumenTurnoReporte[]
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
