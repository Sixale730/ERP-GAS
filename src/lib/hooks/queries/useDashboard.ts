import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

export interface DashboardStats {
  totalProductos: number
  productosStockBajo: number
  cotizacionesPendientes: number
  facturasPorCobrar: number
  totalPorCobrar: number
}

export interface ProductoStockBajo {
  id: string
  sku: string
  nombre: string
  stock_total: number
}

export interface FacturaReciente {
  id: string
  folio: string
  cliente_nombre: string
  total: number
  saldo: number
  status: string
  moneda: string
}

export interface DashboardData {
  stats: DashboardStats
  productosStockBajo: ProductoStockBajo[]
  facturasRecientes: FacturaReciente[]
}

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
}

// Fetch all dashboard data
async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseClient()

  // Ejecutar todas las queries en paralelo
  const [
    totalProductosResult,
    stockBajoResult,
    cotizacionesPendientesResult,
    facturasResult,
  ] = await Promise.all([
    // Total productos
    supabase
      .schema('erp')
      .from('productos')
      .select('id', { count: 'exact' })
      .eq('is_active', true)
      .limit(1),

    // Productos con stock bajo
    supabase
      .schema('erp')
      .from('v_productos_stock')
      .select('id, sku, nombre, stock_total')
      .lt('stock_total', 10)
      .limit(5),

    // Cotizaciones pendientes (propuesta = pendientes de convertir a orden de venta)
    supabase
      .schema('erp')
      .from('cotizaciones')
      .select('id', { count: 'exact' })
      .in('status', ['propuesta'])
      .limit(1),

    // Facturas por cobrar
    supabase
      .schema('erp')
      .from('v_facturas')
      .select('id, folio, cliente_nombre, total, saldo, status, moneda', { count: 'exact' })
      .in('status', ['pendiente', 'parcial'])
      .order('fecha', { ascending: false })
      .limit(5),
  ])

  // Procesar resultados
  const totalProductos = totalProductosResult.count || 0
  const stockBajo = stockBajoResult.data || []
  const cotizacionesPendientes = cotizacionesPendientesResult.count || 0
  const facturas = facturasResult.data || []
  const facturasPorCobrar = facturasResult.count || 0
  const totalPorCobrar = facturas.reduce((sum, f) => sum + (f.saldo || 0), 0)

  return {
    stats: {
      totalProductos,
      productosStockBajo: stockBajo.length,
      cotizacionesPendientes,
      facturasPorCobrar,
      totalPorCobrar,
    },
    productosStockBajo: stockBajo as ProductoStockBajo[],
    facturasRecientes: facturas as FacturaReciente[],
  }
}

// Hook: Dashboard data
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: fetchDashboardData,
    // Dashboard data puede actualizarse más frecuentemente
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

// --- Dashboard POS (MascoTienda) ---

export interface VentaPOSResumen {
  id: string
  folio: string
  caja_nombre: string
  cajero_nombre: string
  metodo_pago: string
  total: number
  created_at: string
}

export interface DashboardPOSData {
  stats: {
    ventasHoy: number
    ingresoHoy: number
    totalProductos: number
    stockBajo: number
  }
  ultimasVentas: VentaPOSResumen[]
  productosStockBajo: ProductoStockBajo[]
}

async function fetchDashboardPOS(orgId: string): Promise<DashboardPOSData> {
  const supabase = getSupabaseClient()

  // Inicio del día (zona horaria local)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyInicio = hoy.toISOString()

  const [
    ventasHoyResult,
    ventasTotalesResult,
    totalProductosResult,
    stockBajoResult,
  ] = await Promise.all([
    // Últimas 5 ventas del día
    supabase
      .schema('erp')
      .from('v_ventas_pos')
      .select('id, folio, caja_nombre, cajero_nombre, metodo_pago, total, created_at')
      .eq('organizacion_id', orgId)
      .eq('status', 'completada')
      .gte('created_at', hoyInicio)
      .order('created_at', { ascending: false })
      .limit(5),

    // Count + suma de todas las ventas del día
    supabase
      .schema('erp')
      .from('v_ventas_pos')
      .select('id, total', { count: 'exact' })
      .eq('organizacion_id', orgId)
      .eq('status', 'completada')
      .gte('created_at', hoyInicio),

    // Total productos activos de la org
    supabase
      .schema('erp')
      .from('productos')
      .select('id', { count: 'exact' })
      .eq('is_active', true)
      .eq('organizacion_id', orgId)
      .limit(1),

    // Productos con stock bajo
    supabase
      .schema('erp')
      .from('v_productos_stock')
      .select('id, sku, nombre, stock_total')
      .lt('stock_total', 10)
      .limit(5),
  ])

  const ventas = ventasHoyResult.data || []
  const ventasTotales = ventasTotalesResult.data || []
  const ventasHoyCount = ventasTotalesResult.count || 0
  const ingresoHoy = ventasTotales.reduce((sum, v) => sum + (Number(v.total) || 0), 0)
  const totalProductos = totalProductosResult.count || 0
  const stockBajo = stockBajoResult.data || []

  return {
    stats: {
      ventasHoy: ventasHoyCount,
      ingresoHoy,
      totalProductos,
      stockBajo: stockBajo.length,
    },
    ultimasVentas: ventas as VentaPOSResumen[],
    productosStockBajo: stockBajo as ProductoStockBajo[],
  }
}

export function useDashboardPOS(orgId?: string) {
  return useQuery({
    queryKey: [...dashboardKeys.all, 'pos', orgId],
    queryFn: () => fetchDashboardPOS(orgId!),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  })
}
