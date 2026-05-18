'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import type {
  EstadoSuscripcion,
  SuscripcionPublica,
  SuscripcionPago,
  SuscripcionEvento,
  SuscripcionEventoTipo,
  RegistrarPagoPayload,
  ActualizarConfigPayload,
} from '@/types/suscripciones'

export const suscripcionKeys = {
  all: ['suscripcion'] as const,
  estado: () => [...suscripcionKeys.all, 'estado'] as const,
  publica: () => [...suscripcionKeys.all, 'publica'] as const,
  pagos: () => [...suscripcionKeys.all, 'pagos'] as const,
  eventos: (diasAtras: number) => [...suscripcionKeys.all, 'eventos', diasAtras] as const,
}

// ─── Estado para el banner (todos los autenticados) ─────────────────────────

/**
 * Estado actual de la suscripcion para el usuario que llama.
 * Devuelve mostrar_banner ya calculado segun audiencia + forzar + dias_alerta.
 * Refresca cada 60s para que el contador baje sin recarga manual.
 */
export function useSuscripcion() {
  const { user } = useAuth()
  return useQuery({
    queryKey: suscripcionKeys.estado(),
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async (): Promise<EstadoSuscripcion | null> => {
      const supabase = getSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('estado_suscripcion')
      if (error) throw error
      const rows = (data as EstadoSuscripcion[] | null) ?? []
      if (rows.length === 0) return null
      return rows[0]
    },
  })
}

// ─── Datos completos para la pantalla de configuracion ──────────────────────

/** Suscripcion publica (vista desde la pantalla de config, sin RLS bloqueo) */
export function useSuscripcionPublica(enabled: boolean = true) {
  return useQuery({
    queryKey: suscripcionKeys.publica(),
    enabled,
    queryFn: async (): Promise<SuscripcionPublica | null> => {
      const supabase = getSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('suscripcion_publica')
      if (error) throw error
      const rows = (data as SuscripcionPublica[] | null) ?? []
      if (rows.length === 0) return null
      return rows[0]
    },
  })
}

/** Historial de pagos (solo super_admin) */
export function useHistorialPagosSuscripcion(enabled: boolean = true) {
  return useQuery({
    queryKey: suscripcionKeys.pagos(),
    enabled,
    queryFn: async (): Promise<SuscripcionPago[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('listar_pagos_suscripcion')
      if (error) throw error
      return (data as SuscripcionPago[] | null) ?? []
    },
  })
}

/** Eventos de tracking (solo super_admin, default 30 dias) */
export function useEventosSuscripcion(diasAtras: number = 30, enabled: boolean = true) {
  return useQuery({
    queryKey: suscripcionKeys.eventos(diasAtras),
    enabled,
    queryFn: async (): Promise<SuscripcionEvento[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('listar_eventos_suscripcion', { p_dias_atras: diasAtras })
      if (error) throw error
      return (data as SuscripcionEvento[] | null) ?? []
    },
  })
}

// ─── Mutations (super_admin) ────────────────────────────────────────────────

/** Registrar pago + avanzar fecha_corte */
export function useRegistrarPagoSuscripcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RegistrarPagoPayload) => {
      const supabase = getSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('registrar_pago_suscripcion', {
        p_monto: payload.monto,
        p_fecha_pago: payload.fecha_pago,
        p_forma_pago: payload.forma_pago,
        p_referencia: payload.referencia ?? null,
        p_periodo_meses: payload.periodo_meses ?? 1,
        p_comprobante_url: payload.comprobante_url ?? null,
        p_notas: payload.notas ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suscripcionKeys.all })
    },
  })
}

/** Actualizar cualquier subconjunto de la configuracion */
export function useActualizarConfigSuscripcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ActualizarConfigPayload) => {
      const supabase = getSupabaseClient()
      const { error } = await (supabase.rpc as any)('actualizar_config_suscripcion', { p_payload: payload })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suscripcionKeys.all })
    },
  })
}

// ─── Tracking (registrar evento desde el cliente) ───────────────────────────

/**
 * Registra un evento de interaccion con el banner / modal / WhatsApp.
 * Fire-and-forget; los errores se silencian en produccion.
 */
export async function registrarEventoSuscripcion(
  evento: SuscripcionEventoTipo,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null
    await (supabase.rpc as any)('registrar_evento_suscripcion', {
      p_evento: evento,
      p_metadata: metadata,
      p_ip: null,
      p_user_agent: userAgent,
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[suscripcion] registrarEvento fallo:', err)
    }
  }
}
