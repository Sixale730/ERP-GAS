import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'
import type { Almacen, MovimientoView } from '@/types/database'
import type { PaginationParams, PaginatedResult } from './types'

export interface InventarioRow {
  id: string
  producto_id: string
  almacen_id: string
  cantidad: number
  cantidad_reservada: number
  en_transito: number
  sku: string
  producto_nombre: string
  unidad_medida: string
  stock_minimo: number
  stock_maximo: number
  almacen_codigo: string
  almacen_nombre: string
  nivel_stock: string
  prioridad: number
}

// Query keys factory
export const inventarioKeys = {
  all: ['inventario'] as const,
  lists: () => [...inventarioKeys.all, 'list'] as const,
  list: (almacenId?: string | null, pagination?: PaginationParams, search?: string) => [...inventarioKeys.lists(), almacenId, pagination, search] as const,
  almacenes: () => [...inventarioKeys.all, 'almacenes'] as const,
  movimientos: () => [...inventarioKeys.all, 'movimientos'] as const,
  movimientosList: (almacenId?: string | null) => [...inventarioKeys.movimientos(), almacenId] as const,
}

// Fetch almacenes activos
async function fetchAlmacenes(orgId?: string | null): Promise<Almacen[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('almacenes')
    .select('*')
    .eq('is_active', true)
    .order('nombre')

  if (orgId) {
    query = query.eq('organizacion_id', orgId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Fetch inventario con filtro opcional de almacen, paginacion y búsqueda
async function fetchInventario(almacenFilter?: string | null, pagination?: PaginationParams, search?: string, orgId?: string | null): Promise<PaginatedResult<InventarioRow>> {
  const supabase = getSupabaseClient()

  let query = supabase
    .schema('erp')
    .from('v_inventario_detalle')
    .select('*', { count: 'exact' })
    .order('prioridad', { ascending: true })
    .order('cantidad', { ascending: false })
    .order('producto_nombre', { ascending: true })

  if (orgId) {
    query = query.eq('organizacion_id', orgId)
  }

  if (almacenFilter) {
    query = query.eq('almacen_id', almacenFilter)
  }

  if (search) {
    const s = sanitizeSearchInput(search)
    query = query.or(`sku.ilike.%${s}%,producto_nombre.ilike.%${s}%`)
  }

  if (pagination) {
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: (data || []) as InventarioRow[], total: count || 0 }
}

// Fetch movimientos recientes
async function fetchMovimientos(almacenFilter?: string | null): Promise<MovimientoView[]> {
  const supabase = getSupabaseClient()

  let query = supabase
    .schema('erp')
    .from('v_movimientos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (almacenFilter) {
    const safeAlm = sanitizeSearchInput(almacenFilter)
    query = query.or(`almacen_origen_id.eq.${safeAlm},almacen_destino_id.eq.${safeAlm}`)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Hook: Almacenes activos
export function useAlmacenes(orgId?: string | null) {
  return useQuery({
    queryKey: [...inventarioKeys.almacenes(), orgId],
    queryFn: () => fetchAlmacenes(orgId),
    staleTime: 1000 * 60 * 10, // Catalogo estatico
  })
}

// Hook: Lista de inventario with optional pagination and search
export function useInventario(almacenFilter?: string | null, pagination?: PaginationParams, search?: string, orgId?: string | null) {
  return useQuery({
    queryKey: [...inventarioKeys.list(almacenFilter, pagination, search), orgId],
    queryFn: () => fetchInventario(almacenFilter, pagination, search, orgId),
  })
}

// Hook: Movimientos recientes
export function useMovimientos(almacenFilter?: string | null) {
  return useQuery({
    queryKey: inventarioKeys.movimientosList(almacenFilter),
    queryFn: () => fetchMovimientos(almacenFilter),
  })
}

// Actualizar cantidad de inventario
interface AjusteInventarioParams {
  item: InventarioRow
  cantidadFinal: number
  nota?: string
}

async function ajustarInventario({ item, cantidadFinal, nota }: AjusteInventarioParams) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .schema('erp')
    .rpc('ajustar_inventario' as any, {
      p_inventario_id: item.id,
      p_cantidad_final: cantidadFinal,
      p_nota: nota || null,
    })

  if (error) throw error

  return { itemId: item.id, cantidadFinal }
}

// Hook: Ajustar inventario
export function useAjustarInventario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ajustarInventario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventarioKeys.lists() })
      queryClient.invalidateQueries({ queryKey: inventarioKeys.movimientos() })
    },
  })
}

// Actualizar limites min/max de producto
interface ActualizarMinMaxParams {
  productoId: string
  stockMinimo: number
  stockMaximo: number
}

async function actualizarMinMax({ productoId, stockMinimo, stockMaximo }: ActualizarMinMaxParams) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .schema('erp')
    .from('productos')
    .update({
      stock_minimo: stockMinimo,
      stock_maximo: stockMaximo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productoId)

  if (error) throw error

  return { productoId, stockMinimo, stockMaximo }
}

// Hook: Actualizar min/max
export function useActualizarMinMax() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: actualizarMinMax,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventarioKeys.lists() })
    },
  })
}
