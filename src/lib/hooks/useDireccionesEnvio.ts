'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { DireccionEnvio, DireccionEnvioInsert, DireccionEnvioUpdate } from '@/types/database'

// Query keys
export const direccionesEnvioKeys = {
  all: ['direcciones_envio'] as const,
  byCliente: (clienteId: string) => ['direcciones_envio', 'cliente', clienteId] as const,
  detail: (id: string) => ['direcciones_envio', 'detail', id] as const,
}

// Hook to fetch all addresses for a client
export function useDireccionesEnvio(clienteId: string | null) {
  return useQuery({
    queryKey: clienteId ? direccionesEnvioKeys.byCliente(clienteId) : ['direcciones_envio', 'none'],
    queryFn: async (): Promise<DireccionEnvio[]> => {
      if (!clienteId) return []

      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('alias')

      if (error) throw error
      return data || []
    },
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Hook to fetch a single address
export function useDireccionEnvio(id: string | null) {
  return useQuery({
    queryKey: id ? direccionesEnvioKeys.detail(id) : ['direcciones_envio', 'none'],
    queryFn: async (): Promise<DireccionEnvio | null> => {
      if (!id) return null

      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// Hook to create a new address
export function useCreateDireccionEnvio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DireccionEnvioInsert): Promise<DireccionEnvio> => {
      const supabase = getSupabaseClient()
      const { data: created, error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return created
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: direccionesEnvioKeys.byCliente(data.cliente_id) })
    },
  })
}

// Hook to update an address
export function useUpdateDireccionEnvio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: DireccionEnvioUpdate & { id: string }): Promise<DireccionEnvio> => {
      const supabase = getSupabaseClient()
      const { data: updated, error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: direccionesEnvioKeys.byCliente(data.cliente_id) })
      queryClient.invalidateQueries({ queryKey: direccionesEnvioKeys.detail(data.id) })
    },
  })
}

// Hook to delete (soft delete) an address
export function useDeleteDireccionEnvio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, clienteId }: { id: string; clienteId: string }): Promise<void> => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: direccionesEnvioKeys.byCliente(variables.clienteId) })
    },
  })
}

// Hook to set an address as default
export function useSetDefaultDireccion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, clienteId }: { id: string; clienteId: string }): Promise<void> => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('direcciones_envio')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: direccionesEnvioKeys.byCliente(variables.clienteId) })
    },
  })
}

// Get default address from a list
export function getDefaultDireccion(direcciones: DireccionEnvio[]): DireccionEnvio | null {
  return direcciones.find(d => d.is_default) || direcciones[0] || null
}

// Format address as a single string
export function formatDireccion(direccion: DireccionEnvio | null): string {
  if (!direccion) return ''

  const parts: string[] = []

  if (direccion.calle) {
    let calle = direccion.calle
    if (direccion.numero_exterior) calle += ` ${direccion.numero_exterior}`
    if (direccion.numero_interior) calle += ` Int. ${direccion.numero_interior}`
    parts.push(calle)
  }

  if (direccion.colonia) parts.push(direccion.colonia)

  const cityParts: string[] = []
  if (direccion.ciudad) cityParts.push(direccion.ciudad)
  if (direccion.estado) cityParts.push(direccion.estado)
  if (cityParts.length > 0) parts.push(cityParts.join(', '))

  if (direccion.codigo_postal) parts.push(`C.P. ${direccion.codigo_postal}`)
  if (direccion.pais && direccion.pais !== 'México') parts.push(direccion.pais)

  return parts.join(', ')
}

// Format address as short display
export function formatDireccionCorta(direccion: DireccionEnvio | null): string {
  if (!direccion) return ''

  const parts: string[] = []
  if (direccion.calle) {
    let calle = direccion.calle
    if (direccion.numero_exterior) calle += ` ${direccion.numero_exterior}`
    parts.push(calle)
  }
  if (direccion.colonia) parts.push(direccion.colonia)
  if (direccion.ciudad) parts.push(direccion.ciudad)

  return parts.join(', ')
}
