'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { queryKeys } from './useQueries'

// Query keys for precios productos
export const preciosProductosKeys = {
  all: ['precios-productos'] as const,
  byProducto: (productoId: string) => ['precios-productos', 'producto', productoId] as const,
}

// Tipo extendido con nombre de lista
export interface PrecioConLista {
  id: string
  producto_id: string
  lista_precio_id: string
  lista_nombre: string
  precio: number
  precio_con_iva: number | null
}

// Hook para obtener precios de un producto específico
export function usePreciosProducto(productoId: string) {
  return useQuery({
    queryKey: preciosProductosKeys.byProducto(productoId),
    queryFn: async (): Promise<PrecioConLista[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select(`
          id,
          producto_id,
          lista_precio_id,
          precio,
          precio_con_iva,
          listas_precios:lista_precio_id (nombre)
        `)
        .eq('producto_id', productoId)

      if (error) throw error

      return (data || []).map(p => ({
        id: p.id,
        producto_id: p.producto_id,
        lista_precio_id: p.lista_precio_id,
        lista_nombre: (p.listas_precios as any)?.nombre || 'Sin nombre',
        precio: p.precio,
        precio_con_iva: p.precio_con_iva,
      }))
    },
    enabled: !!productoId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  })
}

// Hook para crear un precio
export function useCreatePrecioProducto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      producto_id: string
      lista_precio_id: string
      precio: number
      precio_con_iva?: number | null
    }) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .insert({
          producto_id: data.producto_id,
          lista_precio_id: data.lista_precio_id,
          precio: data.precio,
          precio_con_iva: data.precio_con_iva ?? null,
        })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      // Invalidar cache de precios del producto
      queryClient.invalidateQueries({ queryKey: preciosProductosKeys.byProducto(variables.producto_id) })
      // Invalidar cache del catálogo general
      queryClient.invalidateQueries({ queryKey: queryKeys.preciosProductos })
    },
  })
}

// Hook para actualizar un precio
export function useUpdatePrecioProducto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: string
      producto_id: string
      precio: number
      precio_con_iva?: number | null
    }) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .update({
          precio: data.precio,
          precio_con_iva: data.precio_con_iva ?? null,
        })
        .eq('id', data.id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      // Invalidar cache de precios del producto
      queryClient.invalidateQueries({ queryKey: preciosProductosKeys.byProducto(variables.producto_id) })
      // Invalidar cache del catálogo general
      queryClient.invalidateQueries({ queryKey: queryKeys.preciosProductos })
    },
  })
}

// Hook para eliminar un precio
export function useDeletePrecioProducto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { id: string; producto_id: string }) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .delete()
        .eq('id', data.id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      // Invalidar cache de precios del producto
      queryClient.invalidateQueries({ queryKey: preciosProductosKeys.byProducto(variables.producto_id) })
      // Invalidar cache del catálogo general
      queryClient.invalidateQueries({ queryKey: queryKeys.preciosProductos })
    },
  })
}
