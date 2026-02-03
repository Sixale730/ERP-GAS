import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'

// Query keys factory
export const clientesKeys = {
  all: ['clientes'] as const,
  lists: () => [...clientesKeys.all, 'list'] as const,
  list: (filters?: { search?: string }) => [...clientesKeys.lists(), filters] as const,
  details: () => [...clientesKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientesKeys.details(), id] as const,
}

// Fetch all clientes
async function fetchClientes(): Promise<Cliente[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('clientes')
    .select('*')
    .eq('is_active', true)
    .order('nombre_comercial')

  if (error) throw error
  return data || []
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

// Hook: Lista de clientes
export function useClientes() {
  return useQuery({
    queryKey: clientesKeys.lists(),
    queryFn: fetchClientes,
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
    // Optimistic update
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: clientesKeys.lists() })

      const previousClientes = queryClient.getQueryData<Cliente[]>(clientesKeys.lists())

      if (previousClientes) {
        queryClient.setQueryData<Cliente[]>(
          clientesKeys.lists(),
          previousClientes.filter((c) => c.id !== deletedId)
        )
      }

      return { previousClientes }
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousClientes) {
        queryClient.setQueryData(clientesKeys.lists(), context.previousClientes)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.lists() })
    },
  })
}
