import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { PaginationParams, PaginatedResult } from './types'

export interface CotizacionRow {
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
  created_at?: string
  updated_at?: string
}

// Query keys factory
export const cotizacionesKeys = {
  all: ['cotizaciones'] as const,
  lists: () => [...cotizacionesKeys.all, 'list'] as const,
  list: (filters?: { status?: string | null; pagination?: PaginationParams }) => [...cotizacionesKeys.lists(), filters] as const,
  details: () => [...cotizacionesKeys.all, 'detail'] as const,
  detail: (id: string) => [...cotizacionesKeys.details(), id] as const,
}

const COTIZACIONES_LIST_COLUMNS = 'id, folio, fecha, vigencia_dias, status, total, moneda, cliente_nombre, cliente_rfc, almacen_nombre, created_at, updated_at'

// Fetch cotizaciones with optional status filter and pagination
async function fetchCotizaciones(statusFilter?: string | null, pagination?: PaginationParams): Promise<PaginatedResult<CotizacionRow>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select(COTIZACIONES_LIST_COLUMNS, { count: 'exact' })
    .like('folio', 'COT-%')
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
  return { data: (data || []) as CotizacionRow[], total: count || 0 }
}

// Fetch single cotizacion with items
async function fetchCotizacion(id: string) {
  const supabase = getSupabaseClient()

  const { data: cotData, error: cotError } = await supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('*')
    .eq('id', id)
    .single()

  if (cotError) throw cotError

  const { data: itemsData, error: itemsError } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .select('*, productos:producto_id (sku)')
    .eq('cotizacion_id', id)

  if (itemsError) throw itemsError

  return {
    ...cotData,
    items: itemsData?.map(item => ({
      ...item,
      sku: item.productos?.sku || '-'
    })) || []
  }
}

// Delete cotizacion using transactional RPC
async function deleteCotizacion(cotizacion: CotizacionRow) {
  if (cotizacion.status !== 'propuesta') {
    throw new Error('Solo se pueden eliminar cotizaciones en status "Propuesta"')
  }

  const supabase = getSupabaseClient()

  const { error } = await supabase
    .schema('erp')
    .rpc('eliminar_cotizacion' as any, {
      p_cotizacion_id: cotizacion.id,
    })

  if (error) throw error

  return cotizacion.id
}

// Hook: Lista de cotizaciones with server-side pagination
export function useCotizaciones(statusFilter?: string | null, pagination?: PaginationParams) {
  return useQuery({
    queryKey: cotizacionesKeys.list({ status: statusFilter, pagination }),
    queryFn: () => fetchCotizaciones(statusFilter, pagination),
  })
}

// Hook: Detalle de cotizacion
export function useCotizacion(id: string) {
  return useQuery({
    queryKey: cotizacionesKeys.detail(id),
    queryFn: () => fetchCotizacion(id),
    enabled: !!id,
  })
}

// Hook: Eliminar cotizacion
export function useDeleteCotizacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCotizacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cotizacionesKeys.lists() })
    },
  })
}
