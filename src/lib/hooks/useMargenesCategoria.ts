'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ConfigMargenesCategoria } from '@/types/database'

const DEFAULT_MARGENES: ConfigMargenesCategoria = {
  global: 30,
  por_categoria: {}
}

const margenesKeys = {
  all: ['margenes-categoria'] as const,
}

async function fetchMargenesConfig(): Promise<ConfigMargenesCategoria> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .schema('erp')
    .from('configuracion')
    .select('valor')
    .eq('clave', 'margenes_categoria')
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (data?.valor) {
    return data.valor as ConfigMargenesCategoria
  }

  return DEFAULT_MARGENES
}

async function updateMargenesConfig(newConfig: ConfigMargenesCategoria) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .schema('erp')
    .from('configuracion')
    .upsert({
      clave: 'margenes_categoria',
      valor: newConfig,
      descripcion: 'Margenes de ganancia por categoria para ordenes de compra'
    }, { onConflict: 'clave' })

  if (error) throw error

  return newConfig
}

export function useMargenesCategoria() {
  const queryClient = useQueryClient()

  const { data: config = DEFAULT_MARGENES, isLoading: loading, error: queryError } = useQuery({
    queryKey: margenesKeys.all,
    queryFn: fetchMargenesConfig,
    staleTime: 1000 * 60 * 5,
  })

  const error = queryError ? (queryError as Error).message : null

  const mutation = useMutation({
    mutationFn: updateMargenesConfig,
    onSuccess: (newConfig) => {
      queryClient.setQueryData(margenesKeys.all, newConfig)
    },
  })

  const getMargenParaCategoria = useCallback((categoriaId: string | null): number => {
    if (!categoriaId) return config.global
    return config.por_categoria[categoriaId] ?? config.global
  }, [config])

  const updateConfig = async (newConfig: ConfigMargenesCategoria) => {
    try {
      await mutation.mutateAsync(newConfig)
      return { error: null }
    } catch (err: any) {
      return { error: err }
    }
  }

  const setMargenGlobal = async (porcentaje: number) => {
    const newConfig = { ...config, global: porcentaje }
    return updateConfig(newConfig)
  }

  const setMargenCategoria = async (categoriaId: string, porcentaje: number | null) => {
    const newPorCategoria = { ...config.por_categoria }

    if (porcentaje === null) {
      delete newPorCategoria[categoriaId]
    } else {
      newPorCategoria[categoriaId] = porcentaje
    }

    const newConfig = { ...config, por_categoria: newPorCategoria }
    return updateConfig(newConfig)
  }

  return {
    config,
    loading,
    error,
    getMargenParaCategoria,
    updateConfig,
    setMargenGlobal,
    setMargenCategoria,
    reload: () => queryClient.invalidateQueries({ queryKey: margenesKeys.all }),
  }
}
