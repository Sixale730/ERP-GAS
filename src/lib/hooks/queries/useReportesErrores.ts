import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type ReporteStatus = 'nuevo' | 'en_revision' | 'resuelto' | 'descartado'
export type ReportePrioridad = 'baja' | 'normal' | 'alta' | 'critica'
export type ReporteOrigen = 'manual' | 'boundary' | 'window_error' | 'unhandled_rejection' | 'api'

export interface ReporteError {
  id: string
  organizacion_id: string | null
  usuario_id: string | null
  usuario_email: string | null
  usuario_nombre: string | null
  usuario_rol: string | null
  ruta: string | null
  descripcion_usuario: string
  pasos_reproduccion: string | null
  mensaje_tecnico: string | null
  origen: ReporteOrigen
  status: ReporteStatus
  prioridad: ReportePrioridad
  nota_admin: string | null
  resolved_by: string | null
  resolved_at: string | null
  visto_por_reportante: boolean
  visto_por_reportante_at: string | null
  created_at: string
  updated_at: string
}

export const REPORTES_ERRORES_KEY = ['reportes_errores'] as const

// ─── Inbox del admin ──────────────────────────────────────────────────
export function useReportesErrores(statusFilter?: ReporteStatus | null) {
  return useQuery({
    queryKey: [...REPORTES_ERRORES_KEY, 'inbox', statusFilter ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/reportes-errores?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al cargar reportes')
      return json.data as ReporteError[]
    },
    staleTime: 60 * 1000,
  })
}

// ─── Reportes del propio usuario ──────────────────────────────────────
export function useMisReportes() {
  return useQuery({
    queryKey: [...REPORTES_ERRORES_KEY, 'mine'],
    queryFn: async () => {
      const res = await fetch('/api/reportes-errores?scope=mine')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al cargar mis reportes')
      return json.data as ReporteError[]
    },
    staleTime: 60 * 1000,
  })
}

// ─── Mutaciones ───────────────────────────────────────────────────────
export interface ActualizarStatusInput {
  id: string
  status: ReporteStatus
  nota_admin?: string | null
  prioridad?: ReportePrioridad | null
}

export function useActualizarStatusReporte() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ActualizarStatusInput) => {
      const res = await fetch(`/api/reportes-errores/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: input.status,
          nota_admin: input.nota_admin ?? null,
          prioridad: input.prioridad ?? null,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al actualizar status')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORTES_ERRORES_KEY })
    },
  })
}

export function useMarcarReporteVisto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reportes-errores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'marcar_visto' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al marcar como visto')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORTES_ERRORES_KEY })
    },
  })
}

// ─── Counts para badges en sidebar ────────────────────────────────────
/** Reportes nuevos / en_revision visibles para el admin (segun RLS) */
export function useReportesPendientesCount(enabled: boolean = true) {
  return useQuery({
    queryKey: [...REPORTES_ERRORES_KEY, 'count', 'pendientes'],
    queryFn: async () => {
      const res = await fetch('/api/reportes-errores?limit=500')
      const json = await res.json()
      if (!json.success) return 0
      const items = json.data as ReporteError[]
      return items.filter((r) => r.status === 'nuevo' || r.status === 'en_revision').length
    },
    enabled,
    staleTime: 60 * 1000,
  })
}

/** Reportes del usuario resueltos/descartados que aun no ha leido */
export function useMisReportesResueltosSinLeerCount(enabled: boolean = true) {
  return useQuery({
    queryKey: [...REPORTES_ERRORES_KEY, 'count', 'mis-resueltos-sin-leer'],
    queryFn: async () => {
      const res = await fetch('/api/reportes-errores?scope=mine')
      const json = await res.json()
      if (!json.success) return 0
      const items = json.data as ReporteError[]
      return items.filter(
        (r) => (r.status === 'resuelto' || r.status === 'descartado') && !r.visto_por_reportante
      ).length
    },
    enabled,
    staleTime: 60 * 1000,
  })
}
