import type { InsightContext, InsightItem, InsightSharedCache } from './types'
import { SEVERIDAD_ORDER } from './types'
import { ALL_RULES } from './rules'

/**
 * Pre-carga datos compartidos por múltiples reglas de insights.
 * Reduce ~45 queries individuales a ~6 queries consolidadas.
 */
async function precargarCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  modulosActivos: string[]
): Promise<InsightSharedCache> {
  const cache: InsightSharedCache = {}

  // Fecha hace 90 días
  const hace90d = new Date()
  hace90d.setDate(hace90d.getDate() - 90)
  const fecha90d = hace90d.toISOString().split('T')[0]
  const fecha90dISO = `${fecha90d}T00:00:00`

  const tieneFacturas = modulosActivos.includes('facturas')
  const tienePOS = modulosActivos.includes('pos')
  const tieneInventario = modulosActivos.includes('inventario') || modulosActivos.includes('productos')

  // Lanzar todas las queries en paralelo
  const queries: Promise<void>[] = []

  if (tieneFacturas) {
    queries.push((async () => {
      const { data } = await supabase.schema('erp').from('v_facturas')
        .select('id, cliente_id, cliente_nombre, total, saldo, fecha, status, dias_vencida, vendedor_id, vendedor_nombre')
        .eq('organizacion_id', orgId)
        .not('status', 'eq', 'cancelada')
        .gte('fecha', fecha90d)
        .limit(5000)
      cache.facturas90d = data || []
    })())
  }

  if (tienePOS) {
    queries.push((async () => {
      const { data } = await supabase.schema('erp').from('ventas_pos')
        .select('id, total, created_at, metodo_pago, cliente_id, cliente_nombre')
        .eq('organizacion_id', orgId)
        .eq('status', 'completada')
        .gte('created_at', fecha90dISO)
        .limit(10000)
      cache.ventasPOS90d = data || []
    })())
  }

  if (tieneInventario) {
    queries.push((async () => {
      const { data } = await supabase.schema('erp').from('v_productos_stock')
        .select('id, sku, nombre, stock_total, punto_reorden, costo_promedio, categoria_id')
        .limit(5000)
      cache.productosStock = data || []
    })())

    queries.push((async () => {
      const { data } = await supabase.schema('erp').from('v_movimientos')
        .select('producto_id, tipo, cantidad, fecha')
        .gte('fecha', fecha90d)
        .limit(10000)
      cache.movimientos90d = data || []
    })())
  }

  await Promise.all(queries)
  return cache
}

/**
 * Evalúa todas las reglas de insights aplicables según los módulos activos de la organización.
 * Pre-carga datos compartidos una sola vez y los pasa a todas las reglas.
 * Ejecuta las reglas en paralelo con Promise.allSettled para aislar errores.
 * Retorna insights ordenados por severidad (critico → alerta → info → oportunidad).
 */
export async function evaluarInsights(ctx: InsightContext): Promise<InsightItem[]> {
  // 1. Filtrar reglas por módulos activos
  const reglasAplicables = ALL_RULES.filter((rule) => {
    if (rule.requiereModulo && !ctx.modulosActivos.includes(rule.requiereModulo)) return false
    if (rule.requiereAlguno?.length && !rule.requiereAlguno.some((m) => ctx.modulosActivos.includes(m))) return false
    return true
  })

  if (reglasAplicables.length === 0) return []

  // 2. Pre-cargar datos compartidos (~6 queries en lugar de ~45)
  const cache = await precargarCache(ctx.supabase, ctx.orgId, ctx.modulosActivos)
  const ctxConCache = { ...ctx, cache }

  // 3. Ejecutar todas en paralelo — una falla no bloquea las demás
  const resultados = await Promise.allSettled(
    reglasAplicables.map((regla) => regla.evaluar(ctxConCache))
  )

  // 4. Recolectar resultados exitosos, log errores
  const insights: InsightItem[] = []
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') {
      insights.push(...resultado.value)
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Insights] Error en regla "${reglasAplicables[i].key}":`, resultado.reason)
      }
    }
  })

  // 5. Ordenar por severidad
  return insights.sort((a, b) => SEVERIDAD_ORDER[a.severidad] - SEVERIDAD_ORDER[b.severidad])
}

/** Re-exportar las reglas para que la página de config pueda listarlas */
export { ALL_RULES }
