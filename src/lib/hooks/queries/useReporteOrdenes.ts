import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { OrdenCompraView } from '@/types/database'
import type { OrdenVentaRow } from './useOrdenesVenta'

// ---- Órdenes de Venta (reporte sin paginación) ----

export interface FiltrosReporteOV {
  status?: 'todas' | 'pendientes' | 'facturadas'
  fechaDesde?: string | null
  fechaHasta?: string | null
  moneda?: 'USD' | 'MXN' | 'todas'
}

async function fetchReporteOrdenesVenta(filtros: FiltrosReporteOV): Promise<OrdenVentaRow[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('id, folio, fecha, vigencia_dias, status, subtotal, descuento_monto, iva, total, moneda, tipo_cambio, cliente_nombre, cliente_rfc, almacen_nombre, factura_id, vendedor_nombre, created_at, updated_at')
    .like('folio', 'OV-%')
    .order('fecha', { ascending: false })
    .limit(5000)

  if (filtros.status === 'pendientes') {
    query = query.eq('status', 'orden_venta')
  } else if (filtros.status === 'facturadas') {
    query = query.eq('status', 'facturada')
  } else {
    query = query.in('status', ['orden_venta', 'facturada'])
  }

  if (filtros.fechaDesde) {
    query = query.gte('fecha', filtros.fechaDesde)
  }
  if (filtros.fechaHasta) {
    query = query.lte('fecha', filtros.fechaHasta)
  }
  if (filtros.moneda && filtros.moneda !== 'todas') {
    query = query.eq('moneda', filtros.moneda)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as OrdenVentaRow[]
}

export function useReporteOrdenesVenta(filtros: FiltrosReporteOV) {
  return useQuery({
    queryKey: ['reporte-ordenes-venta', filtros],
    queryFn: () => fetchReporteOrdenesVenta(filtros),
  })
}

// ---- Órdenes de Compra (reporte sin paginación) ----

export interface FiltrosReporteOC {
  status?: string
  proveedorId?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
}

async function fetchReporteOrdenesCompra(filtros: FiltrosReporteOC): Promise<OrdenCompraView[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_ordenes_compra')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (filtros.status && filtros.status !== 'todas') {
    query = query.eq('status', filtros.status)
  }
  if (filtros.proveedorId) {
    query = query.eq('proveedor_id', filtros.proveedorId)
  }
  if (filtros.fechaDesde) {
    query = query.gte('fecha', filtros.fechaDesde)
  }
  if (filtros.fechaHasta) {
    query = query.lte('fecha', filtros.fechaHasta)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as OrdenCompraView[]
}

export function useReporteOrdenesCompra(filtros: FiltrosReporteOC) {
  return useQuery({
    queryKey: ['reporte-ordenes-compra', filtros],
    queryFn: () => fetchReporteOrdenesCompra(filtros),
  })
}
