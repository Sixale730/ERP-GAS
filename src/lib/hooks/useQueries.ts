'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProductoStock, Cliente } from '@/types/database'

// Keys para React Query
export const queryKeys = {
  productos: ['productos'] as const,
  productosStock: ['productos', 'stock'] as const,
  producto: (id: string) => ['productos', id] as const,
  servicios: ['servicios'] as const,
  serviciosReporte: ['servicios', 'reporte'] as const,
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
  movimientosServicios: (productoId?: string) => ['movimientos', 'servicios', { productoId }] as const,
  dashboard: ['dashboard'] as const,
  categorias: ['categorias'] as const,
  listasPrecios: ['listas-precios'] as const,
  proveedores: ['proveedores'] as const,
  preciosProductos: ['precios-productos'] as const,
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
    staleTime: 1000 * 60 * 2, // 2 minutos
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
    staleTime: 1000 * 60 * 2, // 2 minutos
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
  moneda?: string
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
    staleTime: 1000 * 60 * 1, // 1 minuto
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
    staleTime: 1000 * 60 * 1, // 1 minuto
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

        // Productos con stock bajo (menos de 10 unidades) - excluye servicios
        supabase
          .schema('erp')
          .from('v_productos_stock')
          .select('id, sku, nombre, stock_total, es_servicio')
          .lt('stock_total', 10)
          .eq('es_servicio', false)
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

// ============ PROVEEDORES ============

export function useProveedores() {
  return useQuery({
    queryKey: queryKeys.proveedores,
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
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
}

// ============ PRECIOS DE PRODUCTOS ============

interface PrecioProductoRow {
  id: string
  sku: string
  nombre: string
  proveedor_id: string | null
  proveedor_nombre: string | null
  precio: number | null
  precio_con_iva: number | null
  lista_nombre: string | null
  lista_id: string | null
}

export function usePreciosProductos() {
  return useQuery({
    queryKey: queryKeys.preciosProductos,
    queryFn: async (): Promise<PrecioProductoRow[]> => {
      const supabase = getSupabaseClient()

      // Query productos con sus precios y proveedores
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
            precio,
            precio_con_iva,
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

      // Transformar datos para aplanar la estructura
      const rows: PrecioProductoRow[] = []

      for (const producto of data || []) {
        // Supabase puede retornar objeto o array dependiendo del tipo de relacion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proveedorData = producto.proveedores as any
        const proveedor = Array.isArray(proveedorData)
          ? proveedorData[0]
          : proveedorData

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const precios = producto.precios_productos as any[]

        if (precios && precios.length > 0) {
          for (const precio of precios) {
            // listas_precios puede ser objeto o array
            const listaPrecioData = precio.listas_precios
            const listaPrecio = Array.isArray(listaPrecioData)
              ? listaPrecioData[0]
              : listaPrecioData

            rows.push({
              id: producto.id,
              sku: producto.sku,
              nombre: producto.nombre,
              proveedor_id: proveedor?.id || null,
              proveedor_nombre: proveedor?.razon_social || null,
              precio: precio.precio,
              precio_con_iva: precio.precio_con_iva,
              lista_nombre: listaPrecio?.nombre || null,
              lista_id: listaPrecio?.id || null,
            })
          }
        } else {
          // Producto sin precios configurados
          rows.push({
            id: producto.id,
            sku: producto.sku,
            nombre: producto.nombre,
            proveedor_id: proveedor?.id || null,
            proveedor_nombre: proveedor?.razon_social || null,
            precio: null,
            precio_con_iva: null,
            lista_nombre: null,
            lista_id: null,
          })
        }
      }

      return rows
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  })
}

// ============ FACTURAS ============

interface FacturaRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  saldo: number
  dias_vencida: number
  cliente_nombre?: string
  almacen_nombre?: string
}

export function useFacturas(statusFilter?: string | null) {
  return useQuery({
    queryKey: statusFilter ? [...queryKeys.facturas, { status: statusFilter }] : queryKeys.facturas,
    queryFn: async (): Promise<FacturaRow[]> => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('v_facturas')
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

// ============ SERVICIOS ============

interface ServicioConUso {
  id: string
  sku: string
  nombre: string
  categoria_nombre: string | null
  unidad_medida: string
  total_usado: number
  usado_mes: number
  ultima_fecha_uso: string | null
}

interface ReporteServiciosData {
  servicios: ServicioConUso[]
  stats: {
    totalServicios: number
    serviciosUsadosMes: number
    totalUnidadesConsumidas: number
  }
}

export function useReporteServicios() {
  return useQuery({
    queryKey: queryKeys.serviciosReporte,
    queryFn: async (): Promise<ReporteServiciosData> => {
      const supabase = getSupabaseClient()

      // Obtener productos que son servicios
      const { data: serviciosData, error: serviciosError } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('id, sku, nombre, categoria_nombre, unidad_medida')
        .eq('es_servicio', true)
        .order('nombre')

      if (serviciosError) throw serviciosError

      const servicios = serviciosData || []
      const servicioIds = servicios.map(s => s.id)

      if (servicioIds.length === 0) {
        return {
          servicios: [],
          stats: {
            totalServicios: 0,
            serviciosUsadosMes: 0,
            totalUnidadesConsumidas: 0,
          }
        }
      }

      // Obtener movimientos de servicios
      const { data: movimientos, error: movError } = await supabase
        .schema('erp')
        .from('movimientos_inventario')
        .select('producto_id, cantidad, tipo, created_at')
        .in('producto_id', servicioIds)
        .order('created_at', { ascending: false })

      if (movError) throw movError

      // Calcular inicio del mes actual
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      // Agregar datos de uso a cada servicio
      const serviciosConUso: ServicioConUso[] = servicios.map(servicio => {
        const movsServicio = (movimientos || []).filter(m => m.producto_id === servicio.id)

        // Total usado (salidas)
        const totalUsado = movsServicio
          .filter(m => m.tipo === 'salida')
          .reduce((sum, m) => sum + m.cantidad, 0)

        // Usado este mes
        const usadoMes = movsServicio
          .filter(m => m.tipo === 'salida' && new Date(m.created_at) >= inicioMes)
          .reduce((sum, m) => sum + m.cantidad, 0)

        // Última fecha de uso
        const ultimoMov = movsServicio.find(m => m.tipo === 'salida')

        return {
          id: servicio.id,
          sku: servicio.sku,
          nombre: servicio.nombre,
          categoria_nombre: servicio.categoria_nombre,
          unidad_medida: servicio.unidad_medida,
          total_usado: totalUsado,
          usado_mes: usadoMes,
          ultima_fecha_uso: ultimoMov?.created_at || null,
        }
      })

      // Calcular estadísticas
      const serviciosUsadosMes = serviciosConUso.filter(s => s.usado_mes > 0).length
      const totalUnidadesConsumidas = serviciosConUso.reduce((sum, s) => sum + s.total_usado, 0)

      return {
        servicios: serviciosConUso,
        stats: {
          totalServicios: servicios.length,
          serviciosUsadosMes,
          totalUnidadesConsumidas,
        }
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  })
}

export function useMovimientosServicios(productoId?: string, limit = 50) {
  return useQuery({
    queryKey: [...queryKeys.movimientosServicios(productoId), { limit }],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Primero obtenemos los IDs de productos que son servicios
      let servicioIds: string[] = []

      if (productoId) {
        servicioIds = [productoId]
      } else {
        const { data: servicios } = await supabase
          .schema('erp')
          .from('productos')
          .select('id')
          .eq('es_servicio', true)

        servicioIds = (servicios || []).map(s => s.id)
      }

      if (servicioIds.length === 0) return []

      const { data, error } = await supabase
        .schema('erp')
        .from('v_movimientos')
        .select('*')
        .in('producto_id', servicioIds)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 1, // 1 minuto
  })
}
