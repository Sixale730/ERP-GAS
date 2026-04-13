import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'
import type { Caja, TurnoCaja, VentaPOSView, ResumenTurno, ProductoPOS, RegistrarVentaParams } from '@/types/pos'
import type { PaginationParams, PaginatedResult } from './types'

// Query keys factory
export const posKeys = {
  all: ['pos'] as const,
  cajas: () => [...posKeys.all, 'cajas'] as const,
  turnoActivo: (cajaId?: string) => [...posKeys.all, 'turno-activo', cajaId] as const,
  ventas: () => [...posKeys.all, 'ventas'] as const,
  ventasList: (filters?: Record<string, unknown>) => [...posKeys.ventas(), filters] as const,
  venta: (id: string) => [...posKeys.ventas(), id] as const,
  resumenTurno: (turnoId: string) => [...posKeys.all, 'resumen', turnoId] as const,
  productosPOS: (search?: string, listaPrecioId?: string) => [...posKeys.all, 'productos', search, listaPrecioId] as const,
}

// --- Cajas ---

async function fetchCajas(): Promise<Caja[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('cajas')
    .select('*')
    .eq('is_active', true)
    .order('nombre')

  if (error) throw error
  return (data || []) as Caja[]
}

export function useCajas() {
  return useQuery({
    queryKey: posKeys.cajas(),
    queryFn: fetchCajas,
  })
}

// --- Turno Activo ---

async function fetchTurnoActivo(cajaId: string): Promise<TurnoCaja | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('turnos_caja')
    .select('*')
    .eq('caja_id', cajaId)
    .eq('status', 'abierto')
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as TurnoCaja | null
}

export function useTurnoActivo(cajaId?: string) {
  return useQuery({
    queryKey: posKeys.turnoActivo(cajaId),
    queryFn: () => fetchTurnoActivo(cajaId!),
    enabled: !!cajaId,
    // Sin polling — se invalida on-demand al abrir/cerrar turno
  })
}

// --- Abrir Turno ---

interface AbrirTurnoParams {
  p_caja_id: string
  p_usuario_id: string
  p_usuario_nombre: string
  p_monto_apertura: number
  p_organizacion_id: string
}

async function abrirTurno(params: AbrirTurnoParams): Promise<string> {
  const supabase = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.schema('erp').rpc('abrir_turno_caja' as any, params)
  if (error) throw error
  return data as string
}

export function useAbrirTurno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: abrirTurno,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: posKeys.turnoActivo(variables.p_caja_id) })
    },
  })
}

// --- Cerrar Turno ---

interface CerrarTurnoParams {
  p_turno_id: string
  p_monto_cierre_real: number
  p_notas_cierre?: string
}

async function cerrarTurno(params: CerrarTurnoParams): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.schema('erp').rpc('cerrar_turno_caja' as any, params)
  if (error) throw error
  return data as Record<string, unknown>
}

export function useCerrarTurno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cerrarTurno,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: posKeys.all })
    },
  })
}

// --- Registrar Venta ---

async function registrarVenta(params: RegistrarVentaParams): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.schema('erp').rpc('registrar_venta_pos' as any, {
    ...params,
    p_items: JSON.stringify(params.p_items),
  })
  if (error) throw error
  return data as Record<string, unknown>
}

export function useRegistrarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registrarVenta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: posKeys.ventas() })
    },
  })
}

// --- Cancelar Venta ---

interface CancelarVentaParams {
  p_venta_id: string
  p_cancelada_por: string
  p_motivo: string
}

async function cancelarVenta(params: CancelarVentaParams): Promise<void> {
  const supabase = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.schema('erp').rpc('cancelar_venta_pos' as any, params)
  if (error) throw error
}

export function useCancelarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelarVenta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: posKeys.ventas() })
    },
  })
}

// --- Ventas POS (historial) ---

interface VentasPOSFilters {
  turnoId?: string
  status?: string
  pagination?: PaginationParams
}

async function fetchVentasPOS(filters?: VentasPOSFilters): Promise<PaginatedResult<VentaPOSView>> {
  const supabase = getSupabaseClient()
  let query = supabase
    .schema('erp')
    .from('v_ventas_pos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.turnoId) {
    query = query.eq('turno_caja_id', filters.turnoId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.pagination) {
    const from = (filters.pagination.page - 1) * filters.pagination.pageSize
    const to = from + filters.pagination.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data || []) as VentaPOSView[], total: count || 0 }
}

export function useVentasPOS(filters?: VentasPOSFilters) {
  return useQuery({
    queryKey: posKeys.ventasList(filters as Record<string, unknown>),
    queryFn: () => fetchVentasPOS(filters),
  })
}

// --- Resumen Turno ---

async function fetchResumenTurno(turnoId: string): Promise<ResumenTurno | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .from('v_resumen_turno')
    .select('*')
    .eq('id', turnoId)
    .maybeSingle()

  if (error) throw error
  return data as ResumenTurno | null
}

export function useResumenTurno(turnoId?: string) {
  return useQuery({
    queryKey: posKeys.resumenTurno(turnoId!),
    queryFn: () => fetchResumenTurno(turnoId!),
    enabled: !!turnoId,
  })
}

// --- Productos POS (con precio) ---

async function fetchProductosPOS(search?: string, listaPrecioId?: string): Promise<ProductoPOS[]> {
  const supabase = getSupabaseClient()

  // Query productos con su precio de la lista seleccionada
  let query = supabase
    .schema('erp')
    .from('productos')
    .select(`
      id, sku, nombre, codigo_barras, unidad_medida, es_servicio, tasa_ieps,
      precios_productos!left(precio, precio_con_iva)
    `)
    .eq('is_active', true)
    .order('nombre')
    .limit(50)

  if (listaPrecioId) {
    query = query.eq('precios_productos.lista_precio_id', listaPrecioId)
  }

  if (search) {
    const s = sanitizeSearchInput(search)
    query = query.or(`sku.ilike.%${s}%,nombre.ilike.%${s}%,codigo_barras.ilike.%${s}%`)
  }

  const { data, error } = await query
  if (error) throw error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((p: any) => {
    const precio = p.precios_productos?.[0]
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      codigo_barras: p.codigo_barras,
      unidad_medida: p.unidad_medida,
      es_servicio: p.es_servicio,
      stock_total: null,
      precio: precio?.precio ?? null,
      precio_con_iva: precio?.precio_con_iva ?? null,
      tasa_ieps: p.tasa_ieps || 0,
    } as ProductoPOS
  })
}

export function useProductosPOS(search?: string, listaPrecioId?: string) {
  return useQuery({
    queryKey: posKeys.productosPOS(search, listaPrecioId),
    queryFn: () => fetchProductosPOS(search, listaPrecioId),
    enabled: true,
  })
}

// --- Buscar producto por código de barras ---

export async function buscarPorCodigoBarras(codigo: string, listaPrecioId?: string): Promise<ProductoPOS | null> {
  const supabase = getSupabaseClient()

  let query = supabase
    .schema('erp')
    .from('productos')
    .select(`
      id, sku, nombre, codigo_barras, unidad_medida, es_servicio, tasa_ieps,
      precios_productos!left(precio, precio_con_iva)
    `)
    .eq('is_active', true)
    .or(`codigo_barras.eq.${sanitizeSearchInput(codigo)},sku.eq.${sanitizeSearchInput(codigo)}`)
    .limit(1)

  if (listaPrecioId) {
    query = query.eq('precios_productos.lista_precio_id', listaPrecioId)
  }

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data[0] as any
  const precio = p.precios_productos?.[0]
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    codigo_barras: p.codigo_barras,
    unidad_medida: p.unidad_medida,
    es_servicio: p.es_servicio,
    stock_total: null,
    precio: precio?.precio ?? null,
    precio_con_iva: precio?.precio_con_iva ?? null,
    tasa_ieps: p.tasa_ieps || 0,
  }
}
