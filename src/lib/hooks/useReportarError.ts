'use client'

import { useCallback } from 'react'

export interface ReportarErrorPayload {
  descripcion: string
  pasos?: string | null
  ruta?: string | null
  mensaje_tecnico?: string | null
  stack?: string | null
  contexto?: Record<string, unknown> | null
  origen?: 'manual' | 'boundary' | 'window_error' | 'unhandled_rejection' | 'api'
}

/**
 * Hook imperativo para enviar un reporte de error al backend.
 * Lo usan el modal manual, el ErrorBoundary y los listeners globales.
 */
export function useReportarError() {
  return useCallback(async (payload: ReportarErrorPayload) => {
    if (typeof window === 'undefined') return { success: false, error: 'no-window' as const }

    const body = {
      descripcion: payload.descripcion,
      pasos: payload.pasos ?? null,
      ruta: payload.ruta ?? window.location.pathname + window.location.search,
      mensaje_tecnico: payload.mensaje_tecnico ?? null,
      stack: payload.stack ?? null,
      contexto: payload.contexto ?? null,
      origen: payload.origen ?? 'manual',
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }

    try {
      const res = await fetch('/api/reportes-errores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) {
        return { success: false as const, error: json.error || 'Error al reportar' }
      }
      return { success: true as const, id: json.id as string }
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : 'Error de red al reportar',
      }
    }
  }, [])
}
