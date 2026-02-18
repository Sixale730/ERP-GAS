import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'
import type { PaginationParams, PaginatedResult } from './types'

// Query keys factory
export const clientesKeys = {
  all: ['clientes'] as const,
  lists: () => [...clientesKeys.all, 'list'] as const,
  list: (pagination?: PaginationParams) => [...clientesKeys.lists(), pagination] as const,
  details: () => [...clientesKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientesKeys.details(), id] as const,
}

// Fetch clientes with server-side pagination
async function fetchClientes(pagination?: PaginationParams): Promise<PaginatedResult<Cliente>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('clientes')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('nombre_comercial')

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as Cliente[], total: count || 0 }
}

// Fetch single cliente
async function fetchCliente(id: string): Promise<Cliente> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Delete (soft delete) cliente
async function deleteCliente(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .schema('erp')
    .from('clientes')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw error
  return id
}

// Hook: Lista de clientes with server-side pagination
export function useClientes(pagination?: PaginationParams) {
  return useQuery({
    queryKey: clientesKeys.list(pagination),
    queryFn: () => fetchClientes(pagination),
  })
}

// Hook: Detalle de cliente
export function useCliente(id: string) {
  return useQuery({
    queryKey: clientesKeys.detail(id),
    queryFn: () => fetchCliente(id),
    enabled: !!id,
  })
}

// Hook: Eliminar cliente (soft delete)
export function useDeleteCliente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCliente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.lists() })
    },
  })
}
