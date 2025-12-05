'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { TIPO_CAMBIO_FALLBACK, MARGEN_GANANCIA_FALLBACK } from '@/lib/config/moneda'

interface ConfiguracionState {
  tipoCambio: number
  fechaTipoCambio: string
  margenGanancia: number
  loading: boolean
  error: string | null
}

export function useConfiguracion() {
  const [config, setConfig] = useState<ConfiguracionState>({
    tipoCambio: TIPO_CAMBIO_FALLBACK,
    fechaTipoCambio: new Date().toISOString().split('T')[0],
    margenGanancia: MARGEN_GANANCIA_FALLBACK,
    loading: true,
    error: null
  })

  const loadConfig = useCallback(async () => {
    const supabase = getSupabaseClient()

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('configuracion')
        .select('clave, valor')
        .in('clave', ['tipo_cambio', 'margen_ganancia'])

      if (error) throw error

      const tipoCambioRow = data?.find(d => d.clave === 'tipo_cambio')
      const margenRow = data?.find(d => d.clave === 'margen_ganancia')

      setConfig({
        tipoCambio: tipoCambioRow?.valor?.valor ?? TIPO_CAMBIO_FALLBACK,
        fechaTipoCambio: tipoCambioRow?.valor?.fecha ?? new Date().toISOString().split('T')[0],
        margenGanancia: margenRow?.valor?.porcentaje ?? MARGEN_GANANCIA_FALLBACK,
        loading: false,
        error: null
      })
    } catch (err: any) {
      console.error('Error loading config:', err)
      setConfig(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }))
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const updateTipoCambio = async (valor: number) => {
    const supabase = getSupabaseClient()
    const fecha = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .schema('erp')
      .from('configuracion')
      .update({ valor: { valor, fecha } })
      .eq('clave', 'tipo_cambio')

    if (!error) {
      setConfig(prev => ({ ...prev, tipoCambio: valor, fechaTipoCambio: fecha }))
    }
    return { error }
  }

  const updateMargenGanancia = async (porcentaje: number) => {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('configuracion')
      .update({ valor: { porcentaje } })
      .eq('clave', 'margen_ganancia')

    if (!error) {
      setConfig(prev => ({ ...prev, margenGanancia: porcentaje }))
    }
    return { error }
  }

  // Función para calcular precio de venta
  const calcularPrecioVenta = useCallback((costoUSD: number, tipoCambioOverride?: number, margenOverride?: number) => {
    const tc = tipoCambioOverride ?? config.tipoCambio
    const margen = margenOverride ?? config.margenGanancia
    return costoUSD * tc * (1 + margen / 100)
  }, [config.tipoCambio, config.margenGanancia])

  return {
    ...config,
    updateTipoCambio,
    updateMargenGanancia,
    calcularPrecioVenta,
    reload: loadConfig
  }
}
