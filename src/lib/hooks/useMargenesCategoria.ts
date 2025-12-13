'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ConfigMargenesCategoria } from '@/types/database'

const DEFAULT_MARGENES: ConfigMargenesCategoria = {
  global: 30,
  por_categoria: {}
}

export function useMargenesCategoria() {
  const [config, setConfig] = useState<ConfigMargenesCategoria>(DEFAULT_MARGENES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    const supabase = getSupabaseClient()
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .schema('erp')
        .from('configuracion')
        .select('valor')
        .eq('clave', 'margenes_categoria')
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data?.valor) {
        setConfig(data.valor as ConfigMargenesCategoria)
      } else {
        setConfig(DEFAULT_MARGENES)
      }
    } catch (err: any) {
      console.error('Error loading margenes config:', err)
      setError(err.message)
      setConfig(DEFAULT_MARGENES)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const getMargenParaCategoria = useCallback((categoriaId: string | null): number => {
    if (!categoriaId) return config.global
    return config.por_categoria[categoriaId] ?? config.global
  }, [config])

  const updateConfig = async (newConfig: ConfigMargenesCategoria) => {
    const supabase = getSupabaseClient()

    const { error: updateError } = await supabase
      .schema('erp')
      .from('configuracion')
      .upsert({
        clave: 'margenes_categoria',
        valor: newConfig,
        descripcion: 'Margenes de ganancia por categoria para ordenes de compra'
      }, { onConflict: 'clave' })

    if (!updateError) {
      setConfig(newConfig)
    }

    return { error: updateError }
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
    reload: loadConfig
  }
}
