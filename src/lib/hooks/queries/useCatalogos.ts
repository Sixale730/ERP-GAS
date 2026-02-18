'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// Query keys factory
export const catalogosKeys = {
  categorias: ['categorias'] as const,
  listasPrecios: ['listas-precios'] as const,
  proveedores: ['proveedores'] as const,
  preciosProductos: ['precios-productos'] as const,
}

// ============ CATEGORIAS ============

export function useCategorias() {
  return useQuery({
    queryKey: catalogosKeys.categorias,
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('categorias')
        .select('*')
        .is('parent_id', null)
        .order('nombre')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ============ LISTAS DE PRECIOS ============

export function useListasPrecios() {
  return useQuery({
    queryKey: catalogosKeys.listasPrecios,
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ============ PROVEEDORES ============

export function useProveedores() {
  return useQuery({
    queryKey: catalogosKeys.proveedores,
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('proveedores')
        .select('*')
        .eq('is_active', true)
        .order('razon_social')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ============ PRECIOS DE PRODUCTOS ============

export interface PrecioProductoRow {
  id: string
  precio_id: string | null
  sku: string
  nombre: string
  proveedor_id: string | null
  proveedor_nombre: string | null
  precio: number | null
  precio_con_iva: number | null
  moneda: 'USD' | 'MXN' | null
  lista_nombre: string | null
  lista_id: string | null
}

export function usePreciosProductos() {
  return useQuery({
    queryKey: catalogosKeys.preciosProductos,
    queryFn: async (): Promise<PrecioProductoRow[]> => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .schema('erp')
        .from('productos')
        .select(`
          id,
          sku,
          nombre,
          proveedor_principal_id,
          proveedores:proveedor_principal_id (
            id,
            razon_social
          ),
          precios_productos (
            id,
            precio,
            precio_con_iva,
            moneda,
            lista_precio_id,
            listas_precios:lista_precio_id (
              id,
              nombre
            )
          )
        `)
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error

      const rows: PrecioProductoRow[] = []

      for (const producto of data || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proveedorData = producto.proveedores as any
        const proveedor = Array.isArray(proveedorData)
          ? proveedorData[0]
          : proveedorData

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const precios = producto.precios_productos as any[]

        if (precios && precios.length > 0) {
          for (const precio of precios) {
            const listaPrecioData = precio.listas_precios
            const listaPrecio = Array.isArray(listaPrecioData)
              ? listaPrecioData[0]
              : listaPrecioData

            rows.push({
              id: producto.id,
              precio_id: precio.id,
              sku: producto.sku,
              nombre: producto.nombre,
              proveedor_id: proveedor?.id || null,
              proveedor_nombre: proveedor?.razon_social || null,
              precio: precio.precio,
              precio_con_iva: precio.precio_con_iva,
              moneda: precio.moneda || 'USD',
              lista_nombre: listaPrecio?.nombre || null,
              lista_id: listaPrecio?.id || null,
            })
          }
        } else {
          rows.push({
            id: producto.id,
            precio_id: null,
            sku: producto.sku,
            nombre: producto.nombre,
            proveedor_id: proveedor?.id || null,
            proveedor_nombre: proveedor?.razon_social || null,
            precio: null,
            precio_con_iva: null,
            moneda: null,
            lista_nombre: null,
            lista_id: null,
          })
        }
      }

      return rows
    },
    staleTime: 1000 * 60 * 2,
  })
}
