import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  list: (filtro?: FiltroStatusOV) => [...ordenesVentaKeys.lists(), filtro] as const,
  details: () => [...ordenesVentaKeys.all, 'detail'] as const,
  detail: (id: string) => [...ordenesVentaKeys.details(), id] as const,
}

// Fetch ordenes de venta with optional status filter
async function fetchOrdenesVenta(filtro?: FiltroStatusOV): Promise<OrdenVentaRow[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('*')
    .like('folio', 'OV-%')
    .order('fecha', { ascending: false })

  // Filtrar por status según el filtro seleccionado
  if (filtro === 'todas' || !filtro) {
    query = query.in('status', ['orden_venta', 'factura'])
  } else if (filtro === 'pendientes') {
    query = query.eq('status', 'orden_venta')
  } else if (filtro === 'facturadas') {
    query = query.eq('status', 'factura')
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
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
    throw new Error('Solo se pueden eliminar órdenes de venta pendientes')
  }

  const supabase = getSupabaseClient()

  // Primero eliminar los items
  const { error: itemsError } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .delete()
    .eq('cotizacion_id', orden.id)

  if (itemsError) throw itemsError

  // Luego eliminar la orden
  const { error: ovError } = await supabase
    .schema('erp')
    .from('cotizaciones')
    .delete()
    .eq('id', orden.id)

  if (ovError) throw ovError

  return orden.id
}

// Hook: Lista de ordenes de venta
export function useOrdenesVenta(filtro?: FiltroStatusOV) {
  return useQuery({
    queryKey: ordenesVentaKeys.list(filtro),
    queryFn: () => fetchOrdenesVenta(filtro),
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
    onMutate: async (orden) => {
      // Cancelar todas las queries de ordenes
      await queryClient.cancelQueries({ queryKey: ordenesVentaKeys.lists() })

      // Obtener snapshots de todas las listas
      const queriesData = queryClient.getQueriesData<OrdenVentaRow[]>({
        queryKey: ordenesVentaKeys.lists()
      })

      // Actualizar optimísticamente todas las listas
      queriesData.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<OrdenVentaRow[]>(
            queryKey,
            data.filter((o) => o.id !== orden.id)
          )
        }
      })

      return { queriesData }
    },
    onError: (_err, _orden, context) => {
      // Restaurar todas las listas
      context?.queriesData.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(queryKey, data)
        }
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordenesVentaKeys.lists() })
    },
  })
}
