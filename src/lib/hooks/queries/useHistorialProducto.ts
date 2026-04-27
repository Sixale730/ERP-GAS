'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { HistorialProductoItem, HistorialProductoTipo, HistorialProductoCount } from '@/types/database'
import type { PaginationParams } from './types'

// Query keys factory
export const historialProductoKeys = {
  all: ['historial-producto'] as const,
  list: (productoId: string, pagination?: PaginationParams, tipos?: HistorialProductoTipo[]) =>
    [...historialProductoKeys.all, productoId, pagination, tipos ?? 'all'] as const,
  count: (productoId: string, tipos?: HistorialProductoTipo[]) =>
    [...historialProductoKeys.all, productoId, 'count', tipos ?? 'all'] as const,
  countsPorTipo: (productoId: string) =>
    [...historialProductoKeys.all, productoId, 'counts-por-tipo'] as const,
}

async function fetchHistorialProducto(
  productoId: string,
  pagination?: PaginationParams,
  tipos?: HistorialProductoTipo[]
): Promise<HistorialProductoItem[]> {
  const supabase = getSupabaseClient()
  const limit = pagination?.pageSize ?? 50
  const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0

  const { data, error } = await supabase.schema('erp').rpc('historial_producto_unificado', {
    p_producto_id: productoId,
    p_limit: limit,
    p_offset: offset,
    p_tipos: tipos && tipos.length > 0 ? tipos : null,
  })

  if (error) throw error
  return (data || []) as HistorialProductoItem[]
}

async function fetchHistorialProductoCount(
  productoId: string,
  tipos?: HistorialProductoTipo[]
): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.schema('erp').rpc('historial_producto_unificado_count', {
    p_producto_id: productoId,
    p_tipos: tipos && tipos.length > 0 ? tipos : null,
  })
  if (error) throw error
  return (data as number) || 0
}

async function fetchHistorialCountsPorTipo(productoId: string): Promise<HistorialProductoCount[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.schema('erp').rpc('historial_producto_counts_por_tipo', {
    p_producto_id: productoId,
  })
  if (error) throw error
  return (data || []) as HistorialProductoCount[]
}

export function useHistorialProducto(
  productoId: string,
  pagination?: PaginationParams,
  tipos?: HistorialProductoTipo[]
) {
  return useQuery({
    queryKey: historialProductoKeys.list(productoId, pagination, tipos),
    queryFn: () => fetchHistorialProducto(productoId, pagination, tipos),
    enabled: !!productoId,
  })
}

export function useHistorialProductoCount(productoId: string, tipos?: HistorialProductoTipo[]) {
  return useQuery({
    queryKey: historialProductoKeys.count(productoId, tipos),
    queryFn: () => fetchHistorialProductoCount(productoId, tipos),
    enabled: !!productoId,
  })
}

export function useHistorialCountsPorTipo(productoId: string) {
  return useQuery({
    queryKey: historialProductoKeys.countsPorTipo(productoId),
    queryFn: () => fetchHistorialCountsPorTipo(productoId),
    enabled: !!productoId,
    staleTime: 5 * 60 * 1000,
  })
}
