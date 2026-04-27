/**
 * Catalogo central de claves de configuracion del sistema.
 * Usar siempre estas constantes en vez de strings literales para evitar typos.
 */
export const CONFIG_KEYS = {
  INVENTARIO: {
    OBJETIVO_STOCK_DEFAULT: 'objetivo_stock_default',
    DIAS_SIN_MOVIMIENTO_ALERTA: 'dias_sin_movimiento_alerta',
    PERMITIR_SOBRE_VENTA: 'permitir_sobre_venta',
  },
  COTIZACIONES: {
    VIGENCIA_DIAS_DEFAULT: 'vigencia_dias_default',
    PERMITIR_EDITAR_APROBADAS: 'permitir_editar_aprobadas',
  },
  POS: {
    REQUIERE_CORTE_CIEGO: 'requiere_corte_ciego',
    TOLERANCIA_DIFERENCIA_CAJA: 'tolerancia_diferencia_caja',
  },
  CFDI: {
    AUTO_TIMBRAR_AL_CREAR: 'auto_timbrar_al_crear',
    DIAS_ALERTA_CSD_VENCIMIENTO: 'dias_alerta_csd_vencimiento',
  },
  INSIGHTS: {
    CARTERA_VENCIDA_DIAS: 'cartera_vencida_dias',
    CLIENTE_CAIDA_VOLUMEN_PCT: 'cliente_caida_volumen_pct',
    TICKET_PROMEDIO_CAIDA_PCT: 'ticket_promedio_caida_pct',
  },
  PERFORMANCE: {
    REACT_QUERY_GC_MINUTES: 'react_query_gc_minutes',
    AUTO_CLEAR_CACHE_MINUTES: 'auto_clear_cache_minutes',
  },
  UI: {
    DENSIDAD_TABLAS: 'densidad_tablas',
    MOSTRAR_AYUDAS_CONTEXTUALES: 'mostrar_ayudas_contextuales',
  },
} as const

export const CONFIG_CATEGORIA_DE_CLAVE: Record<string, string> = {
  [CONFIG_KEYS.INVENTARIO.OBJETIVO_STOCK_DEFAULT]: 'inventario',
  [CONFIG_KEYS.INVENTARIO.DIAS_SIN_MOVIMIENTO_ALERTA]: 'inventario',
  [CONFIG_KEYS.INVENTARIO.PERMITIR_SOBRE_VENTA]: 'inventario',
  [CONFIG_KEYS.COTIZACIONES.VIGENCIA_DIAS_DEFAULT]: 'cotizaciones',
  [CONFIG_KEYS.COTIZACIONES.PERMITIR_EDITAR_APROBADAS]: 'cotizaciones',
  [CONFIG_KEYS.POS.REQUIERE_CORTE_CIEGO]: 'pos',
  [CONFIG_KEYS.POS.TOLERANCIA_DIFERENCIA_CAJA]: 'pos',
  [CONFIG_KEYS.CFDI.AUTO_TIMBRAR_AL_CREAR]: 'cfdi',
  [CONFIG_KEYS.CFDI.DIAS_ALERTA_CSD_VENCIMIENTO]: 'cfdi',
  [CONFIG_KEYS.INSIGHTS.CARTERA_VENCIDA_DIAS]: 'insights',
  [CONFIG_KEYS.INSIGHTS.CLIENTE_CAIDA_VOLUMEN_PCT]: 'insights',
  [CONFIG_KEYS.INSIGHTS.TICKET_PROMEDIO_CAIDA_PCT]: 'insights',
  [CONFIG_KEYS.PERFORMANCE.REACT_QUERY_GC_MINUTES]: 'performance',
  [CONFIG_KEYS.PERFORMANCE.AUTO_CLEAR_CACHE_MINUTES]: 'performance',
  [CONFIG_KEYS.UI.DENSIDAD_TABLAS]: 'ui',
  [CONFIG_KEYS.UI.MOSTRAR_AYUDAS_CONTEXTUALES]: 'ui',
}
