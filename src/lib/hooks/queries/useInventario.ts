import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Almacen, MovimientoView } from '@/types/database'

export interface InventarioRow {
  id: string
  producto_id: string
  almacen_id: string
  cantidad: number
  cantidad_reservada: number
  sku: string
  producto_nombre: string
  unidad_medida: string
  stock_minimo: number
  stock_maximo: number
  almacen_codigo: string
  almacen_nombre: string
  nivel_stock: string
}

// Query keys factory
export const inventarioKeys = {
  all: ['inventario'] as const,
  lists: () => [...inventarioKeys.all, 'list'] as const,
  list: (almacenId?: string | null) => [...inventarioKeys.lists(), almacenId] as const,
  almacenes: () => [...inventarioKeys.all, 'almacenes'] as const,
  movimientos: () => [...inventarioKeys.all, 'movimientos'] as const,
  movimientosList: (almacenId?: string | null) => [...inventarioKeys.movimientos(), almacenId] as const,
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

// Fetch inventario con filtro opcional de almacén
async function fetchInventario(almacenIds: string[], almacenFilter?: string | null): Promise<InventarioRow[]> {
  const supabase = getSupabaseClient()

  let query = supabase
    .schema('erp')
    .from('v_inventario_detalle')
    .select('*')
    .in('almacen_id', almacenIds)
    .order('producto_nombre')

  if (almacenFilter) {
    query = query.eq('almacen_id', almacenFilter)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
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
    query = query.or(`almacen_origen_id.eq.${almacenFilter},almacen_destino_id.eq.${almacenFilter}`)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Hook: Almacenes activos
export function useAlmacenes() {
  return useQuery({
    queryKey: inventarioKeys.almacenes(),
    queryFn: fetchAlmacenes,
  })
}

// Hook: Lista de inventario
export function useInventario(almacenFilter?: string | null) {
  const { data: almacenes = [] } = useAlmacenes()
  const almacenIds = almacenes.map(a => a.id)

  return useQuery({
    queryKey: inventarioKeys.list(almacenFilter),
    queryFn: () => fetchInventario(almacenIds, almacenFilter),
    enabled: almacenIds.length > 0,
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

  // Actualizar inventario
  const { error: invError } = await supabase
    .schema('erp')
    .from('inventario')
    .update({ cantidad: cantidadFinal, updated_at: new Date().toISOString() })
    .eq('id', item.id)

  if (invError) throw invError

  // Registrar movimiento si hay diferencia
  const diferencia = cantidadFinal - item.cantidad
  if (diferencia !== 0) {
    await supabase
      .schema('erp')
      .from('movimientos_inventario')
      .insert({
        producto_id: item.producto_id,
        almacen_origen_id: diferencia < 0 ? item.almacen_id : null,
        almacen_destino_id: diferencia > 0 ? item.almacen_id : null,
        tipo: diferencia > 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(diferencia),
        referencia_tipo: 'ajuste',
        notas: nota || `Ajuste manual de inventario: ${item.cantidad} → ${cantidadFinal}`,
      })
  }

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

// Actualizar límites min/max de producto
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
