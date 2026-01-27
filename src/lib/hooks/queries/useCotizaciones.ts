import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  list: (filters?: { status?: string | null }) => [...cotizacionesKeys.lists(), filters] as const,
  details: () => [...cotizacionesKeys.all, 'detail'] as const,
  detail: (id: string) => [...cotizacionesKeys.details(), id] as const,
}

// Fetch cotizaciones with optional status filter
async function fetchCotizaciones(statusFilter?: string | null): Promise<CotizacionRow[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('*')
    .like('folio', 'COT-%')  // Solo cotizaciones, excluir ordenes de venta (OV-)
    .order('fecha', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Fetch single cotización with items
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

// Delete cotización
async function deleteCotizacion(cotizacion: CotizacionRow) {
  if (cotizacion.status !== 'propuesta') {
    throw new Error('Solo se pueden eliminar cotizaciones en status "Propuesta"')
  }

  const supabase = getSupabaseClient()

  // Primero eliminar los items
  const { error: itemsError } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .delete()
    .eq('cotizacion_id', cotizacion.id)

  if (itemsError) throw itemsError

  // Luego eliminar la cotización
  const { error: cotError } = await supabase
    .schema('erp')
    .from('cotizaciones')
    .delete()
    .eq('id', cotizacion.id)

  if (cotError) throw cotError

  return cotizacion.id
}

// Hook: Lista de cotizaciones
export function useCotizaciones(statusFilter?: string | null) {
  return useQuery({
    queryKey: cotizacionesKeys.list({ status: statusFilter }),
    queryFn: () => fetchCotizaciones(statusFilter),
  })
}

// Hook: Detalle de cotización
export function useCotizacion(id: string) {
  return useQuery({
    queryKey: cotizacionesKeys.detail(id),
    queryFn: () => fetchCotizacion(id),
    enabled: !!id,
  })
}

// Hook: Eliminar cotización
export function useDeleteCotizacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCotizacion,
    onMutate: async (cotizacion) => {
      // Cancelar todas las queries de cotizaciones
      await queryClient.cancelQueries({ queryKey: cotizacionesKeys.lists() })

      // Obtener snapshots de todas las listas
      const queriesData = queryClient.getQueriesData<CotizacionRow[]>({
        queryKey: cotizacionesKeys.lists()
      })

      // Actualizar optimísticamente todas las listas
      queriesData.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<CotizacionRow[]>(
            queryKey,
            data.filter((c) => c.id !== cotizacion.id)
          )
        }
      })

      return { queriesData }
    },
    onError: (_err, _cotizacion, context) => {
      // Restaurar todas las listas
      context?.queriesData.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(queryKey, data)
        }
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cotizacionesKeys.lists() })
    },
  })
}
