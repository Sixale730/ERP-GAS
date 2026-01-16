'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProductoStock, Cliente } from '@/types/database'

// Keys para React Query
export const queryKeys = {
  productos: ['productos'] as const,
  productosStock: ['productos', 'stock'] as const,
  producto: (id: string) => ['productos', id] as const,
  clientes: ['clientes'] as const,
  cliente: (id: string) => ['clientes', id] as const,
  cotizaciones: (status?: string | null) => ['cotizaciones', { status }] as const,
  cotizacion: (id: string) => ['cotizaciones', 'detail', id] as const,
  cotizacionItems: (id: string) => ['cotizaciones', 'items', id] as const,
  facturas: ['facturas'] as const,
  factura: (id: string) => ['facturas', id] as const,
  almacenes: ['almacenes'] as const,
  inventario: (almacenId?: string) => ['inventario', { almacenId }] as const,
  movimientos: (almacenId?: string) => ['movimientos', { almacenId }] as const,
  dashboard: ['dashboard'] as const,
  categorias: ['categorias'] as const,
  listasPrecios: ['listas-precios'] as const,
}

// ============ PRODUCTOS ============

export function useProductosStock() {
  return useQuery({
    queryKey: queryKeys.productosStock,
    queryFn: async (): Promise<ProductoStock[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('*')
        .order('nombre')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  })
}

export function useProducto(id: string) {
  return useQuery({
    queryKey: queryKeys.producto(id),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('productos')
        .select('*, categoria:categorias(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useDeleteProducto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('productos')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productos })
    },
  })
}

// ============ CLIENTES ============

export function useClientes() {
  return useQuery({
    queryKey: queryKeys.clientes,
    queryFn: async (): Promise<Cliente[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('clientes')
        .select('*')
        .eq('is_active', true)
        .order('nombre_comercial')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  })
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: queryKeys.cliente(id),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useDeleteCliente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('clientes')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes })
    },
  })
}

// ============ COTIZACIONES ============

interface CotizacionRow {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  total: number
  cliente_nombre?: string
  cliente_rfc?: string
  almacen_nombre?: string
  created_at?: string
  updated_at?: string
}

export function useCotizaciones(statusFilter?: string | null) {
  return useQuery({
    queryKey: queryKeys.cotizaciones(statusFilter),
    queryFn: async (): Promise<CotizacionRow[]> => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .order('fecha', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 1, // 1 minuto
  })
}

export function useCotizacion(id: string) {
  return useQuery({
    queryKey: queryKeys.cotizacion(id),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCotizacionItems(id: string) {
  return useQuery({
    queryKey: queryKeys.cotizacionItems(id),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select('*, productos:producto_id (sku)')
        .eq('cotizacion_id', id)

      if (error) throw error
      return data?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []
    },
    enabled: !!id,
  })
}

export function useDeleteCotizacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()

      // Primero eliminar items
      const { error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .delete()
        .eq('cotizacion_id', id)

      if (itemsError) throw itemsError

      // Luego eliminar cotización
      const { error } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

// ============ ALMACENES ============

export function useAlmacenes() {
  return useQuery({
    queryKey: queryKeys.almacenes,
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 5, // 5 minutos - almacenes cambian poco
  })
}

// ============ INVENTARIO ============

export function useInventario(almacenId?: string) {
  return useQuery({
    queryKey: queryKeys.inventario(almacenId),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_inventario_detalle')
        .select('*')
        .order('producto_nombre')

      if (almacenId) {
        query = query.eq('almacen_id', almacenId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 1, // 1 minuto
  })
}

export function useMovimientos(almacenId?: string, limit = 50) {
  return useQuery({
    queryKey: [...queryKeys.movimientos(almacenId), { limit }],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_movimientos')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(limit)

      if (almacenId) {
        query = query.eq('almacen_id', almacenId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 1, // 1 minuto
  })
}

// ============ DASHBOARD ============

interface DashboardData {
  stats: {
    totalProductos: number
    productosStockBajo: number
    cotizacionesPendientes: number
    facturasPorCobrar: number
    totalPorCobrar: number
  }
  productosStockBajo: Array<{
    id: string
    sku: string
    nombre: string
    stock_total: number
  }>
  facturasRecientes: Array<{
    id: string
    folio: string
    cliente_nombre: string
    total: number
    saldo: number
    status: string
  }>
}

export function useDashboardData() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async (): Promise<DashboardData> => {
      const supabase = getSupabaseClient()

      // Ejecutar todas las consultas en paralelo para máximo rendimiento
      const [
        productosRes,
        stockBajoRes,
        cotizacionesRes,
        facturasRes,
      ] = await Promise.all([
        // Total productos activos
        supabase
          .schema('erp')
          .from('productos')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),

        // Productos con stock bajo (menos de 10 unidades) - traer datos
        supabase
          .schema('erp')
          .from('v_productos_stock')
          .select('id, sku, nombre, stock_total')
          .lt('stock_total', 10)
          .limit(5),

        // Cotizaciones pendientes
        supabase
          .schema('erp')
          .from('cotizaciones')
          .select('*', { count: 'exact', head: true })
          .in('status', ['borrador', 'enviada', 'aceptada', 'propuesta']),

        // Facturas pendientes con saldo
        supabase
          .schema('erp')
          .from('v_facturas')
          .select('id, folio, cliente_nombre, total, saldo, status')
          .in('status', ['pendiente', 'parcial'])
          .order('fecha', { ascending: false })
          .limit(5),
      ])

      const stockBajo = stockBajoRes.data || []
      const facturas = facturasRes.data || []
      const totalPorCobrar = facturas.reduce((sum, f) => sum + (f.saldo || 0), 0)

      return {
        stats: {
          totalProductos: productosRes.count || 0,
          productosStockBajo: stockBajo.length,
          cotizacionesPendientes: cotizacionesRes.count || 0,
          facturasPorCobrar: facturas.length,
          totalPorCobrar,
        },
        productosStockBajo: stockBajo,
        facturasRecientes: facturas,
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutos - datos del dashboard
  })
}

// ============ CATEGORIAS ============

export function useCategorias() {
  return useQuery({
    queryKey: queryKeys.categorias,
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
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
}

// ============ LISTAS DE PRECIOS ============

export function useListasPrecios() {
  return useQuery({
    queryKey: queryKeys.listasPrecios,
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
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
}
