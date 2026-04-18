import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

export interface DashboardStats {
  totalProductos: number
  productosStockBajo: number
  cotizacionesPendientes: number
  facturasPorCobrar: number
  totalPorCobrar: number
  ventasMes: number
  ventasMesAnterior: number
  ordenesPorSurtir: number
  totalPipeline: number
  pipelinePonderado: number
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
  fecha_vencimiento: string | null
}

export interface OrdenPorSurtir {
  id: string
  folio: string
  fecha: string
  total: number
  cliente_nombre: string
  sucursal_nombre: string | null
}

export interface DashboardData {
  stats: DashboardStats
  productosStockBajo: ProductoStockBajo[]
  facturasRecientes: FacturaReciente[]
  ordenesPorSurtir: OrdenPorSurtir[]
}

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
}

// Fetch all dashboard data
async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseClient()

  // Calcular fechas para ventas del mes
  const ahora = new Date()
  const primerDiaMesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
  const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const primerDiaMesAnterior = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}-01`

  // Ejecutar todas las queries en paralelo
  const [
    totalProductosResult,
    stockBajoResult,
    cotizacionesPendientesResult,
    facturasResult,
    ventasMesResult,
    ventasMesAnteriorResult,
    ordenesPorSurtirResult,
    pipelineResult,
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

    // Cotizaciones pendientes (propuesta y NO vencidas = pipeline vivo)
    supabase
      .schema('erp')
      .from('v_cotizaciones')
      .select('id', { count: 'exact' })
      .eq('status', 'propuesta')
      .eq('esta_vencida', false)
      .limit(1),

    // Facturas por cobrar
    supabase
      .schema('erp')
      .from('v_facturas')
      .select('id, folio, cliente_nombre, total, saldo, status, moneda, fecha_vencimiento', { count: 'exact' })
      .in('status', ['pendiente', 'parcial'])
      .order('fecha', { ascending: false })
      .limit(5),

    // Ventas del mes actual (solo campo total para sumar)
    supabase
      .schema('erp')
      .from('facturas')
      .select('total')
      .neq('status', 'cancelada')
      .gte('fecha', primerDiaMesActual)
      .limit(5000),

    // Ventas del mes anterior
    supabase
      .schema('erp')
      .from('facturas')
      .select('total')
      .neq('status', 'cancelada')
      .gte('fecha', primerDiaMesAnterior)
      .lt('fecha', primerDiaMesActual)
      .limit(5000),

    // Órdenes por surtir (las 20 más antiguas + count total)
    supabase
      .schema('erp')
      .from('v_cotizaciones')
      .select('id, folio, fecha, total, cliente_nombre, sucursal_nombre', { count: 'exact' })
      .eq('status', 'orden_venta')
      .order('fecha', { ascending: true })
      .limit(20),

    // Pipeline comercial (cotizaciones abiertas y vigentes)
    supabase
      .schema('erp')
      .from('v_cotizaciones')
      .select('total, probabilidad')
      .eq('status', 'propuesta')
      .eq('esta_vencida', false)
      .limit(1000),
  ])

  // Procesar resultados
  const totalProductos = totalProductosResult.count || 0
  const stockBajo = stockBajoResult.data || []
  const cotizacionesPendientes = cotizacionesPendientesResult.count || 0
  const facturas = facturasResult.data || []
  const facturasPorCobrar = facturasResult.count || 0
  const totalPorCobrar = facturas.reduce((sum, f) => sum + (f.saldo || 0), 0)

  const ventasMesData = ventasMesResult.data || []
  const ventasMes = ventasMesData.reduce((sum, f) => sum + (Number(f.total) || 0), 0)
  const ventasMesAntData = ventasMesAnteriorResult.data || []
  const ventasMesAnterior = ventasMesAntData.reduce((sum, f) => sum + (Number(f.total) || 0), 0)
  const ordenesSurtir = ordenesPorSurtirResult.data || []

  const pipelineRows = pipelineResult.data || []
  const totalPipeline = pipelineRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
  const pipelinePonderado = pipelineRows
    .filter(r => r.probabilidad != null)
    .reduce((sum, r) => sum + (Number(r.total) || 0) * ((r.probabilidad || 0) / 100), 0)

  return {
    stats: {
      totalProductos,
      productosStockBajo: stockBajo.length,
      cotizacionesPendientes,
      facturasPorCobrar,
      totalPorCobrar,
      ventasMes,
      ventasMesAnterior,
      ordenesPorSurtir: ordenesPorSurtirResult.count || 0,
      totalPipeline,
      pipelinePonderado,
    },
    productosStockBajo: stockBajo as ProductoStockBajo[],
    facturasRecientes: facturas as FacturaReciente[],
    ordenesPorSurtir: ordenesSurtir as OrdenPorSurtir[],
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

    // Count + suma de todas las ventas del día (solo total para reduce)
    supabase
      .schema('erp')
      .from('v_ventas_pos')
      .select('total', { count: 'exact' })
      .eq('organizacion_id', orgId)
      .eq('status', 'completada')
      .gte('created_at', hoyInicio)
      .limit(2000),

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
