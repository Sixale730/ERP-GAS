import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'
import type { PaginationParams, PaginatedResult } from './types'

export interface FacturaRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  saldo: number
  moneda: 'USD' | 'MXN'
  fecha_vencimiento: string | null
  direccion_envio_id: string | null
  sucursal_nombre: string | null
  dias_vencida: number
  cliente_nombre?: string
  almacen_nombre?: string
}

// Query keys factory
export const facturasKeys = {
  all: ['facturas'] as const,
  lists: () => [...facturasKeys.all, 'list'] as const,
  list: (filters?: { status?: string | null; pagination?: PaginationParams; search?: string }) => [...facturasKeys.lists(), filters] as const,
  details: () => [...facturasKeys.all, 'detail'] as const,
  detail: (id: string) => [...facturasKeys.details(), id] as const,
}

const FACTURAS_LIST_COLUMNS = 'id, folio, fecha, fecha_vencimiento, status, total, saldo, moneda, direccion_envio_id, sucursal_nombre, dias_vencida, cliente_nombre, almacen_nombre'

// Fetch facturas with optional status filter and pagination
async function fetchFacturas(statusFilter?: string | null, pagination?: PaginationParams, search?: string): Promise<PaginatedResult<FacturaRow>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_facturas')
    .select(FACTURAS_LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (search) {
    const s = sanitizeSearchInput(search)
    query = query.or(`folio.ilike.%${s}%,cliente_nombre.ilike.%${s}%`)
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
export function useFacturas(statusFilter?: string | null, pagination?: PaginationParams, search?: string) {
  return useQuery({
    queryKey: facturasKeys.list({ status: statusFilter, pagination, search }),
    queryFn: () => fetchFacturas(statusFilter, pagination, search),
  })
}

export interface FacturasResumen {
  porCobrarUSD: number
  porCobrarMXN: number
  vencidas: number
}

// Agrega saldos y facturas vencidas sobre TODAS las facturas que cumplen el
// filtro (status + búsqueda), independiente de la paginación. El encabezado
// del listado no debe sumar solo la página visible.
async function fetchFacturasResumen(statusFilter?: string | null, search?: string): Promise<FacturasResumen> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_facturas')
    .select('saldo, moneda, dias_vencida, status')

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (search) {
    const s = sanitizeSearchInput(search)
    query = query.or(`folio.ilike.%${s}%,cliente_nombre.ilike.%${s}%`)
  }

  const { data, error } = await query
  if (error) throw error

  let porCobrarUSD = 0
  let porCobrarMXN = 0
  let vencidas = 0
  for (const f of (data || []) as Array<{ saldo: number; moneda: 'USD' | 'MXN'; dias_vencida: number; status: string }>) {
    if (f.status !== 'cancelada') {
      if (f.moneda === 'MXN') porCobrarMXN += f.saldo
      else porCobrarUSD += f.saldo
    }
    if (f.dias_vencida > 0 && f.status !== 'pagada') vencidas++
  }
  return { porCobrarUSD, porCobrarMXN, vencidas }
}

// Hook: Resumen (por cobrar + vencidas) sobre todas las facturas del filtro
export function useFacturasResumen(statusFilter?: string | null, search?: string) {
  return useQuery({
    queryKey: [...facturasKeys.lists(), 'resumen', { status: statusFilter ?? null, search: search ?? '' }],
    queryFn: () => fetchFacturasResumen(statusFilter, search),
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
    queryClient.invalidateQueries({ queryKey: facturasKeys.lists() })
  }
}
