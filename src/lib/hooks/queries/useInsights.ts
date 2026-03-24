import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useModulos } from '@/lib/hooks/useModulos'
import { evaluarInsights } from '@/lib/insights/engine'
import type { InsightItem, InsightContext } from '@/lib/insights/types'

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const insightsKeys = {
  all: ['insights'] as const,
  results: (orgId: string) => [...insightsKeys.all, 'results', orgId] as const,
  estado: (orgId: string, userId: string) => [...insightsKeys.all, 'estado', orgId, userId] as const,
  config: (orgId: string) => [...insightsKeys.all, 'config', orgId] as const,
}

// ─── useInsightConfig ────────────────────────────────────────────────────────

/** Lee los umbrales configurados por la organización */
export function useInsightConfig(orgId: string | undefined) {
  return useQuery({
    queryKey: insightsKeys.config(orgId || ''),
    queryFn: async (): Promise<Map<string, number>> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('insight_config')
        .select('regla, umbral, activo')
        .eq('organizacion_id', orgId!)

      if (error) {
        console.warn('[Insights] Error leyendo config:', error)
        return new Map()
      }

      const map = new Map<string, number>()
      for (const row of data || []) {
        if (row.activo) {
          map.set(row.regla, Number(row.umbral))
        }
      }
      return map
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 min — rara vez cambia
  })
}

// ─── useInsightEstado ────────────────────────────────────────────────────────

/** Lee los insights descartados por el usuario actual */
export function useInsightEstado(orgId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: insightsKeys.estado(orgId || '', userId || ''),
    queryFn: async (): Promise<Set<string>> => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('insight_estado')
        .select('insight_key')
        .eq('organizacion_id', orgId!)
        .eq('usuario_id', userId!)
        .eq('estado', 'descartado')

      if (error) {
        console.warn('[Insights] Error leyendo estado:', error)
        return new Set()
      }

      return new Set((data || []).map((r) => r.insight_key))
    },
    enabled: !!orgId && !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── useInsights (hook principal) ────────────────────────────────────────────

export function useInsights() {
  const { organizacion, erpUser } = useAuth()
  const orgId = organizacion?.id
  const userId = erpUser?.id
  const { modulosActivos } = useModulos()
  const { data: umbrales } = useInsightConfig(orgId)
  const { data: descartados } = useInsightEstado(orgId, userId)

  const engineQuery = useQuery({
    queryKey: insightsKeys.results(orgId || ''),
    queryFn: async (): Promise<InsightItem[]> => {
      const supabase = getSupabaseClient()
      const ctx: InsightContext = {
        supabase,
        orgId: orgId!,
        modulosActivos,
        umbrales: umbrales || new Map(),
      }
      return evaluarInsights(ctx)
    },
    enabled: !!orgId && umbrales !== undefined,
    staleTime: 5 * 60 * 1000, // 5 min — mismo que reportes
  })

  // Filtrar descartados
  const insights = useMemo(() => {
    if (!engineQuery.data) return []
    if (!descartados || descartados.size === 0) return engineQuery.data
    return engineQuery.data.filter((i) => !descartados.has(i.key))
  }, [engineQuery.data, descartados])

  return {
    data: insights,
    allData: engineQuery.data || [],
    isLoading: engineQuery.isLoading,
    isError: engineQuery.isError,
    total: engineQuery.data?.length ?? 0,
    descartados: descartados?.size ?? 0,
  }
}

// ─── useDismissInsight ───────────────────────────────────────────────────────

export function useDismissInsight() {
  const queryClient = useQueryClient()
  const { organizacion, erpUser } = useAuth()
  const orgId = organizacion?.id
  const userId = erpUser?.id

  return useMutation({
    mutationFn: async (insightKey: string) => {
      if (!orgId || !userId) throw new Error('No auth context')

      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('insight_estado')
        .upsert(
          {
            organizacion_id: orgId,
            usuario_id: userId,
            insight_key: insightKey,
            estado: 'descartado',
            descartado_en: new Date().toISOString(),
          },
          { onConflict: 'organizacion_id,usuario_id,insight_key' }
        )

      if (error) throw error
    },
    onMutate: async (insightKey: string) => {
      // Optimistic update: agregar al set de descartados inmediatamente
      if (!orgId || !userId) return
      const estadoKey = insightsKeys.estado(orgId, userId)
      const prev = queryClient.getQueryData<Set<string>>(estadoKey)
      if (prev) {
        const next = new Set(prev)
        next.add(insightKey)
        queryClient.setQueryData(estadoKey, next)
      }
    },
    onError: (_err, _key, _context) => {
      // Revertir en caso de error — invalidar para refetch
      if (orgId && userId) {
        queryClient.invalidateQueries({ queryKey: insightsKeys.estado(orgId, userId) })
      }
    },
    onSettled: () => {
      if (orgId && userId) {
        queryClient.invalidateQueries({ queryKey: insightsKeys.estado(orgId, userId) })
      }
    },
  })
}
