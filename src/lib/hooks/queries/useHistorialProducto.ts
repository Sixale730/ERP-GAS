'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { HistorialProductoItem } from '@/types/database'
import type { PaginationParams } from './types'

// Query keys factory
export const historialProductoKeys = {
  all: ['historial-producto'] as const,
  list: (productoId: string, pagination?: PaginationParams) =>
    [...historialProductoKeys.all, productoId, pagination] as const,
  count: (productoId: string) =>
    [...historialProductoKeys.all, productoId, 'count'] as const,
}

async function fetchHistorialProducto(
  productoId: string,
  pagination?: PaginationParams
): Promise<HistorialProductoItem[]> {
  const supabase = getSupabaseClient()
  const limit = pagination?.pageSize ?? 50
  const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0

  const { data, error } = await supabase.schema('erp').rpc('historial_producto_unificado', {
    p_producto_id: productoId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) throw error
  return (data || []) as HistorialProductoItem[]
}

async function fetchHistorialProductoCount(productoId: string): Promise<number> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.schema('erp').rpc('historial_producto_unificado_count', {
    p_producto_id: productoId,
  })

  if (error) throw error
  return (data as number) || 0
}

export function useHistorialProducto(productoId: string, pagination?: PaginationParams) {
  return useQuery({
    queryKey: historialProductoKeys.list(productoId, pagination),
    queryFn: () => fetchHistorialProducto(productoId, pagination),
    enabled: !!productoId,
  })
}

export function useHistorialProductoCount(productoId: string) {
  return useQuery({
    queryKey: historialProductoKeys.count(productoId),
    queryFn: () => fetchHistorialProductoCount(productoId),
    enabled: !!productoId,
  })
}
