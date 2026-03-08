import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { facturasKeys } from './useFacturas'

interface PreviewFacturaGlobal {
  ventas_count: number
  subtotal: number
  iva: number
  ieps: number
  total: number
  folio_desde: string | null
  folio_hasta: string | null
}

interface ResultadoFacturaGlobal {
  id: string
  folio: string
  total: number
  ventas_incluidas: number
  folio_pos_desde: string
  folio_pos_hasta: string
}

async function fetchPreview(fechaDesde: string, fechaHasta: string, orgId: string): Promise<PreviewFacturaGlobal> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .schema('erp')
    .rpc('preview_factura_global' as any, {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
      p_organizacion_id: orgId,
    })

  if (error) throw error
  return data as unknown as PreviewFacturaGlobal
}

export function usePreviewFacturaGlobal(fechaDesde: string | null, fechaHasta: string | null, orgId: string | undefined) {
  return useQuery({
    queryKey: ['factura-global-preview', fechaDesde, fechaHasta, orgId],
    queryFn: () => fetchPreview(fechaDesde!, fechaHasta!, orgId!),
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

export function useGenerarFacturaGlobal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fechaDesde, fechaHasta, orgId }: { fechaDesde: string; fechaHasta: string; orgId: string }) => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .rpc('generar_factura_global' as any, {
          p_fecha_desde: fechaDesde,
          p_fecha_hasta: fechaHasta,
          p_organizacion_id: orgId,
        })

      if (error) throw error
      return data as unknown as ResultadoFacturaGlobal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facturasKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['factura-global-preview'] })
    },
  })
}
