// ─── Tipos base ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type InsightTipo = 'inventario' | 'ventas' | 'cobranza' | 'finanzas' | 'pos'
export type InsightSeveridad = 'critico' | 'alerta' | 'info' | 'oportunidad'

// ─── Insight generado ────────────────────────────────────────────────────────

export interface InsightItem {
  /** ID único para React key (generado con crypto.randomUUID) */
  id: string
  /** Key estable para dismissal tracking (ej: "punto-reorden", "cliente-volumen-uuid") */
  key: string
  tipo: InsightTipo
  severidad: InsightSeveridad
  titulo: string
  mensaje: string
  metrica: {
    valor: number
    unidad: string // '$', 'unidades', '%', 'dias'
    tendencia?: 'subiendo' | 'bajando' | 'estable'
  }
  accion?: {
    label: string
    ruta: string
  }
  entidades?: {
    producto_id?: string
    cliente_id?: string
    almacen_id?: string
  }
  generado_en: string
}

// ─── Regla de insight ────────────────────────────────────────────────────────

/**
 * Cache de datos compartidos entre reglas de insights.
 * Pre-cargado una vez en el engine para evitar que 15 reglas
 * repitan las mismas queries (~45 queries → ~8).
 */
export interface InsightSharedCache {
  /** v_facturas de los últimos 90 días (excluye canceladas) */
  facturas90d?: { id: string; cliente_id: string; cliente_nombre: string; total: number; saldo: number; fecha: string; status: string; dias_vencida: number; vendedor_id?: string; vendedor_nombre?: string }[]
  /** ventas_pos de los últimos 90 días (completadas) */
  ventasPOS90d?: { id: string; total: number; created_at: string; metodo_pago: string; cliente_id?: string; cliente_nombre?: string }[]
  /** v_productos_stock */
  productosStock?: { id: string; sku: string; nombre: string; stock_total: number; punto_reorden: number; costo_promedio: number; categoria_id: string }[]
  /** v_movimientos últimos 90 días */
  movimientos90d?: { producto_id: string; tipo: string; cantidad: number; fecha: string }[]
}

export interface InsightContext {
  supabase: SupabaseClient
  orgId: string
  modulosActivos: string[]
  umbrales: Map<string, number>
  /** Datos pre-cargados compartidos entre reglas (inyectado por el engine) */
  cache?: InsightSharedCache
}

export interface InsightRule {
  key: string
  titulo: string
  tipo: InsightTipo
  severidadDefault: InsightSeveridad
  umbralDefault: number
  requiereModulo?: string
  requiereAlguno?: string[]
  evaluar: (ctx: InsightContext) => Promise<InsightItem[]>
}

// ─── Estado persistido en DB ─────────────────────────────────────────────────

export interface InsightEstadoDB {
  id: string
  organizacion_id: string
  usuario_id: string
  insight_key: string
  estado: 'activo' | 'descartado' | 'resuelto'
  descartado_en: string | null
  created_at: string
}

export interface InsightConfigDB {
  id: string
  organizacion_id: string
  regla: string
  umbral: number
  activo: boolean
}

// ─── Constantes de severidad ─────────────────────────────────────────────────

export const SEVERIDAD_ORDER: Record<InsightSeveridad, number> = {
  critico: 0,
  alerta: 1,
  info: 2,
  oportunidad: 3,
}

export const SEVERIDAD_COLOR: Record<InsightSeveridad, string> = {
  critico: '#cf1322',
  alerta: '#faad14',
  info: '#1890ff',
  oportunidad: '#52c41a',
}

export const SEVERIDAD_TAG_COLOR: Record<InsightSeveridad, string> = {
  critico: 'red',
  alerta: 'orange',
  info: 'blue',
  oportunidad: 'green',
}
