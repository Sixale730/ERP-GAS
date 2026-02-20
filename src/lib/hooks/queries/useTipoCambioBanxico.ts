'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { configuracionKeys } from '@/lib/hooks/useConfiguracion'

interface TipoCambioResponse {
  ok: boolean
  tipo_cambio: number
  fecha: string
  fuente: string
  cached: boolean
  mensaje?: string
}

const tipoCambioKeys = {
  all: ['tipo-cambio'] as const,
}

async function fetchTipoCambioHoy(): Promise<TipoCambioResponse> {
  const res = await fetch('/api/tipo-cambio/hoy')
  if (!res.ok) throw new Error('Error al obtener tipo de cambio')
  return res.json()
}

async function fetchTipoCambioForce(): Promise<TipoCambioResponse> {
  const res = await fetch('/api/tipo-cambio/hoy?force=true')
  if (!res.ok) throw new Error('Error al obtener tipo de cambio')
  return res.json()
}

export function useTipoCambioBanxico() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: tipoCambioKeys.all,
    queryFn: fetchTipoCambioHoy,
    staleTime: 1000 * 60 * 30, // 30 min
  })

  const forceMutation = useMutation({
    mutationFn: fetchTipoCambioForce,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tipoCambioKeys.all })
      queryClient.invalidateQueries({ queryKey: configuracionKeys.all })
    },
  })

  return {
    data,
    isLoading,
    fetchFromBanxico: forceMutation.mutateAsync,
    isFetchingBanxico: forceMutation.isPending,
  }
}
