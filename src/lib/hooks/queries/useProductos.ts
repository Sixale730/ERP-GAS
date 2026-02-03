import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProductoStock } from '@/types/database'

// Query keys factory
export const productosKeys = {
  all: ['productos'] as const,
  lists: () => [...productosKeys.all, 'list'] as const,
  list: (filters?: { search?: string }) => [...productosKeys.lists(), filters] as const,
  details: () => [...productosKeys.all, 'detail'] as const,
  detail: (id: string) => [...productosKeys.details(), id] as const,
}

// Fetch all productos with stock info
async function fetchProductos(): Promise<ProductoStock[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('v_productos_stock')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data || []
}

// Fetch single producto
async function fetchProducto(id: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Delete (soft delete) producto
async function deleteProducto(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .schema('erp')
    .from('productos')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw error
  return id
}

// Hook: Lista de productos
export function useProductos() {
  return useQuery({
    queryKey: productosKeys.lists(),
    queryFn: fetchProductos,
  })
}

// Hook: Detalle de producto
export function useProducto(id: string) {
  return useQuery({
    queryKey: productosKeys.detail(id),
    queryFn: () => fetchProducto(id),
    enabled: !!id,
  })
}

// Hook: Eliminar producto (soft delete)
export function useDeleteProducto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProducto,
    // Optimistic update
    onMutate: async (deletedId) => {
      // Cancelar queries en curso
      await queryClient.cancelQueries({ queryKey: productosKeys.lists() })

      // Snapshot del estado anterior
      const previousProductos = queryClient.getQueryData<ProductoStock[]>(productosKeys.lists())

      // Actualizar optimísticamente
      if (previousProductos) {
        queryClient.setQueryData<ProductoStock[]>(
          productosKeys.lists(),
          previousProductos.filter((p) => p.id !== deletedId)
        )
      }

      return { previousProductos }
    },
    // Rollback en caso de error
    onError: (_err, _deletedId, context) => {
      if (context?.previousProductos) {
        queryClient.setQueryData(productosKeys.lists(), context.previousProductos)
      }
    },
    // Invalidar cache al éxito
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productosKeys.lists() })
    },
  })
}
