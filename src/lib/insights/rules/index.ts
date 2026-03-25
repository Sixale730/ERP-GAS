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
// Fase 3
import { rotacionAnormalRule } from './rotacion-anormal'
import { productoEstrellaCayendoRule } from './producto-estrella-cayendo'
import { flujoEfectivoRiesgoRule } from './flujo-efectivo-riesgo'
import { abcClienteDegradandoseRule } from './abc-cliente-degradandose'
import { horariosOportunidadPosRule } from './horarios-oportunidad-pos'

export const ALL_RULES: InsightRule[] = [
  // Fase 1 — Inventario, Ventas, Cobranza
  puntoReordenRule,
  capitalRetenidoRule,
  clientePerdiendoVolumenRule,
  cotizacionesEstancadasRule,
  carteraVencidaRule,
  // Fase 2 — Inventario, Ventas, Finanzas, POS
  sobreStockRule,
  categoriaDeclineRule,
  vendedorBajoRendimientoRule,
  margenNegativoRule,
  ticketPromedioPosRule,
  // Fase 3 — Inventario, Ventas, Finanzas, POS
  rotacionAnormalRule,
  productoEstrellaCayendoRule,
  flujoEfectivoRiesgoRule,
  abcClienteDegradandoseRule,
  horariosOportunidadPosRule,
]
