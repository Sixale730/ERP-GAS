import type { InsightRule } from '../types'
// Fase 1
import { puntoReordenRule } from './punto-reorden'
import { capitalRetenidoRule } from './capital-retenido'
import { clientePerdiendoVolumenRule } from './cliente-perdiendo-volumen'
import { cotizacionesEstancadasRule } from './cotizaciones-estancadas'
import { carteraVencidaRule } from './cartera-vencida'
// Fase 2
import { sobreStockRule } from './sobre-stock'
import { categoriaDeclineRule } from './categoria-declive'
import { vendedorBajoRendimientoRule } from './vendedor-bajo-rendimiento'
import { margenNegativoRule } from './margen-negativo'
import { ticketPromedioPosRule } from './ticket-promedio-pos'

export const ALL_RULES: InsightRule[] = [
  // Fase 1
  puntoReordenRule,
  capitalRetenidoRule,
  clientePerdiendoVolumenRule,
  cotizacionesEstancadasRule,
  carteraVencidaRule,
  // Fase 2
  sobreStockRule,
  categoriaDeclineRule,
  vendedorBajoRendimientoRule,
  margenNegativoRule,
  ticketPromedioPosRule,
]
