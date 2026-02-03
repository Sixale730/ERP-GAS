import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  list: (filters?: { status?: string | null }) => [...facturasKeys.lists(), filters] as const,
  details: () => [...facturasKeys.all, 'detail'] as const,
  detail: (id: string) => [...facturasKeys.details(), id] as const,
}

// Fetch facturas with optional status filter
async function fetchFacturas(statusFilter?: string | null): Promise<FacturaRow[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_facturas')
    .select('*')
    .order('fecha', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
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

// Hook: Lista de facturas
export function useFacturas(statusFilter?: string | null) {
  return useQuery({
    queryKey: facturasKeys.list({ status: statusFilter }),
    queryFn: () => fetchFacturas(statusFilter),
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

// Hook: Invalidar cache de facturas (para usar después de crear una factura)
export function useInvalidateFacturas() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: facturasKeys.all })
  }
}
