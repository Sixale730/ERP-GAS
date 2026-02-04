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
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),

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
      .select('*', { count: 'exact', head: true })
      .in('status', ['propuesta']),

    // Facturas por cobrar
    supabase
      .schema('erp')
      .from('v_facturas')
      .select('id, folio, cliente_nombre, total, saldo, status', { count: 'exact' })
      .in('status', ['pendiente', 'parcial'])
      .order('fecha', { ascending: false })
      .limit(5),
  ])

  // Debug: ver qué retorna la consulta de cotizaciones
  console.log('Cotizaciones pendientes result:', cotizacionesPendientesResult)

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
