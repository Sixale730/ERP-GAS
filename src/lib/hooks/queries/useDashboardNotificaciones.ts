'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export type DashboardNotificacionTipo = 'nuevo' | 'mejora' | 'fix' | 'aviso'
export type DashboardNotificacionStatus = 'borrador' | 'publicada' | 'archivada'

export interface DashboardNotificacion {
  id: string
  titulo: string
  descripcion: string | null
  tipo: DashboardNotificacionTipo
  icono: string | null
  cta_label: string | null
  cta_ruta: string | null
  fecha_inicio: string
  fecha_fin: string | null
  dirigido_a_roles: string[] | null
  organizacion_id: string | null
  activo: boolean
  status: DashboardNotificacionStatus
  published_at: string | null
  published_by: string | null
  created_at: string
}

export const dashboardNotificacionesKeys = {
  all: ['dashboard-notificaciones'] as const,
  active: (orgId: string | null, role: string | null) =>
    [...dashboardNotificacionesKeys.all, 'active', orgId, role] as const,
  admin: () => [...dashboardNotificacionesKeys.all, 'admin'] as const,
}

/**
 * Notificaciones activas, no-dismissed por el usuario actual, dirigidas a su
 * org y rol. Se usa en el banner del dashboard.
 */
export function useDashboardNotificacionesActivas() {
  const { orgId, role, erpUser } = useAuth()
  const userId = erpUser?.id ?? null

  return useQuery({
    queryKey: dashboardNotificacionesKeys.active(orgId, role),
    queryFn: async (): Promise<DashboardNotificacion[]> => {
      const supabase = getSupabaseClient()
      const today = new Date().toISOString().split('T')[0]

      // 1) Notificaciones publicadas, activas y en fecha vigente.
      // Las que estan en status='borrador' NO se muestran (esperan aprobacion del super_admin).
      const { data: rows, error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones')
        .select('id, titulo, descripcion, tipo, icono, cta_label, cta_ruta, fecha_inicio, fecha_fin, dirigido_a_roles, organizacion_id, activo, status, published_at, published_by, created_at')
        .eq('status', 'publicada')
        .eq('activo', true)
        .lte('fecha_inicio', today)
        .order('published_at', { ascending: false })
        .limit(20)
      if (error) throw error

      // 2) Filtrar fecha_fin (en cliente — fecha_fin OR > today)
      const vigentes = (rows ?? []).filter((n) => !n.fecha_fin || n.fecha_fin >= today)

      // 3) Filtrar por rol del usuario actual
      const porRol = vigentes.filter(
        (n) => !n.dirigido_a_roles || n.dirigido_a_roles.length === 0 || (role && n.dirigido_a_roles.includes(role))
      )

      // 4) Filtrar dismissals del usuario actual
      if (!userId || porRol.length === 0) return porRol

      const { data: dismissals } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones_dismissals')
        .select('notificacion_id')
        .eq('usuario_id', userId)
        .in('notificacion_id', porRol.map((n) => n.id))

      const dismissedSet = new Set((dismissals ?? []).map((d) => d.notificacion_id))
      return porRol.filter((n) => !dismissedSet.has(n.id))
    },
    enabled: !!orgId && !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

/** Mutation: marcar una notificacion como dismissed. */
export function useDismissDashboardNotificacion() {
  const queryClient = useQueryClient()
  const { erpUser } = useAuth()
  const userId = erpUser?.id ?? null

  return useMutation({
    mutationFn: async (notificacionId: string) => {
      if (!userId) throw new Error('No usuario')
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones_dismissals')
        .insert({ notificacion_id: notificacionId, usuario_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardNotificacionesKeys.all })
    },
  })
}

/** Listar todas (admin) — sin filtro por dismiss/fecha/rol. */
export function useDashboardNotificacionesAdmin() {
  return useQuery({
    queryKey: dashboardNotificacionesKeys.admin(),
    queryFn: async (): Promise<DashboardNotificacion[]> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones')
        .select('id, titulo, descripcion, tipo, icono, cta_label, cta_ruta, fecha_inicio, fecha_fin, dirigido_a_roles, organizacion_id, activo, status, published_at, published_by, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

/** Publicar un borrador — set status='publicada' y registrar quien lo aprobo. */
export function usePublishDashboardNotificacion() {
  const queryClient = useQueryClient()
  const { erpUser } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones')
        .update({
          status: 'publicada',
          published_at: new Date().toISOString(),
          published_by: erpUser?.id ?? null,
          activo: true,
          // Si fecha_inicio era a futuro y ya estamos publicando, la adelantamos a hoy
          // para que se vea de inmediato.
          fecha_inicio: today,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardNotificacionesKeys.all })
    },
  })
}

/** Archivar una publicada — la saca del banner pero queda como historico. */
export function useArchiveDashboardNotificacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones')
        .update({ status: 'archivada', activo: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardNotificacionesKeys.all })
    },
  })
}

interface UpsertNotificacionInput {
  id?: string
  titulo: string
  descripcion?: string | null
  tipo: DashboardNotificacionTipo
  icono?: string | null
  cta_label?: string | null
  cta_ruta?: string | null
  fecha_inicio: string
  fecha_fin?: string | null
  dirigido_a_roles?: string[] | null
  organizacion_id?: string | null
  activo: boolean
  status?: DashboardNotificacionStatus
}

export function useUpsertDashboardNotificacion() {
  const queryClient = useQueryClient()
  const { erpUser } = useAuth()

  return useMutation({
    mutationFn: async (input: UpsertNotificacionInput) => {
      const supabase = getSupabaseClient()
      const payload = {
        ...input,
        descripcion: input.descripcion ?? null,
        icono: input.icono ?? null,
        cta_label: input.cta_label ?? null,
        cta_ruta: input.cta_ruta ?? null,
        fecha_fin: input.fecha_fin ?? null,
        dirigido_a_roles: input.dirigido_a_roles ?? null,
        organizacion_id: input.organizacion_id ?? null,
        // Default a borrador si no se especifica explicitamente.
        // El super_admin puede pasar 'publicada' para crear directo activa.
        status: input.status ?? 'borrador',
        created_by: erpUser?.id ?? null,
      }

      if (input.id) {
        const { error } = await supabase
          .schema('erp')
          .from('dashboard_notificaciones')
          .update(payload)
          .eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .schema('erp')
          .from('dashboard_notificaciones')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardNotificacionesKeys.all })
    },
  })
}

export function useDeleteDashboardNotificacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('dashboard_notificaciones')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardNotificacionesKeys.all })
    },
  })
}
