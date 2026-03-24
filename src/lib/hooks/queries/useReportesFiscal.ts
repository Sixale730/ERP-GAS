import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface IVAMensualRow {
  mes: string        // 'YYYY-MM'
  mes_label: string  // 'Enero 2026'
  tipo: 'trasladado' | 'acreditable'
  base_gravable: number
  iva: number
  total: number
}

export interface CFDIEmitidoRow {
  id: string
  uuid_cfdi: string
  folio: string
  serie: string | null
  fecha: string
  fecha_timbrado: string | null
  cliente_rfc: string | null
  cliente_razon_social: string | null
  subtotal: number
  iva: number
  total: number
  status_sat: string | null
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function mesLabel(yyyy_mm: string): string {
  const [anio, mes] = yyyy_mm.split('-')
  const idx = parseInt(mes, 10) - 1
  return `${MESES_NOMBRE[idx] || mes} ${anio}`
}

// ─── R6: Reporte de IVA ──────────────────────────────────────────────────────

export function useReporteIVA(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-iva', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const resultado: IVAMensualRow[] = []

      // IVA Trasladado (de facturas emitidas)
      {
        let q = supabase
          .schema('erp')
          .from('facturas')
          .select('fecha, subtotal, iva, total')
          .eq('organizacion_id', orgId!)
          .not('status', 'eq', 'cancelada')
          .not('uuid_cfdi', 'is', null) // Solo timbradas

        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)

        const { data, error } = await q
        if (error) throw error

        const agrupado = new Map<string, { base: number; iva: number; total: number }>()
        for (const row of data || []) {
          const mes = (row.fecha || '').substring(0, 7) // 'YYYY-MM'
          const existing = agrupado.get(mes)
          if (existing) {
            existing.base += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(mes, {
              base: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }

        agrupado.forEach((vals, mes) => {
          resultado.push({
            mes,
            mes_label: mesLabel(mes),
            tipo: 'trasladado',
            base_gravable: vals.base,
            iva: vals.iva,
            total: vals.total,
          })
        })
      }

      // IVA Acreditable (de órdenes de compra recibidas)
      {
        let q = supabase
          .schema('erp')
          .from('ordenes_compra')
          .select('fecha, subtotal, iva, total')
          .eq('organizacion_id', orgId!)
          .in('status', ['recibida', 'parcialmente_recibida'])

        if (fechaDesde) q = q.gte('fecha', fechaDesde)
        if (fechaHasta) q = q.lte('fecha', fechaHasta)

        const { data, error } = await q
        if (error) throw error

        const agrupado = new Map<string, { base: number; iva: number; total: number }>()
        for (const row of data || []) {
          const mes = (row.fecha || '').substring(0, 7)
          const existing = agrupado.get(mes)
          if (existing) {
            existing.base += Number(row.subtotal || 0)
            existing.iva += Number(row.iva || 0)
            existing.total += Number(row.total || 0)
          } else {
            agrupado.set(mes, {
              base: Number(row.subtotal || 0),
              iva: Number(row.iva || 0),
              total: Number(row.total || 0),
            })
          }
        }

        agrupado.forEach((vals, mes) => {
          resultado.push({
            mes,
            mes_label: mesLabel(mes),
            tipo: 'acreditable',
            base_gravable: vals.base,
            iva: vals.iva,
            total: vals.total,
          })
        })
      }

      // Ordenar por mes
      resultado.sort((a, b) => a.mes.localeCompare(b.mes) || a.tipo.localeCompare(b.tipo))
      return resultado
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R7: CFDI Emitidos ───────────────────────────────────────────────────────

export function useCFDIEmitidos(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined,
  statusSat?: string | null
) {
  return useQuery({
    queryKey: ['reporte-cfdi-emitidos', fechaDesde, fechaHasta, orgId, statusSat],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let q = supabase
        .schema('erp')
        .from('facturas')
        .select('id, uuid_cfdi, folio, serie, fecha, fecha_timbrado, cliente_rfc, cliente_razon_social, subtotal, iva, total, status_sat, status')
        .eq('organizacion_id', orgId!)
        .not('uuid_cfdi', 'is', null)
        .order('fecha', { ascending: false })

      if (fechaDesde) q = q.gte('fecha', fechaDesde)
      if (fechaHasta) q = q.lte('fecha', fechaHasta)
      if (statusSat) q = q.eq('status_sat', statusSat)

      const { data, error } = await q
      if (error) throw error
      return (data || []) as CFDIEmitidoRow[]
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
