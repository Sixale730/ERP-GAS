import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProductoStock } from '@/types/database'
import type { PaginationParams, PaginatedResult } from './types'

// Query keys factory
export const productosKeys = {
  all: ['productos'] as const,
  lists: () => [...productosKeys.all, 'list'] as const,
  list: (pagination?: PaginationParams) => [...productosKeys.lists(), pagination] as const,
  details: () => [...productosKeys.all, 'detail'] as const,
  detail: (id: string) => [...productosKeys.details(), id] as const,
}

// Columns for listing (avoid select *)
// Fetch productos with server-side pagination
async function fetchProductos(pagination?: PaginationParams): Promise<PaginatedResult<ProductoStock>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_productos_stock')
    .select('*', { count: 'exact' })
    .order('nombre')

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as ProductoStock[], total: count || 0 }
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

// Hook: Lista de productos with server-side pagination
export function useProductos(pagination?: PaginationParams) {
  return useQuery({
    queryKey: productosKeys.list(pagination),
    queryFn: () => fetchProductos(pagination),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productosKeys.lists() })
    },
  })
}
