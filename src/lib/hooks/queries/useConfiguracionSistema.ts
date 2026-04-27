'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useOrgContext } from '@/lib/hooks/useOrgContext'
import { useAuth } from '@/lib/hooks/useAuth'
import type { ConfigItem, ConfigAuditEntry, ConfigCategoria } from '@/types/configuracion-sistema'

export const configSistemaKeys = {
  all: ['configuracion_sistema'] as const,
  list: (orgId: string | null, categoria?: ConfigCategoria) =>
    ['configuracion_sistema', 'list', orgId, categoria ?? 'all'] as const,
  value: (orgId: string | null, categoria: string, clave: string) =>
    ['configuracion_sistema', 'value', orgId, categoria, clave] as const,
  audit: (orgId: string | null, categoria: string, clave: string) =>
    ['configuracion_sistema', 'audit', orgId, categoria, clave] as const,
}

/**
 * Lista la configuracion completa de la org (o filtrada por categoria) para la UI del panel.
 */
export function useConfiguracionSistema(categoria?: ConfigCategoria) {
  const { effectiveOrgId, ownOrgId } = useOrgContext()
  const orgId = effectiveOrgId ?? ownOrgId

  return useQuery({
    queryKey: configSistemaKeys.list(orgId, categoria),
    queryFn: async () => {
      if (!orgId) return [] as ConfigItem[]
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.schema('erp').rpc('list_configuracion_sistema', {
        p_organizacion_id: orgId,
        p_categoria: categoria ?? null,
      })
      if (error) throw error
      return (data ?? []) as ConfigItem[]
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Lectura puntual de un valor de configuracion. SIEMPRE recibe un fallback.
 * Si la query no esta lista o falla, retorna el fallback.
 */
export function useConfigValue<T>(
  categoria: string,
  clave: string,
  fallback: T
): T {
  const { effectiveOrgId, ownOrgId } = useOrgContext()
  const orgId = effectiveOrgId ?? ownOrgId

  const { data } = useQuery({
    queryKey: configSistemaKeys.value(orgId, categoria, clave),
    queryFn: async () => {
      if (!orgId) return null
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.schema('erp').rpc('get_configuracion_sistema', {
        p_categoria: categoria,
        p_clave: clave,
        p_organizacion_id: orgId,
      })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  })

  if (data === null || data === undefined) return fallback
  return data as T
}

/**
 * Mutacion para guardar un valor. Hace optimistic update + invalidacion.
 */
export function useSetConfig() {
  const queryClient = useQueryClient()
  const { effectiveOrgId, ownOrgId } = useOrgContext()
  const { erpUser } = useAuth()
  const orgId = effectiveOrgId ?? ownOrgId

  return useMutation({
    mutationFn: async ({
      categoria,
      clave,
      valor,
    }: {
      categoria: string
      clave: string
      valor: unknown
    }) => {
      if (!orgId) throw new Error('No hay organizacion seleccionada')
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.schema('erp').rpc('set_configuracion_sistema', {
        p_categoria: categoria,
        p_clave: clave,
        p_valor: valor,
        p_organizacion_id: orgId,
        p_modificado_por: erpUser?.id ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: configSistemaKeys.all })
      queryClient.invalidateQueries({
        queryKey: configSistemaKeys.value(orgId, variables.categoria, variables.clave),
      })
    },
  })
}

/**
 * Restaurar un valor a su default original.
 */
export function useResetConfig() {
  const queryClient = useQueryClient()
  const { effectiveOrgId, ownOrgId } = useOrgContext()
  const { erpUser } = useAuth()
  const orgId = effectiveOrgId ?? ownOrgId

  return useMutation({
    mutationFn: async ({ categoria, clave }: { categoria: string; clave: string }) => {
      if (!orgId) throw new Error('No hay organizacion seleccionada')
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.schema('erp').rpc('reset_configuracion_sistema', {
        p_categoria: categoria,
        p_clave: clave,
        p_organizacion_id: orgId,
        p_modificado_por: erpUser?.id ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: configSistemaKeys.all })
      queryClient.invalidateQueries({
        queryKey: configSistemaKeys.value(orgId, variables.categoria, variables.clave),
      })
    },
  })
}

/**
 * Historial de cambios de una clave (ultimas N).
 */
export function useConfigAudit(categoria: string, clave: string, limit = 10) {
  const { effectiveOrgId, ownOrgId } = useOrgContext()
  const orgId = effectiveOrgId ?? ownOrgId

  return useQuery({
    queryKey: configSistemaKeys.audit(orgId, categoria, clave),
    queryFn: async () => {
      if (!orgId) return [] as ConfigAuditEntry[]
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.schema('erp').rpc('get_audit_configuracion_sistema', {
        p_categoria: categoria,
        p_clave: clave,
        p_organizacion_id: orgId,
        p_limit: limit,
      })
      if (error) throw error
      return (data ?? []) as ConfigAuditEntry[]
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  })
}
