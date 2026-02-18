import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { PaginationParams, PaginatedResult } from './types'

export interface FacturaRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  saldo: number
  moneda: 'USD' | 'MXN'
  dias_vencida: number
  cliente_nombre?: string
  almacen_nombre?: string
}

// Query keys factory
export const facturasKeys = {
  all: ['facturas'] as const,
  lists: () => [...facturasKeys.all, 'list'] as const,
  list: (filters?: { status?: string | null; pagination?: PaginationParams }) => [...facturasKeys.lists(), filters] as const,
  details: () => [...facturasKeys.all, 'detail'] as const,
  detail: (id: string) => [...facturasKeys.details(), id] as const,
}

const FACTURAS_LIST_COLUMNS = 'id, folio, fecha, status, total, saldo, moneda, dias_vencida, cliente_nombre, almacen_nombre'

// Fetch facturas with optional status filter and pagination
async function fetchFacturas(statusFilter?: string | null, pagination?: PaginationParams): Promise<PaginatedResult<FacturaRow>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_facturas')
    .select(FACTURAS_LIST_COLUMNS, { count: 'exact' })
    .order('fecha', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as FacturaRow[], total: count || 0 }
}

// Fetch single factura with items
async function fetchFactura(id: string) {
  const supabase = getSupabaseClient()

  const { data: facData, error: facError } = await supabase
    .schema('erp')
    .from('v_facturas')
    .select('*')
    .eq('id', id)
    .single()

  if (facError) throw facError

  const { data: itemsData, error: itemsError } = await supabase
    .schema('erp')
    .from('factura_items')
    .select('*, productos:producto_id (sku)')
    .eq('factura_id', id)

  if (itemsError) throw itemsError

  return {
    ...facData,
    items: itemsData?.map(item => ({
      ...item,
      sku: item.productos?.sku || '-'
    })) || []
  }
}

// Hook: Lista de facturas with server-side pagination
export function useFacturas(statusFilter?: string | null, pagination?: PaginationParams) {
  return useQuery({
    queryKey: facturasKeys.list({ status: statusFilter, pagination }),
    queryFn: () => fetchFacturas(statusFilter, pagination),
  })
}

// Hook: Detalle de factura
export function useFactura(id: string) {
  return useQuery({
    queryKey: facturasKeys.detail(id),
    queryFn: () => fetchFactura(id),
    enabled: !!id,
  })
}

// Hook: Invalidar cache de facturas
export function useInvalidateFacturas() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: facturasKeys.all })
  }
}
