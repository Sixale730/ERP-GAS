import type { InsightContext, InsightItem } from './types'
import { SEVERIDAD_ORDER } from './types'
import { ALL_RULES } from './rules'

/**
 * Evalúa todas las reglas de insights aplicables según los módulos activos de la organización.
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

  // 2. Ejecutar todas en paralelo — una falla no bloquea las demás
  const resultados = await Promise.allSettled(
    reglasAplicables.map((regla) => regla.evaluar(ctx))
  )

  // 3. Recolectar resultados exitosos, log errores
  const insights: InsightItem[] = []
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') {
      insights.push(...resultado.value)
    } else {
      console.warn(`[Insights] Error en regla "${reglasAplicables[i].key}":`, resultado.reason)
    }
  })

  // 4. Ordenar por severidad
  return insights.sort((a, b) => SEVERIDAD_ORDER[a.severidad] - SEVERIDAD_ORDER[b.severidad])
}

/** Re-exportar las reglas para que la página de config pueda listarlas */
export { ALL_RULES }
