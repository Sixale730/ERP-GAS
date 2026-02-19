import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { PaginationParams, PaginatedResult } from './types'

export interface OrdenVentaRow {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  total: number
  moneda: 'USD' | 'MXN'
  cliente_nombre?: string
  cliente_rfc?: string
  almacen_nombre?: string
  factura_id?: string
  created_at?: string
  updated_at?: string
}

export type FiltroStatusOV = 'todas' | 'pendientes' | 'facturadas'

// Query keys factory
export const ordenesVentaKeys = {
  all: ['ordenes-venta'] as const,
  lists: () => [...ordenesVentaKeys.all, 'list'] as const,
  list: (filtro?: FiltroStatusOV, pagination?: PaginationParams) => [...ordenesVentaKeys.lists(), filtro, pagination] as const,
  details: () => [...ordenesVentaKeys.all, 'detail'] as const,
  detail: (id: string) => [...ordenesVentaKeys.details(), id] as const,
}

const OV_LIST_COLUMNS = 'id, folio, fecha, vigencia_dias, status, total, moneda, cliente_nombre, cliente_rfc, almacen_nombre, factura_id, created_at, updated_at'

// Fetch ordenes de venta with optional status filter and pagination
async function fetchOrdenesVenta(filtro?: FiltroStatusOV, pagination?: PaginationParams): Promise<PaginatedResult<OrdenVentaRow>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select(OV_LIST_COLUMNS, { count: 'exact' })
    .like('folio', 'OV-%')
    .order('fecha', { ascending: false })

  if (filtro === 'pendientes') {
    query = query.eq('status', 'orden_venta')
  } else if (filtro === 'facturadas') {
    query = query.eq('status', 'facturada')
  } else {
    query = query.in('status', ['orden_venta', 'facturada'])
  }

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as OrdenVentaRow[], total: count || 0 }
}

// Fetch single orden de venta with items
async function fetchOrdenVenta(id: string) {
  const supabase = getSupabaseClient()

  const { data: ovData, error: ovError } = await supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('*')
    .eq('id', id)
    .single()

  if (ovError) throw ovError

  const { data: itemsData, error: itemsError } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .select('*, productos:producto_id (sku)')
    .eq('cotizacion_id', id)

  if (itemsError) throw itemsError

  return {
    ...ovData,
    items: itemsData?.map(item => ({
      ...item,
      sku: item.productos?.sku || '-'
    })) || []
  }
}

// Delete orden de venta
async function deleteOrdenVenta(orden: OrdenVentaRow) {
  if (orden.status !== 'orden_venta') {
    throw new Error('Solo se pueden eliminar ordenes de venta pendientes')
  }

  const supabase = getSupabaseClient()

  const { error: itemsError } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .delete()
    .eq('cotizacion_id', orden.id)

  if (itemsError) throw itemsError

  const { error: ovError } = await supabase
    .schema('erp')
    .from('cotizaciones')
    .delete()
    .eq('id', orden.id)

  if (ovError) throw ovError

  return orden.id
}

// Hook: Lista de ordenes de venta with server-side pagination
export function useOrdenesVenta(filtro?: FiltroStatusOV, pagination?: PaginationParams) {
  return useQuery({
    queryKey: ordenesVentaKeys.list(filtro, pagination),
    queryFn: () => fetchOrdenesVenta(filtro, pagination),
  })
}

// Hook: Detalle de orden de venta
export function useOrdenVenta(id: string) {
  return useQuery({
    queryKey: ordenesVentaKeys.detail(id),
    queryFn: () => fetchOrdenVenta(id),
    enabled: !!id,
  })
}

// Hook: Eliminar orden de venta
export function useDeleteOrdenVenta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteOrdenVenta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordenesVentaKeys.lists() })
    },
  })
}
