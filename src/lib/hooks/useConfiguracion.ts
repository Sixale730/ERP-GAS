'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { TIPO_CAMBIO_FALLBACK, MARGEN_GANANCIA_FALLBACK } from '@/lib/config/moneda'

interface ConfiguracionData {
  tipoCambio: number
  fechaTipoCambio: string
  margenGanancia: number
}

const configuracionKeys = {
  all: ['configuracion'] as const,
}

async function fetchConfiguracion(): Promise<ConfiguracionData> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .schema('erp')
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['tipo_cambio', 'margen_ganancia'])

  if (error) throw error

  const tipoCambioRow = data?.find(d => d.clave === 'tipo_cambio')
  const margenRow = data?.find(d => d.clave === 'margen_ganancia')

  return {
    tipoCambio: tipoCambioRow?.valor?.valor ?? TIPO_CAMBIO_FALLBACK,
    fechaTipoCambio: tipoCambioRow?.valor?.fecha ?? new Date().toISOString().split('T')[0],
    margenGanancia: margenRow?.valor?.porcentaje ?? MARGEN_GANANCIA_FALLBACK,
  }
}

export function useConfiguracion() {
  const queryClient = useQueryClient()

  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: configuracionKeys.all,
    queryFn: fetchConfiguracion,
    staleTime: 1000 * 60 * 5,
  })

  const tipoCambio = data?.tipoCambio ?? TIPO_CAMBIO_FALLBACK
  const fechaTipoCambio = data?.fechaTipoCambio ?? new Date().toISOString().split('T')[0]
  const margenGanancia = data?.margenGanancia ?? MARGEN_GANANCIA_FALLBACK

  const updateTipoCambioMutation = useMutation({
    mutationFn: async (valor: number) => {
      const supabase = getSupabaseClient()
      const fecha = new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .schema('erp')
        .from('configuracion')
        .update({ valor: { valor, fecha } })
        .eq('clave', 'tipo_cambio')

      if (error) throw error
      return { valor, fecha }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configuracionKeys.all })
    },
  })

  const updateMargenMutation = useMutation({
    mutationFn: async (porcentaje: number) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('configuracion')
        .update({ valor: { porcentaje } })
        .eq('clave', 'margen_ganancia')

      if (error) throw error
      return { porcentaje }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configuracionKeys.all })
    },
  })

  const updateTipoCambio = async (valor: number) => {
    try {
      await updateTipoCambioMutation.mutateAsync(valor)
      return { error: null }
    } catch (err: unknown) {
      return { error: err }
    }
  }

  const updateMargenGanancia = async (porcentaje: number) => {
    try {
      await updateMargenMutation.mutateAsync(porcentaje)
      return { error: null }
    } catch (err: unknown) {
      return { error: err }
    }
  }

  const calcularPrecioVenta = useCallback((costoUSD: number, tipoCambioOverride?: number, margenOverride?: number) => {
    const tc = tipoCambioOverride ?? tipoCambio
    const margen = margenOverride ?? margenGanancia
    return costoUSD * tc * (1 + margen / 100)
  }, [tipoCambio, margenGanancia])

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: configuracionKeys.all })
  }

  return {
    tipoCambio,
    fechaTipoCambio,
    margenGanancia,
    loading,
    error: queryError?.message ?? null,
    updateTipoCambio,
    updateMargenGanancia,
    calcularPrecioVenta,
    reload,
  }
}
