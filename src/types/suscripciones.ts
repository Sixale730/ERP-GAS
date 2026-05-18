/**
 * Tipos del modulo de suscripciones del sistema ERP.
 * Espejo de las tablas erp.suscripciones, erp.suscripcion_pagos, erp.suscripcion_eventos
 * y de los RPCs publicos public.estado_suscripcion / public.suscripcion_publica / etc.
 */

export type SuscripcionPlan = 'mensual' | 'anual'
export type SuscripcionEstado = 'activa' | 'vencida' | 'suspendida'
export type SuscripcionAudienciaModo = 'todos' | 'seleccionados'
export type SuscripcionColorSemaforo = 'verde' | 'amarillo' | 'naranja' | 'rojo'

/** Catalogo de eventos rastreados sobre el banner / modal / interacciones */
export type SuscripcionEventoTipo =
  | 'banner_visto'
  | 'modal_abierto'
  | 'terminos_abiertos'
  | 'whatsapp_click'
  | 'plan_anual_visto'
  | 'pago_registrado'
  | 'config_modificada'
  | 'modo_lectura_activado'
  | 'modo_lectura_desactivado'

/** Sub-flags individuales del modo solo lectura */
export interface ModoLecturaBloqueos {
  crear: boolean
  editar: boolean
  timbrar: boolean
  pagos: boolean
  ajustes: boolean
  descargar_pdf: boolean
  exportar_excel: boolean
  config: boolean
}

/** Estado calculado por la RPC erp.estado_suscripcion() — lo que consume el banner */
export interface EstadoSuscripcion {
  organizacion_id: string
  plan: SuscripcionPlan
  fecha_corte: string // ISO date YYYY-MM-DD
  estado: SuscripcionEstado
  dias_restantes: number
  color_semaforo: SuscripcionColorSemaforo
  mostrar_banner: boolean
  modo_lectura_activo: boolean
  modo_lectura_bloqueos: ModoLecturaBloqueos
  contacto_nombre: string
  contacto_whatsapp: string
  monto_mensual: number
  monto_anual: number
  iva_porcentaje: number
  dias_alerta: number
  banner_activo: boolean
  banner_audiencia_modo: SuscripcionAudienciaModo
  banner_forzar: boolean
}

/** Fila publica usada por la pantalla de configuracion (RPC suscripcion_publica) */
export interface SuscripcionPublica {
  organizacion_id: string
  plan: SuscripcionPlan
  fecha_corte: string
  estado: SuscripcionEstado
  banner_activo: boolean
  banner_audiencia_modo: SuscripcionAudienciaModo
  banner_usuarios_visibles: string[]
  banner_forzar: boolean
  dias_alerta: number
  contacto_nombre: string
  contacto_whatsapp: string
  monto_mensual: number
  monto_anual: number
  iva_porcentaje: number
  modo_lectura_activo: boolean
  modo_lectura_bloqueos: ModoLecturaBloqueos
  dias_restantes: number
}

/** Pago registrado en historial */
export interface SuscripcionPago {
  id: string
  fecha_pago: string
  monto: number
  forma_pago: string
  referencia: string | null
  periodo_cubierto_desde: string
  periodo_cubierto_hasta: string
  comprobante_url: string | null
  notas: string | null
  registrado_por_nombre: string | null
  registrado_por_email: string | null
  created_at: string
}

/** Evento de tracking (lo que ve super_admin en tab Actividad) */
export interface SuscripcionEvento {
  id: string
  usuario_nombre: string | null
  usuario_email: string | null
  usuario_rol: string | null
  evento: SuscripcionEventoTipo
  metadata: Record<string, unknown>
  ip: string | null
  user_agent: string | null
  created_at: string
}

/** Payload de la mutacion registrar_pago_suscripcion */
export interface RegistrarPagoPayload {
  monto: number
  fecha_pago: string
  forma_pago: string
  referencia?: string | null
  periodo_meses?: number // default 1 (mensual) o 12 (anual)
  comprobante_url?: string | null
  notas?: string | null
}

/** Payload de actualizar_config_suscripcion (solo campos a cambiar) */
export interface ActualizarConfigPayload {
  plan?: SuscripcionPlan
  monto_mensual?: number
  monto_anual?: number
  iva_porcentaje?: number
  banner_activo?: boolean
  banner_audiencia_modo?: SuscripcionAudienciaModo
  banner_usuarios_visibles?: string[]
  banner_forzar?: boolean
  dias_alerta?: number
  contacto_nombre?: string
  contacto_whatsapp?: string
  modo_lectura_activo?: boolean
  modo_lectura_bloqueos?: ModoLecturaBloqueos
  fecha_corte?: string
  estado?: SuscripcionEstado
}
