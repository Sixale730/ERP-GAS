'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { OrdenCompraView, Proveedor, Almacen } from '@/types/database'
import type { PaginationParams, PaginatedResult } from './types'

// Query keys factory
export const ordenesCompraKeys = {
  all: ['ordenes-compra'] as const,
  lists: () => [...ordenesCompraKeys.all, 'list'] as const,
  list: (pagination?: PaginationParams) => [...ordenesCompraKeys.lists(), pagination] as const,
  proveedores: () => [...ordenesCompraKeys.all, 'proveedores'] as const,
  almacenes: () => [...ordenesCompraKeys.all, 'almacenes'] as const,
}

// Fetch ordenes de compra with pagination
async function fetchOrdenesCompra(pagination?: PaginationParams): Promise<PaginatedResult<OrdenCompraView>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_ordenes_compra')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as OrdenCompraView[], total: count || 0 }
}

// Fetch proveedores activos
async function fetchProveedores(): Promise<Proveedor[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('proveedores')
    .select('*')
    .eq('is_active', true)
    .order('razon_social')

  if (error) throw error
  return data || []
}

// Fetch almacenes activos
async function fetchAlmacenes(): Promise<Almacen[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('almacenes')
    .select('*')
    .eq('is_active', true)
    .order('nombre')

  if (error) throw error
  return data || []
}

// Hook: Lista de ordenes de compra
export function useOrdenesCompra(pagination?: PaginationParams) {
  return useQuery({
    queryKey: ordenesCompraKeys.list(pagination),
    queryFn: () => fetchOrdenesCompra(pagination),
  })
}

// Hook: Proveedores para filtros (catalogo estatico)
export function useProveedoresCompra() {
  return useQuery({
    queryKey: ordenesCompraKeys.proveedores(),
    queryFn: fetchProveedores,
    staleTime: 1000 * 60 * 10,
  })
}

// Hook: Almacenes para filtros (catalogo estatico)
export function useAlmacenesCompra() {
  return useQuery({
    queryKey: ordenesCompraKeys.almacenes(),
    queryFn: fetchAlmacenes,
    staleTime: 1000 * 60 * 10,
  })
}
