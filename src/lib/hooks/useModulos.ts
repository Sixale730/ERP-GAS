'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { getModulosActivos, TODOS_LOS_MODULOS } from '@/lib/config/modulos'
import type { Modulo } from './usePermisos'

export const modulosKeys = {
  global: ['modulos', 'global'] as const,
}

async function fetchModulosGlobales(): Promise<string[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .schema('erp')
    .from('configuracion')
    .select('valor')
    .eq('clave', 'modulos_habilitados')
    .single()

  if (error || !data) {
    // If the key doesn't exist yet, all modules are enabled by default
    return [...TODOS_LOS_MODULOS]
  }

  return data.valor?.modulos ?? [...TODOS_LOS_MODULOS]
}

export function useModulos() {
  const { organizacion, loading: authLoading } = useAuth()

  const {
    data: modulosGlobales,
    isLoading: loadingGlobales,
  } = useQuery({
    queryKey: modulosKeys.global,
    queryFn: fetchModulosGlobales,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  const orgDeshabilitados = useMemo(
    () => organizacion?.modulos_deshabilitados ?? [],
    [organizacion?.modulos_deshabilitados]
  )

  const modulosActivos = useMemo(() => {
    if (!modulosGlobales) return [...TODOS_LOS_MODULOS]
    return getModulosActivos(modulosGlobales, orgDeshabilitados)
  }, [modulosGlobales, orgDeshabilitados])

  const isModuloActivo = (modulo: Modulo): boolean => {
    return modulosActivos.includes(modulo)
  }

  return {
    modulosActivos,
    isModuloActivo,
    modulosGlobales: modulosGlobales ?? [...TODOS_LOS_MODULOS],
    orgDeshabilitados,
    // No bloquear si ya hay datos en cache — mostrar contenido inmediatamente
    loading: authLoading || (loadingGlobales && !modulosGlobales),
  }
}
